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
