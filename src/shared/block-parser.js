'use strict';
const Msgpack = require('tiny-msgpack');
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

	const isCompressed = block[block.byteLength - 1] & 1;

	block = block.subarray(0, block.byteLength - TRAILER_LENGTH);
	block = unescapeBlock(block);
	block = isCompressed ? decompress(block) : block;

	return Msgpack.decode(block);
};

exports.parseEach = (block) => {
	if (!(block instanceof Uint8Array)) {
		throw new TypeError('Expected block to be a Uint8Array');
	}
	if (!block.byteLength) {
		throw new RangeError('Unexpected empty block');
	}

	const isCompressed = block[block.byteLength - 1] & 1;

	block = block.subarray(0, block.byteLength - TRAILER_LENGTH);
	block = unescapeBlock(block);
	block = isCompressed ? decompress(block) : block;

	return Msgpack.decodeEach(block);
};

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
