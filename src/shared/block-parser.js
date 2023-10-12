'use strict';
const Reader = require('./reader');
const LogEntry = require('./log-entry');
const BufferUtil = require('./buffer-util');
const { decompress } = require('./common');
const { ESCAPE, SEPARATOR, TRAILER_LENGTH, ESCAPED_SEQUENCE_LENGTH } = require('./constants');

exports.parseOne = (block) => {
	if (!(block instanceof Uint8Array)) {
		throw new TypeError('Expected block to be a Uint8Array');
	}
	if (!block.byteLength) {
		throw new RangeError('Unexpected empty block');
	}

	return new LogEntry(new Reader(unwrapBlock(block)));
};

exports.parseEach = (block) => {
	if (!(block instanceof Uint8Array)) {
		throw new TypeError('Expected block to be a Uint8Array');
	}
	if (!block.byteLength) {
		throw new RangeError('Unexpected empty block');
	}

	const reader = new Reader(unwrapBlock(block));
	const end = reader.input.byteLength;

	return {
		next() {
			if (reader.offset < end) {
				return { value: new LogEntry(reader), done: false };
			} else {
				return { value: undefined, done: true };
			}
		},
		return(value) {
			reader.offset = end;
			return { value, done: true };
		},
		throw(reason) {
			reader.offset = end;
			throw reason;
		},
		[Symbol.iterator]() {
			return this;
		},
	};
};

function unwrapBlock(block) {
	const isCompressed = block[block.byteLength - 1] & 1;
	block = block.subarray(0, block.byteLength - TRAILER_LENGTH);
	block = unescapeBlock(block);
	return isCompressed ? decompress(block) : block;
}

function unescapeBlock(block) {
	let indexOfEscape = BufferUtil.indexOf(block, ESCAPE);
	if (indexOfEscape >= 0) {
		let offset = 0;
		const parts = [];
		do {
			parts.push(block.subarray(offset, indexOfEscape));
			const escapeCode = block[indexOfEscape + ESCAPE.byteLength];
			if (escapeCode === 0) {
				parts.push(ESCAPE);
			} else if (escapeCode === 1) {
				parts.push(SEPARATOR);
			} else {
				throw new TypeError(`Unrecognized escape code: ${escapeCode}`);
			}
			offset = indexOfEscape + ESCAPED_SEQUENCE_LENGTH;
			indexOfEscape = BufferUtil.indexOf(block, ESCAPE, offset);
		} while (indexOfEscape >= 0);
		parts.push(block.subarray(offset));
		return BufferUtil.concat(parts);
	}
	return block;
}
