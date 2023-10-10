'use strict';
const UniqueQueue = require('./unique-queue');
const BufferUtil = require('./buffer-util');

const PAGE_SIZE = 1024 * 4;
const DEFAULT_CACHE_SIZE = 1024 * 1024 * 16;

/*
	Vfs ("virtual file source") is an abstract interface for reading raw chunks
	of contiguous data from some arbitrary source. Upon construction, it can be
	implemented to read from one file, or multiple ordered files, or some other
	storage medium altogether.

	It must provide the following functions, which are responsible for accessing
	data from the underlying source:

	async read(byteOffset, byteLength, saveToCache) -> Uint8Array
		Must return the data found at byteOffset. The size of the returned data
		must equal byteLength, unless not enough data exists.

	async size(saveToCache) -> number
		Must return the total size of the data, in bytes.

	async setup(saveToCache) -> void
		Used to intitalize any resources that are needed before reading.
		This function is optional.

	async teardown() -> void
		Used to clean up resources when the Vfs is no longer needed.
		This function is optional.

	The functions above can call saveToCache(byteOffset, data) to save data to
	a limited in-memory cache, which will be used to optimize subsequent reads
	to the same Vfs. The cache is automatically trimmed when it becomes too large.

	All other modules within this package that use the Vfs make some assumptions
	about the way the data within the Vfs is layed out:
		1. The first valid block of logs (if any) starts at offset 0.
		2. The data is a contiguous stream of valid blocks of logs.
		3. Only the last block can be incomplete (i.e., having no trailer).
		4. Data can be appended to the Vfs, but otherwise the Vfs is immutable.
		5. The logs within the Vfs were generated correctly.
 */

module.exports = class Vfs {
	constructor({
		read,
		size,
		setup = () => {},
		teardown = () => {},
		cacheSize = DEFAULT_CACHE_SIZE,
	} = {}) {
		if (typeof read !== 'function') {
			throw new TypeError('Expected options.read to be a function');
		}
		if (typeof size !== 'function') {
			throw new TypeError('Expected options.size to be a function');
		}
		if (typeof setup !== 'function') {
			throw new TypeError('Expected options.setup to be a function');
		}
		if (typeof teardown !== 'function') {
			throw new TypeError('Expected options.teardown to be a function');
		}
		if (!Number.isInteger(cacheSize)) {
			throw new TypeError('Expected options.cacheSize to be an integer');
		}
		if (cacheSize < 0) {
			throw new RangeError('Expected options.cacheSize to be non-negative');
		}

		this._read = read;
		this._size = size;
		this._setup = setup;
		this._teardown = teardown;
		this._maxCacheSize = cacheSize;
		this._cache = new Map();
		this._saveToCache = createSaveToCache(this._cache, this._maxCacheSize);
		this._busy = false;
		this._closed = true;
	}

	async setup() {
		if (this._busy) {
			throw new Error('Vfs object is busy with another operation');
		}
		if (!this._closed) {
			throw new Error('Vfs object is already open');
		}

		this._busy = true;
		try {
			const setupFn = this._setup;
			await setupFn(this._saveToCache);
			this._closed = false;
		} finally {
			this._busy = false;
		}
	}

	async teardown() {
		if (this._busy) {
			throw new Error('Vfs object is busy with another operation');
		}
		if (this._closed) {
			throw new Error('Vfs object is already closed');
		}

		this._busy = true;
		try {
			const teardownFn = this._teardown;
			await teardownFn();
			this._closed = true;
		} finally {
			this._busy = false;
		}
	}

	async read(byteOffset, byteLength) {
		if (!Number.isInteger(byteOffset)) {
			throw new TypeError('Expected byte offset to be an integer');
		}
		if (!Number.isInteger(byteLength)) {
			throw new TypeError('Expected byet length to be an integer');
		}
		if (byteOffset < 0) {
			throw new RangeError('Expected byte offset to be non-negative');
		}
		if (byteLength < 0) {
			throw new RangeError('Expected byet length to be non-negative');
		}
		if (this._busy) {
			throw new Error('Vfs object is busy with another operation');
		}
		if (this._closed) {
			throw new Error('Vfs object is closed');
		}
		if (byteLength === 0) {
			return new Uint8Array();
		}

		this._busy = true;
		try {
			const pageNumber = Math.floor(byteOffset / PAGE_SIZE);
			const pageCount = Math.ceil((byteOffset + byteLength) / PAGE_SIZE) - pageNumber;
			const { frontPages, backPages } = readFromCache(this._cache, pageNumber, pageCount);

			let data;
			if (frontPages.length === pageCount) {
				data = BufferUtil.concat(frontPages);
			} else {
				const readFn = this._read;
				const readOffset = (pageNumber + frontPages.length) * PAGE_SIZE;
				const readLength = (pageCount - frontPages.length - backPages.length) * PAGE_SIZE;
				data = await readFn(readOffset, readLength, this._saveToCache);

				if (!(data instanceof Uint8Array)) {
					throw new TypeError('Expected read() function to return a Uint8Array');
				}

				if (data.byteLength > readLength) {
					data = data.subarray(0, readLength);
				} else if (data.byteLength < readLength && backPages.length) {
					throw new Error('Vfs data corruption detected');
				}

				data = BufferUtil.concat([...frontPages, data, ...backPages]);
			}

			const trimBegin = byteOffset - pageNumber * PAGE_SIZE;
			const trimEnd = trimBegin + byteLength;
			return data.subarray(trimBegin, trimEnd);
		} finally {
			this._busy = false;
		}
	}

	async size() {
		if (this._busy) {
			throw new Error('Vfs object is busy with another operation');
		}
		if (this._closed) {
			throw new Error('Vfs object is closed');
		}

		this._busy = true;
		try {
			const sizeFn = this._size;
			const totalSize = await sizeFn(this._saveToCache);

			if (!Number.isInteger(totalSize)) {
				throw new TypeError('Expected size() function to return an integer');
			}
			if (totalSize < 0) {
				throw new RangeError('Expected size() function to return non-negative');
			}

			return totalSize;
		} finally {
			this._busy = false;
		}
	}

	get busy() {
		return this._busy;
	}

	get closed() {
		return this._closed;
	}

	static get PAGE_SIZE() {
		return PAGE_SIZE;
	}
};

function createSaveToCache(cache, maxCacheSize) {
	const maxCacheableSize = Math.floor(maxCacheSize / 4);
	const pageNumbers = new UniqueQueue();
	let cacheSize = 0;

	return (byteOffset, data) => {
		if (!Number.isInteger(byteOffset)) {
			throw new TypeError('Expected byte offset to be an integer');
		}
		if (byteOffset < 0) {
			throw new RangeError('Expected byte offset to be non-negative');
		}
		if (!(data instanceof Uint8Array)) {
			throw new TypeError('Expected data to be a Uint8Array');
		}
		if (data.byteLength < PAGE_SIZE || data.byteLength > maxCacheableSize) {
			return;
		}

		// Add each page to cache (overwriting pages if they already exist).
		// If the last page is incomplete, it will not be added to cache.
		let pageNumber = Math.ceil(byteOffset / PAGE_SIZE);
		let offset = pageNumber * PAGE_SIZE - byteOffset + PAGE_SIZE;
		while (offset < data.byteLength) {
			if (!pageNumbers.delete(pageNumber)) {
				cacheSize += PAGE_SIZE;
			}

			pageNumbers.push(pageNumber);
			cache.set(pageNumber++, new Uint8Array(data.subarray(offset - PAGE_SIZE, offset)));
			offset += PAGE_SIZE;
		}

		// If the cache is too big, delete the oldest pagest until it is not.
		while (cacheSize > maxCacheSize) {
			cache.delete(pageNumbers.shift());
			cacheSize -= PAGE_SIZE;
		}
	};
}

// Attempts to read the specified pages from cache. Pages are only read from the
// beginning or end of the range, not the middle (i.e., it does not return
// cached pages that would split up the requested range).
function readFromCache(cache, pageNumber, pageCount) {
	const frontPages = [];
	const backPages = [];
	if (cache.size) {
		for (let i = 0; i < pageCount; ++i) {
			const page = cache.get(pageNumber + i);
			if (page) {
				frontPages.push(page);
			} else {
				for (let j = pageCount - 1; j > i; --j) {
					const page = cache.get(pageNumber + j);
					if (page) {
						backPages.push(page);
					} else {
						break;
					}
				}
				break;
			}
		}
	}
	return { frontPages, backPages };
}
