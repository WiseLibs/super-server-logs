'use strict';
const INDEX_OF = Uint8Array.prototype.indexOf;
const LAST_INDEX_OF = Uint8Array.prototype.lastIndexOf;

exports.indexOf = (haystack, needle, initialIndex = 0) => {
	if (initialIndex < 0) initialIndex = 0;
	return INDEX_OF.call(haystack, needle, initialIndex);
};

exports.lastIndexOf = (haystack, needle, initialIndex = haystack.length - 1) => {
	if (initialIndex < 0) return -1;
	return LAST_INDEX_OF.call(haystack, needle, initialIndex);
};

exports.concat = (chunks) => {
	let totalSize = 0;
	for (let i = 0; i < chunks.length; ++i) {
		totalSize += chunks[i].byteLength;
	}

	let offset = 0;
	const output = exports.alloc(totalSize);
	for (let i = 0; i < chunks.length; ++i) {
		const chunk = chunks[i];
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return output;
};

// Given an array of Uint8Arrays, returns a Uint8Array of the desiredSize, which
// is created by draining data from the given array and concatenating that data.
// The array is therefore mutated such that the returned data is removed from
// the array, but any unused data is left untouched.
exports.extractSize = (chunks, desiredSize) => {
	let count = 0;
	let totalSize = 0;
	while (totalSize < desiredSize) {
		if (count >= chunks.length) {
			throw new RangeError('Not enough data to extract');
		}
		totalSize += chunks[count++].byteLength;
	}

	const lastIndex = count - 1;
	if (lastIndex === 0) {
		let chunk = chunks[0];
		if (chunk.byteLength > desiredSize) {
			chunks[0] = chunk.subarray(desiredSize);
			return chunk.subarray(0, desiredSize);
		} else {
			return chunks.shift();
		}
	} else if (lastIndex > 0) {
		let offset = 0;
		const output = exports.alloc(desiredSize);
		for (let i = 0; i < lastIndex; ++i) {
			const chunk = chunks[i];
			output.set(chunk, offset);
			offset += chunk.byteLength;
		}

		const remainingBytes = desiredSize - offset;
		const lastChunk = chunks[lastIndex];
		if (lastChunk.byteLength > remainingBytes) {
			chunks[lastIndex] = lastChunk.subarray(remainingBytes);
			exports.copy(lastChunk, output, offset, 0, remainingBytes);
			chunks.splice(0, lastIndex);
			return output;
		} else {
			output.set(lastChunk, offset);
			chunks.splice(0, count);
			return output;
		}
	} else {
		return exports.alloc(0);
	}
};

exports.isFastAllocation = () => {
	throw new TypeError('Bootstrapping required by index.js or browser.js');
};

exports.alloc = () => {
	throw new TypeError('Bootstrapping required by index.js or browser.js');
};

exports.from = () => {
	throw new TypeError('Bootstrapping required by index.js or browser.js');
};

exports.normalize = () => {
	throw new TypeError('Bootstrapping required by index.js or browser.js');
};

exports.copy = () => {
	throw new TypeError('Bootstrapping required by index.js or browser.js');
};

exports.toString = () => {
	throw new TypeError('Bootstrapping required by index.js or browser.js');
};
