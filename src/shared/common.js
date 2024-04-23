'use strict'
const BufferUtil = require('./buffer-util');

const ESCAPE = exports.ESCAPE = 0xf8;
const SEPARATOR = exports.SEPARATOR = 0xfa;
const ESCAPE_CODE_ESCAPE = exports.ESCAPE_CODE_ESCAPE = 1;
const ESCAPE_CODE_SEPARATOR = exports.ESCAPE_CODE_SEPARATOR = 2;
const ESCAPE_CODE_SLICEMARKER = exports.ESCAPE_CODE_SLICEMARKER = 3;

const ESCAPE_CHUNK = BufferUtil.from([ESCAPE]);
const SEPARATOR_CHUNK = BufferUtil.from([SEPARATOR]);
const ESCAPED_ESCAPE = BufferUtil.from([ESCAPE, ESCAPE_CODE_ESCAPE]);
const ESCAPED_SEPARATOR = BufferUtil.from([ESCAPE, ESCAPE_CODE_SEPARATOR]);

exports.escapeBlock = (block) => {
	let indexOfEscape = BufferUtil.indexOf(block, ESCAPE);
	let indexOfSeparator = BufferUtil.indexOf(block, SEPARATOR);
	if (indexOfEscape >= 0 || indexOfSeparator >= 0) {
		let offset = 0;
		const parts = [];
		do {
			if (indexOfSeparator < 0 || indexOfEscape >= 0 && indexOfEscape < indexOfSeparator) {
				parts.push(block.subarray(offset, indexOfEscape), ESCAPED_ESCAPE);
				offset = indexOfEscape + 1;
				indexOfEscape = BufferUtil.indexOf(block, ESCAPE, offset);
			} else {
				parts.push(block.subarray(offset, indexOfSeparator), ESCAPED_SEPARATOR);
				offset = indexOfSeparator + 1;
				indexOfSeparator = BufferUtil.indexOf(block, SEPARATOR, offset);
			}
		} while (indexOfEscape >= 0 || indexOfSeparator >= 0);
		parts.push(block.subarray(offset));
		return BufferUtil.concat(parts);
	}
	return block;
};

exports.unescapeBlock = (block) => {
	let indexOfEscape = BufferUtil.indexOf(block, ESCAPE);
	if (indexOfEscape >= 0) {
		let offset = 0;
		const parts = [];
		do {
			parts.push(block.subarray(offset, indexOfEscape));
			const escapeCode = block[indexOfEscape + 1];
			if (escapeCode === ESCAPE_CODE_ESCAPE) {
				parts.push(ESCAPE_CHUNK);
			} else if (escapeCode === ESCAPE_CODE_SEPARATOR) {
				parts.push(SEPARATOR_CHUNK);
			} else if (escapeCode === ESCAPE_CODE_SLICEMARKER) {
				parts.splice(0); // Slice off all previous data in the block
			} else {
				throw new TypeError(`Unrecognized escape code: ${escapeCode}`);
			}
			offset = indexOfEscape + 2;
			indexOfEscape = BufferUtil.indexOf(block, ESCAPE, offset);
		} while (indexOfEscape >= 0);
		parts.push(block.subarray(offset));
		return BufferUtil.concat(parts);
	}
	return block;
};

exports.compress = () => {
	throw new TypeError('Bootstrapping required by index.js or browser.js');
};

exports.decompress = () => {
	throw new TypeError('Bootstrapping required by index.js or browser.js');
};
