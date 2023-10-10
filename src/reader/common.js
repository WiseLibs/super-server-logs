'use strict'
const BufferUtil = require('./buffer-util');
const { SEPARATOR, TRAILER_LENGTH } = require('./constants');

exports.findNextSeparator = (chunk, initialIndex) => {
	const indexOfSeparator = BufferUtil.indexOf(chunk, SEPARATOR, initialIndex);

	// A separator is only "found" if its entire trailer is also found (and not
	// cut off at the end of the chunk).
	if (indexOfSeparator >= 0 && indexOfSeparator + TRAILER_LENGTH <= chunk.byteLength) {
		return indexOfSeparator;
	}

	return -1;
};

exports.findPrevSeparator = (chunk, initialIndex) => {
	const indexOfSeparator = BufferUtil.lastIndexOf(chunk, SEPARATOR, initialIndex);

	// A separator is only "found" if its entire trailer is also found (and not
	// cut off at the end of the chunk).
	if (indexOfSeparator >= 0 && indexOfSeparator + TRAILER_LENGTH <= chunk.byteLength) {
		return indexOfSeparator;
	}

	return -1;
};
