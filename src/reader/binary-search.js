'use strict';
const Vfs = require('./vfs');
const BufferUtil = require('./buffer-util');
const BlockParser = require('./block-parser');
const { SEPARATOR, TRAILER_LENGTH } = require('./constants');

const PAGE_SIZE = Vfs.PAGE_SIZE;
const PRE_READ = TRAILER_LENGTH - 1;

/*
	Performs a binary search within the given Vfs to roughly identify the byte
	offset of logs that are close to the desired timestamp. This is not an exact
	operation; further scanning is necessary to find exact timestamps.
 */

module.exports = async (vfs, totalSize, desiredTimestamp) => {
	if (!(vfs instanceof Vfs)) {
		throw new TypeError('Expected vfs to be a Vfs object');
	}
	if (!Number.isInteger(desiredTimestamp)) {
		throw new TypeError('Expected desiredTimestamp to be an integer');
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

	const pageCount = Math.ceil(totalSize / PAGE_SIZE);
	let prevPageNumber = 0;
	let left = 0;
	let right = pageCount - 1;

	search: while (left <= right) {
		const midMin = Math.floor((left + right) / 2);
		let midMax = midMin;
		let log = await getPageLog(vfs, midMax);

		// If the middle page doesn't have any logs, we scan forward until we
		// find a page that does. This is very unlikely.
		while (!log) {
			if (!(midMax < right)) {
				right = midMin - 1;
				continue search;
			}
			log = await getPageLog(vfs, ++midMax);
		}

		const timestamp = log[0];
		if (!Number.isInteger(timestamp)) {
			throw new TypeError('Corrupted logs detected');
		}

		prevPageNumber = midMax;
		if (desiredTimestamp > timestamp) {
			left = midMax + 1;
		} else if (desiredTimestamp < timestamp) {
			right = midMin - 1;
		} else {
			break;
		}
	}

	return prevPageNumber * PAGE_SIZE;
};

// Returns an arbitrary log within the given page, or undefined if none exist.
async function getPageLog(vfs, pageNumber) {
	const block = await readPageLastBlock(vfs, pageNumber);
	if (block.byteLength) {
		return BlockParser.parseOne(block);
	}
}

// Returns the last block associated with the given page. A block is associated
// with a certain page if its separator ends within the page boundary.
async function readPageLastBlock(vfs, pageNumber) {
	// Most pages will have many blocks contained within them, so we can just do
	// a naive search for the last complete block, and it will usually work.
	const page = await vfs.read(pageNumber * PAGE_SIZE, PAGE_SIZE);
	let indexOfSeparator = findLastSeparator(page);
	if (indexOfSeparator >= 0) {
		const end = indexOfSeparator + TRAILER_LENGTH;
		indexOfSeparator = BufferUtil.lastIndexOf(page, SEPARATOR, indexOfSeparator - 1);
		if (indexOfSeparator >= 0) {
			const begin = indexOfSeparator + TRAILER_LENGTH;
			return page.subarray(begin, end);
		}
	}

	// If we couldn't find a complete block the naive way, we do a proper scan
	// to find all blocks associated with the given page, and then we just
	// identify the last one, if there's more than one.
	const blocks = await readPageBlocks(vfs, pageNumber);
	if (blocks.byteLength) {
		indexOfSeparator = BufferUtil.lastIndexOf(blocks, SEPARATOR, blocks.byteLength - TRAILER_LENGTH - 1);
		if (indexOfSeparator >= 0) {
			return blocks.subarray(indexOfSeparator + TRAILER_LENGTH);
		}
	}

	return blocks;
}

// Returns a concatenation of all blocks associated with the given page.
async function readPageBlocks(vfs, pageNumber) {
	let { page, pageStart } = await readPage(vfs, pageNumber);
	let indexOfSeparator = findLastSeparator(page);
	if (indexOfSeparator < 0) {
		return new Uint8Array(); // No separators means no blocks in this page
	}

	const chunks = [page.subarray(pageStart, indexOfSeparator + TRAILER_LENGTH)];
	if (pageNumber > 0) {
		// We need to search the previous page to complete the block that ends
		// at the first separator in this page. The previous page will naturally
		// be cached by the Vfs, so we just check it before looking further.
		page = await vfs.read((pageNumber - 1) * PAGE_SIZE, PAGE_SIZE);
		indexOfSeparator = findLastSeparator(page);

		if (indexOfSeparator >= 0) {
			chunks.push(page.subarray(indexOfSeparator + TRAILER_LENGTH));
		} else {
			// If a separator wasn't found, it might simply be cut off, so we
			// need to check the same page again, but with readPage(). If it's
			// still not found, we keep searching pages until it is found.
			while (--pageNumber >= 0) {
				({ page, pageStart } = await readPage(vfs, pageNumber));
				indexOfSeparator = findLastSeparator(page);
				if (indexOfSeparator >= 0) {
					chunks.push(page.subarray(indexOfSeparator + TRAILER_LENGTH));
					break;
				} else {
					chunks.push(page.subarray(pageStart));
				}
			}
		}
	}

	if (chunks.length === 1) return chunks[0];
	return BufferUtil.concat(chunks.reverse());
}

async function readPage(vfs, pageNumber) {
	let pageStart = 0;
	let readOffset = pageNumber * PAGE_SIZE;
	let readLength = PAGE_SIZE;

	// Separators that end within some page are counted as being "part of" that
	// page (and not part of the page where they start). Therefore, we need to
	// read a few bytes before the actual page boundary, to make sure sure we
	// find any separators that would otherwise be cut off.
	if (pageNumber > 0) {
		pageStart = PRE_READ;
		readOffset -= PRE_READ;
		readLength += PRE_READ;
	}

	const page = await vfs.read(readOffset, readLength);
	return { page, pageStart };
}

function findLastSeparator(page) {
	let indexOfSeparator = BufferUtil.lastIndexOf(page, SEPARATOR);

	// If a separator was found, but its trailer is cut off at the end of the
	// page, it doesn't count as being part of this page. So we try to find the
	// next separator.
	if (indexOfSeparator >= 0 && indexOfSeparator + TRAILER_LENGTH > page.byteLength) {
		indexOfSeparator = BufferUtil.lastIndexOf(page, SEPARATOR, indexOfSeparator - 1);
	}

	return indexOfSeparator;
}
