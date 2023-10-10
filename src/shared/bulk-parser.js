'use strict';
const BufferUtil = require('./buffer-util');
const BlockParser = require('./block-parser');
const { findNextSeparator, findPrevSeparator } = require('./common');
const { TRAILER_LENGTH } = require('./constants');

exports.read = async function* read(input) {
	let outputBuffer = new Uint8Array();

	for await (const data of input) {
		if (!(data instanceof Uint8Array)) {
			throw new TypeError('Expected data to be a Uint8Array');
		}

		if (outputBuffer.byteLength > 0) {
			outputBuffer = BufferUtil.concat([outputBuffer, data]);
		} else {
			outputBuffer = data;
		}

		let offset = 0;
		for (;;) {
			const prevOffset = offset;
			const indexOfSeparator = findNextSeparator(outputBuffer, prevOffset);
			if (indexOfSeparator >= 0) {
				offset = indexOfSeparator + TRAILER_LENGTH;
				yield outputBuffer.subarray(prevOffset, offset);
			} else {
				break;
			}
		}

		outputBuffer = outputBuffer.subarray(offset);
	}
};

exports.readReversed = async function* readReversed(input) {
	const inputBuffer = [];
	let inputBufferSize = 0;
	let currentChunkSize = -1;
	let outputBuffer = new Uint8Array();
	let newChunks = [];
	let isBlockBundary = false;

	for await (const data of input) {
		if (!(data instanceof Uint8Array)) {
			throw new TypeError('Expected data to be a Uint8Array');
		}

		inputBuffer.push(data);
		inputBufferSize += data.byteLength;

		for (;;) {
			if (currentChunkSize < 0) {
				if (inputBufferSize < 4) {
					break;
				}
				if (inputBuffer[0].byteLength < 4) {
					inputBuffer.unshift(BufferUtil.extractSize(inputBuffer, 4));
				}
				currentChunkSize = readUint32(inputBuffer[0]) + 4;
			}
			if (inputBufferSize >= currentChunkSize) {
				const chunk = BufferUtil.extractSize(inputBuffer, currentChunkSize);
				newChunks.push(chunk.subarray(4));
				inputBufferSize -= currentChunkSize;
				currentChunkSize = -1;
			} else {
				break;
			}
		}

		if (newChunks.length) {
			if (newChunks.length > 1 || outputBuffer.byteLength > 0) {
				outputBuffer = BufferUtil.concat([...newChunks.reverse(), outputBuffer]);
			} else {
				outputBuffer = newChunks[0];
			}

			let offset = outputBuffer.byteLength;
			for (;;) {
				const prevOffset = offset;
				const initialIndex = prevOffset - 1 - (isBlockBundary ? TRAILER_LENGTH : 0);
				const indexOfSeparator = findPrevSeparator(outputBuffer, initialIndex);
				if (indexOfSeparator >= 0) {
					offset = indexOfSeparator + TRAILER_LENGTH;
					if (isBlockBundary) {
						yield outputBuffer.subarray(offset, prevOffset);
					} else {
						isBlockBundary = true;
					}
				} else {
					break;
				}
			}

			outputBuffer = outputBuffer.subarray(0, offset);
			newChunks = [];
		}
	}

	if (isBlockBundary && outputBuffer.byteLength > 0) {
		yield outputBuffer;
	}
};

exports.parse = (block) => {
	// TODO: return an array of friendly log objects
	return BlockParser.parseAll(block);
};

function readUint32(chunk) {
	return (chunk[0] * 0x1000000) +
		((chunk[1] << 16) |
		(chunk[2] << 8) |
		chunk[3]);
}
