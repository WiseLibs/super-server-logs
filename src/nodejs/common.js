'use strict';
const { ESCAPE, SEPARATOR, ESCAPE_CODE_ESCAPE, ESCAPE_CODE_SEPARATOR } = require('../shared/common');

const ESCAPED_ESCAPE = Buffer.from([ESCAPE, ESCAPE_CODE_ESCAPE]);
const ESCAPED_SEPARATOR = Buffer.from([ESCAPE, ESCAPE_CODE_SEPARATOR]);

exports.escapeBlock = (block) => {
	let indexOfEscape = block.indexOf(ESCAPE);
	let indexOfSeparator = block.indexOf(SEPARATOR);
	if (indexOfEscape >= 0 || indexOfSeparator >= 0) {
		let offset = 0;
		const parts = [];
		do {
			if (indexOfSeparator < 0 || indexOfEscape >= 0 && indexOfEscape < indexOfSeparator) {
				parts.push(block.subarray(offset, indexOfEscape), ESCAPED_ESCAPE);
				offset = indexOfEscape + 1;
				indexOfEscape = block.indexOf(ESCAPE, offset);
			} else {
				parts.push(block.subarray(offset, indexOfSeparator), ESCAPED_SEPARATOR);
				offset = indexOfSeparator + 1;
				indexOfSeparator = block.indexOf(SEPARATOR, offset);
			}
		} while (indexOfEscape >= 0 || indexOfSeparator >= 0);
		parts.push(block.subarray(offset));
		return Buffer.concat(parts);
	}
	return block;
};

exports.isLogBasename = (basename) => {
	return /^[0-9]{14}\.log$/.test(basename);
};

exports.toLogBasename = (timestamp) => {
	return `${String(timestamp).padStart(14, '0')}.log`;
};

exports.toLogTimestamp = (basename) => {
	return Number(basename.slice(0, -4));
};
