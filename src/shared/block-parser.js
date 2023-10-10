'use strict';
const Msgpack = require('tiny-msgpack');
const Paper = require('tiny-msgpack/lib/paper');
const decode = require('tiny-msgpack/lib/decode');
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

exports.parseAll = (block) => {
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

	const logs = [];
	const decoder = new Paper();
	decoder.setBuffer(block);

	while (decoder.offset < block.byteLength) {
		logs.push(decode(decoder));
	}

	return logs;
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
