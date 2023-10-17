'use strict';
const Reader = require('./reader');
const LogEntry = require('./log-entry');
const BufferUtil = require('./buffer-util');
const { decompress } = require('./common');
const { ESCAPE, SEPARATOR, ESCAPE_CODE_ESCAPE, ESCAPE_CODE_SEPARATOR } = require('./common');

exports.parseOne = (block) => {
	if (!(block instanceof Uint8Array)) {
		throw new TypeError('Expected block to be a Uint8Array');
	}
	if (!block.byteLength) {
		throw new RangeError('Unexpected empty block');
	}

	return new LogEntry(new Reader(unwrapBlock(BufferUtil.normalize(block))));
};

exports.parseEach = (block) => {
	if (!(block instanceof Uint8Array)) {
		throw new TypeError('Expected block to be a Uint8Array');
	}
	if (!block.byteLength) {
		throw new RangeError('Unexpected empty block');
	}

	const reader = new Reader(unwrapBlock(BufferUtil.normalize(block)));
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
	block = block.subarray(0, -1);
	block = unescapeBlock(block);
	if (block[0] & 0x80) {
		block[0] = block[0] >> 4 | (block[0] & 0xf) << 4; // Restore zlib header
		block = decompress(block);
	}
	return block;
}

const ESCAPE_CHUNK = BufferUtil.from([ESCAPE]);
const SEPARATOR_CHUNK = BufferUtil.from([SEPARATOR]);

function unescapeBlock(block) {
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
}
