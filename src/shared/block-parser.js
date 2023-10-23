'use strict';
const Reader = require('./reader');
const LogEntry = require('./log-entry');
const BufferUtil = require('./buffer-util');
const { decompress, unescapeBlock } = require('./common');

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
		const originalByte = block[0];
		block[0] = block[0] >> 4 | (block[0] & 0xf) << 4; // Restore zlib header
		try {
			return decompress(block);
		} finally {
			block[0] = originalByte; // Undo mutation
		}
	}
	return block;
}
