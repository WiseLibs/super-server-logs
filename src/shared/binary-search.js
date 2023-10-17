'use strict';
const Vfs = require('./vfs');
const BufferUtil = require('./buffer-util');
const BlockParser = require('./block-parser');
const { SEPARATOR } = require('./common');

const PAGE_SIZE = Vfs.PAGE_SIZE;

/*
	Performs a binary search within the given Vfs to roughly identify the byte
	offset of logs that are close to the desired timestamp. This is not an exact
	operation; further scanning is necessary to find exact timestamps.
 */

module.exports = async (vfs, totalSize, desiredTimestamp) => {
	if (!(vfs instanceof Vfs)) {
		throw new TypeError('Expected vfs to be a Vfs object');
	}
	if (!Number.isInteger(totalSize)) {
		throw new TypeError('Expected totalSize to be an integer');
	}
	if (!Number.isInteger(desiredTimestamp)) {
		throw new TypeError('Expected desiredTimestamp to be an integer');
	}
	if (totalSize < 0) {
		throw new RangeError('Expected totalSize to be non-negative');
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
		// find a page that does. This is very unlikely except when blocks are
		// very large.
		while (!log) {
			if (!(midMax < right)) {
				right = midMin - 1;
				continue search;
			}
			log = await getPageLog(vfs, ++midMax);
		}

		prevPageNumber = midMax;

		const { timestamp } = log;
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
	if (block) {
		return BlockParser.parseOne(block);
	}
}

// Returns the last block associated with the given page. A block is associated
// with a certain page if its trailing separator is within the page.
async function readPageLastBlock(vfs, pageNumber) {
	let page = await vfs.read(pageNumber * PAGE_SIZE, PAGE_SIZE);
	let indexOfSeparator = BufferUtil.lastIndexOf(page, SEPARATOR);
	if (indexOfSeparator < 0) {
		return; // No separators means no blocks in this page
	}

	// First, we check to see if this page has a complete block. Most pages will
	// have many blocks contained within them, so this is a common fast path.
	const end = indexOfSeparator + 1;
	indexOfSeparator = BufferUtil.lastIndexOf(page, SEPARATOR, indexOfSeparator - 1);
	if (indexOfSeparator >= 0) {
		const begin = indexOfSeparator + 1;
		return page.subarray(begin, end);
	}

	// If this page only has one separator (meaning it only has one block), then
	// its block necessarily starts on a previous page. Therefore, to complete
	// the block, we need to search previous pages until we find a separator.
	const chunks = [page.subarray(0, end)];
	while (--pageNumber >= 0) {
		page = await vfs.read(pageNumber * PAGE_SIZE, PAGE_SIZE);
		indexOfSeparator = BufferUtil.lastIndexOf(page, SEPARATOR);
		if (indexOfSeparator >= 0) {
			const begin = indexOfSeparator + 1;
			chunks.push(page.subarray(begin));
			break;
		} else {
			chunks.push(page);
		}
	}

	if (chunks.length === 1) return chunks[0];
	return BufferUtil.concat(chunks.reverse());
}
