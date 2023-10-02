'use strict';
const Vfs = require('./vfs');
const BufferUtil = require('./buffer-util');
const BlockParser = require('./block-parser');
const { SEPARATOR, TRAILER_LENGTH } = require('./constants');

const PAGE_SIZE = Vfs.PAGE_SIZE * 8;

/*
	Scanner is used to linearly scan through the given Vfs, yielding logs as it
	goes. It can perform both forward and backward scans, and it can switch
	directions at any time.
 */

module.exports = class Scanner {
	constructor(vfs, totalSize) {
		if (!(vfs instanceof Vfs)) {
			throw new TypeError('Expected vfs to be a Vfs object');
		}
		if (!Number.isInteger(totalSize)) {
			throw new TypeError('Expected totalSize to be an integer');
		}
		if (totalSize < 0) {
			throw new RangeError('Expected totalSize to be non-negative');
		}
		if (vfs.closed) {
			throw new Error('Vfs object is closed');
		}

		this._vfs = vfs;
		this._pageCount = Math.ceil(totalSize / PAGE_SIZE);
		this._chunk = new Uint8Array();
		this._chunkOffset = 0;
		this._chunkFromPageNumber = -1;
		this._isBlockBundary = true;
		this._tailLength = 0;
		this._nextLogs = null;
		this._prevLogs = null;
		this._isLoggingBackwards = false;
	}

	async goto(byteOffset) {
		if (!Number.isInteger(byteOffset)) {
			throw new TypeError('Expected byte offset to be an integer');
		}
		if (byteOffset < 0) {
			throw new RangeError('Expected byte offset to be non-negative');
		}

		const pageNumber = Math.floor(byteOffset / PAGE_SIZE);
		const pageOffset = byteOffset % PAGE_SIZE;

		this._chunk = await this._vfs.read(pageNumber * PAGE_SIZE, PAGE_SIZE);
		this._chunkOffset = Math.min(pageOffset, this._chunk.byteLength);
		this._chunkFromPageNumber = pageNumber;
		this._isBlockBundary = pageNumber === 0 && this._chunkOffset === 0;
		this._tailLength = 0;
		this._nextLogs = null;
		this._prevLogs = null;
	}

	async *forwardScan() {
		// If we're in the middle of a chunk, finish logging it.
		if (this._nextLogs) {
			if (this._isLoggingBackwards) {
				const temp = this._nextLogs;
				this._nextLogs = this._prevLogs;
				this._prevLogs = temp;
				this._isLoggingBackwards = false;
			}
			yield* this._yieldLogs();
		}

		// Remove any tail that's leftover from a backward scan.
		if (this._tailLength < 0) {
			this._chunk = this._chunk.subarray(0, this._tailLength);
			this._tailLength = 0;

			// If the current position was in the removed tail, advance to the
			// next page to restore the correct state.
			if (this._chunkOffset > this._chunk.byteLength) {
				const overflow = this._chunkOffset - this._chunk.byteLength;
				const pageNumber = this._chunkFromPageNumber + 1;
				this._chunk = await this._vfs.read(pageNumber * PAGE_SIZE, PAGE_SIZE);
				this._chunkOffset = overflow;
				this._chunkFromPageNumber = pageNumber;
			}
		}

		// Iterate through pages until there are none left.
		for (;;) {
			const chunk = this._chunk;
			const offset = this._chunkOffset;

			let indexOfSeparator = findNextSeparator(chunk, offset);
			if (indexOfSeparator >= 0) {
				this._chunkOffset = indexOfSeparator + TRAILER_LENGTH;
				if (this._isBlockBundary) {
					const block = chunk.subarray(offset, this._chunkOffset);
					this._nextLogs = BlockParser.parseAll(block).reverse();
					this._prevLogs = [];
					this._isLoggingBackwards = false;
					yield* this._yieldLogs();
				} else {
					this._isBlockBundary = true;
				}
			} else if (this._chunkFromPageNumber + 1 < this._pageCount) {
				const pageNumber = this._chunkFromPageNumber + 1;
				this._chunk = await this._vfs.read(pageNumber * PAGE_SIZE, PAGE_SIZE);
				this._chunkOffset = 0;
				this._chunkFromPageNumber = pageNumber;
				this._tailLength = 0;

				// If we're at a block boundary, carry over any leftover data
				// from the current chunk; it will be needed in the next block.
				if (this._isBlockBundary && offset < chunk.byteLength) {
					this._chunk = BufferUtil.concat([chunk.subarray(offset), this._chunk]);
					this._tailLength = chunk.byteLength - offset;
				}
			} else {
				this._chunkOffset = chunk.byteLength;
				break;
			}
		}
	}

	async *backwardScan() {
		// If we're in the middle of a chunk, finish logging it.
		if (this._nextLogs) {
			if (!this._isLoggingBackwards) {
				const temp = this._nextLogs;
				this._nextLogs = this._prevLogs;
				this._prevLogs = temp;
				this._isLoggingBackwards = true;
			}
			yield* this._yieldLogs();
		}

		// Remove any tail that's leftover from a forward scan.
		if (this._tailLength > 0) {
			this._chunk = this._chunk.subarray(this._tailLength);
			this._chunkOffset -= this._tailLength;
			this._tailLength = 0;
		}

		// Iterate through pages until there are none left.
		for (;;) {
			const chunk = this._chunk;
			const offset = this._chunkOffset;
			const initialIndex = offset - 1 - (this._isBlockBundary ? TRAILER_LENGTH : 0);

			let indexOfSeparator = findPrevSeparator(chunk, initialIndex);
			if (indexOfSeparator >= 0) {
				this._chunkOffset = indexOfSeparator + TRAILER_LENGTH;
				if (this._isBlockBundary) {
					const block = chunk.subarray(this._chunkOffset, offset);
					this._nextLogs = BlockParser.parseAll(block);
					this._prevLogs = [];
					this._isLoggingBackwards = true;
					yield* this._yieldLogs();
				} else {
					this._isBlockBundary = true;
				}
			} else if (this._chunkFromPageNumber > 0) {
				const pageNumber = this._chunkFromPageNumber - 1;
				this._chunk = await this._vfs.read(pageNumber * PAGE_SIZE, PAGE_SIZE);
				this._chunkOffset = this._chunk.byteLength;
				this._chunkFromPageNumber = pageNumber;
				this._tailLength = 0;

				// If we're at a block boundary, carry over any leftover data
				// from the current chunk; it will be needed in the next block.
				if (this._isBlockBundary && offset > 0) {
					this._chunk = BufferUtil.concat([this._chunk, chunk.subarray(0, offset)]);
					this._chunkOffset = this._chunk.byteLength;
					this._tailLength = -offset;
				}
			} else {
				this._chunkOffset = 0;
				if (this._isBlockBundary && offset > 0) {
					const block = chunk.subarray(0, offset);
					this._nextLogs = BlockParser.parseAll(block);
					this._prevLogs = [];
					this._isLoggingBackwards = true;
					yield* this._yieldLogs();
				} else {
					this._isBlockBundary = true;
				}
				break;
			}
		}
	}

	*_yieldLogs() {
		for (;;) {
			const log = this._nextLogs.pop();
			if (this._nextLogs.length) {
				this._prevLogs.push(log);
				yield log;
			} else {
				this._nextLogs = null;
				this._prevLogs = null;
				yield log;
				break;
			}
		}
	}
};

function findNextSeparator(chunk, initialIndex) {
	let indexOfSeparator = BufferUtil.indexOf(chunk, SEPARATOR, initialIndex);

	// A separator is only "found" if its entire trailer is also found (and not
	// cut off at the end of the chunk).
	if (indexOfSeparator >= 0 && indexOfSeparator + TRAILER_LENGTH <= chunk.byteLength) {
		return indexOfSeparator;
	}

	return -1;
}

function findPrevSeparator(chunk, initialIndex) {
	let indexOfSeparator = BufferUtil.lastIndexOf(chunk, SEPARATOR, initialIndex);

	// A separator is only "found" if its entire trailer is also found (and not
	// cut off at the end of the chunk).
	if (indexOfSeparator >= 0 && indexOfSeparator + TRAILER_LENGTH <= chunk.byteLength) {
		return indexOfSeparator;
	}

	return -1;
}
