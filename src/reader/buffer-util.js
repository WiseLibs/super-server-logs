'use strict';

exports.lastIndexOf = (haystack, needle, initialIndex = haystack.length - 1) => {
	if (initialIndex < 0) {
		return -1;
	}

	const lastIndex = needle.length - 1;
	const lastByte = needle[lastIndex];
	let index = haystack.lastIndexOf(lastByte, initialIndex + lastIndex);

	search: while (index >= lastIndex) {
		for (let i = 1; i <= lastIndex; ++i) {
			if (haystack[index - i] !== needle[lastIndex - i]) {
				index = haystack.lastIndexOf(lastByte, --index);
				continue search;
			}
		}
		return index - lastIndex;
	}

	return -1;
};

exports.indexOf = (haystack, needle, initialIndex = 0) => {
	if (initialIndex < 0) {
		initialIndex = 0;
	}

	const firstByte = needle[0];
	const upperBound = haystack.length - needle.length;
	let index = haystack.indexOf(firstByte, initialIndex);

	search: while (index >= 0 && index <= upperBound) {
		for (let i = 1; i < needle.length; ++i) {
			if (haystack[index + i] !== needle[i]) {
				index = haystack.indexOf(firstByte, ++index);
				continue search;
			}
		}
		return index;
	}

	return -1;
};

exports.concat = (chunks) => {
	let totalSize = 0;
	for (let i = 0; i < chunks.length; ++i) {
		totalSize += chunks[i].byteLength;
	}

	let offset = 0;
	const output = new Uint8Array(totalSize);
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
		const output = new Uint8Array(desiredSize);
		for (let i = 0; i < lastIndex; ++i) {
			const chunk = chunks[i];
			output.set(chunk, offset);
			offset += chunk.byteLength;
		}

		const remainingBytes = desiredSize - offset;
		const lastChunk = chunks[lastIndex];
		if (lastChunk.byteLength > remainingBytes) {
			chunks[lastIndex] = lastChunk.subarray(remainingBytes);
			output.set(lastChunk.subarray(0, remainingBytes), offset);
			chunks.splice(0, lastIndex);
			return output;
		} else {
			output.set(lastChunk, offset);
			chunks.splice(0, count);
			return output;
		}
	} else {
		return new Uint8Array();
	}
};
