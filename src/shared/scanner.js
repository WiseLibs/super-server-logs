'use strict';
const Vfs = require('./vfs');
const BufferUtil = require('./buffer-util');
const BlockParser = require('./block-parser');
const { SEPARATOR } = require('./common');

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

		this._vfs = vfs;
		this._totalSize = totalSize;
		this._pageCount = Math.ceil(totalSize / PAGE_SIZE);

		// Chunk state
		this._chunk = BufferUtil.alloc(0);
		this._chunkOffset = 0;
		this._chunkFromPageNumber = -1;
		this._isBlockBundary = true;
		this._tailLength = 0;

		// Intra-block state
		this._nextLogs = null;
		this._prevLogs = null;
		this._nextOffset = 0;
		this._prevOffset = 0;
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
		// If we're in the middle of a block, finish logging it.
		if (this._nextLogs) {
			if (this._nextOffset < this._prevOffset) {
				this._reverseBlock();
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
				const pageDelta = Math.ceil(overflow / PAGE_SIZE);
				const pageNumber = this._chunkFromPageNumber + pageDelta;
				this._chunk = await this._vfs.read(pageNumber * PAGE_SIZE, PAGE_SIZE);
				this._chunkOffset = overflow - ((pageDelta - 1) * PAGE_SIZE);
				this._chunkFromPageNumber = pageNumber;
			}
		}

		// Iterate through pages until there are none left.
		for (;;) {
			const chunk = this._chunk;
			const offset = this._chunkOffset;

			const indexOfSeparator = BufferUtil.indexOf(chunk, SEPARATOR, offset);
			if (indexOfSeparator >= 0) {
				this._chunkOffset = indexOfSeparator + 1;
				if (this._isBlockBundary) {
					const block = chunk.subarray(offset, this._chunkOffset);
					this._enterBlock(block, offset);
					this._nextLogs.reverse();
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
				if (!this._isBlockBundary) {
					this._chunkOffset = chunk.byteLength;
				}
				break;
			}
		}
	}

	async *backwardScan() {
		// If we're in the middle of a block, finish logging it.
		if (this._nextLogs) {
			if (this._nextOffset > this._prevOffset) {
				this._reverseBlock();
			}
			yield* this._yieldLogs();
		}

		// Remove any tail that's leftover from a forward scan.
		if (this._tailLength > 0) {
			this._chunk = this._chunk.subarray(this._tailLength);
			this._chunkOffset -= this._tailLength;
			this._tailLength = 0;

			// If the current position was in the removed tail, backtrack to the
			// previous page to restore the correct state.
			if (this._chunkOffset < 0) {
				const pageDelta = Math.floor(this._chunkOffset / PAGE_SIZE);
				const pageNumber = this._chunkFromPageNumber + pageDelta;
				this._chunk = await this._vfs.read(pageNumber * PAGE_SIZE, PAGE_SIZE);
				this._chunkOffset -= pageDelta * PAGE_SIZE;
				this._chunkFromPageNumber = pageNumber;
			}
		}

		// Iterate through pages until there are none left.
		for (;;) {
			const chunk = this._chunk;
			const offset = this._chunkOffset;
			const initialIndex = offset - (this._isBlockBundary ? 2 : 1);

			const indexOfSeparator = BufferUtil.lastIndexOf(chunk, SEPARATOR, initialIndex);
			if (indexOfSeparator >= 0) {
				this._chunkOffset = indexOfSeparator + 1;
				if (this._isBlockBundary) {
					const block = chunk.subarray(this._chunkOffset, offset);
					this._enterBlock(block, offset);
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
					this._enterBlock(block, offset);
					yield* this._yieldLogs();
				} else {
					this._isBlockBundary = true;
				}
				break;
			}
		}
	}

	async updateSize(totalSize) {
		if (!Number.isInteger(totalSize)) {
			throw new TypeError('Expected totalSize to be an integer');
		}
		if (totalSize < this._totalSize) {
			throw new RangeError('Vfs size cannot decrease');
		}
		if (totalSize === this._totalSize) {
			return;
		}

		// If we're currently on the last page, reload the chunk.
		const pageNumber = this._chunkFromPageNumber;
		if (pageNumber === this._pageCount - 1 && pageNumber >= 0) {
			let chunk = await this._vfs.read(pageNumber * PAGE_SIZE, PAGE_SIZE);

			if (this._tailLength > 0) {
				chunk = BufferUtil.concat([this._chunk.subarray(0, this._tailLength), chunk]);
			}

			this._chunk = chunk;
		}

		this._totalSize = totalSize;
		this._pageCount = Math.ceil(totalSize / PAGE_SIZE);
	}

	calculateByteOffset() {
		if (this._chunkFromPageNumber < 0) {
			return 0;
		}

		const offset = this._nextLogs ? this._nextOffset : this._chunkOffset;
		return this._chunkFromPageNumber * PAGE_SIZE + offset - Math.max(0, this._tailLength);
	}

	_enterBlock(block, prevOffset) {
		this._nextLogs = [...BlockParser.parseEach(block)];
		this._prevLogs = [];
		this._nextOffset = this._chunkOffset;
		this._prevOffset = prevOffset;
	}

	_reverseBlock() {
		const temp1 = this._nextLogs;
		this._nextLogs = this._prevLogs;
		this._prevLogs = temp1;
		const temp2 = this._nextOffset;
		this._nextOffset = this._prevOffset;
		this._prevOffset = temp2;
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
				this._chunkOffset = this._nextOffset;
				yield log;
				break;
			}
		}
	}
};
