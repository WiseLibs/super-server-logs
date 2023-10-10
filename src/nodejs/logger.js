'use strict';
const { openSync, closeSync, writevSync } = require('fs');
const { encode } = require('tiny-msgpack');
const { compress } = require('../shared/common');

/*
	A generic logger that writes MessagePack blobs to a file. It buffers its
	output until either the highWaterMark is reached (in bytes) or the
	outputDelay time has passed (in milliseconds). When the logger is closed,
	all remaining buffered data is flushed synchronously.

	Whenever a group of logs are flushed to disk, they are first concatenated
	into a single block, then compressed (except when their total size is very
	small), and then a trailer is appended to the end of the block, which serves
	as a separator between blocks. Any separators that appear within a block are
	escaped, although the need for that is rare in practice.
 */

module.exports = class Logger {
	constructor(filename, { highWaterMark = 1024 * 32, outputDelay = 100 } = {}) {
		if (typeof filename !== 'string' && filename !== null) {
			throw new TypeError('Expected filename to be a string or null');
		}
		if (!Number.isInteger(highWaterMark)) {
			throw new TypeError('Expected options.highWaterMark to be an integer');
		}
		if (!Number.isInteger(outputDelay)) {
			throw new TypeError('Expected options.outputDelay to be an integer');
		}
		if (highWaterMark < 0) {
			throw new RangeError('Expected options.highWaterMark to be non-negative');
		}
		if (outputDelay < 0) {
			throw new RangeError('Expected options.outputDelay to be non-negative');
		}
		if (outputDelay > 0x7fffffff) {
			throw new RangeError('Expected options.outputDelay to be no greater than 2147483647');
		}

		this._fd = filename === null ? -1 : openSync(filename, 'a');
		this._outgoing = [];
		this._outgoingSize = 0;
		this._highWaterMark = highWaterMark;
		this._outputDelay = outputDelay;
		this._timer = null;
		this._flush = flush.bind(this);
	}

	log(data) {
		const buffer = encode(data);
		if (this._fd < 0) {
			return this;
		}

		this._outgoing.push(buffer);
		this._outgoingSize += buffer.byteLength;

		if (this._outgoingSize >= this._highWaterMark || this._outputDelay === 0) {
			this._flush();
		} else if (this._timer === null) {
			this._timer = setTimeout(this._flush, this._outputDelay);
		}

		return this;
	}

	flush() {
		if (this._fd >= 0 && this._outgoingSize > 0) {
			this._flush();
		}

		return this;
	}

	rotate(filename) {
		if (typeof filename !== 'string') {
			throw new TypeError('Expected new filename to be a string');
		}
		if (this._fd < 0) {
			return this;
		}
		if (this._outgoingSize > 0) {
			this._flush();
		}

		closeSync(this._fd);
		this._fd = -1;

		try {
			this._fd = openSync(filename, 'a');
		} catch (err) {
			// If we can't open the new file, the Logger is closed.
			// Therefore, we call this.close() to allow subclasses to clean up.
			this.close();
			throw err;
		}

		return this;
	}

	close() {
		if (this._fd < 0) {
			return this;
		}
		if (this._outgoingSize > 0) {
			this._flush();
		}

		closeSync(this._fd);
		this._fd = -1;

		return this;
	}

	get closed() {
		return this._fd < 0;
	}
};

const ESCAPE = Buffer.from([0xc1, 0, 0xff, 0]);
const SEPARATOR = Buffer.from([0xc1, 0, 0xfe, 0]);
const TRAILER_UNCOMPRESSED = Buffer.concat([SEPARATOR, Buffer.from([0])]);
const TRAILER_COMPRESSED = Buffer.concat([SEPARATOR, Buffer.from([1])]);
const ESCAPED_ESCAPE = Buffer.concat([ESCAPE, Buffer.from([0])]);
const ESCAPED_SEPARATOR = Buffer.concat([ESCAPE, Buffer.from([1])]);
const MINIMUM_COMPRESSIBLE_SIZE = 128;

function flush() {
	const outgoing = this._outgoing;
	let block = outgoing.length > 1 ? Buffer.concat(outgoing) : outgoing[0];
	let trailer = TRAILER_UNCOMPRESSED;

	if (block.byteLength >= MINIMUM_COMPRESSIBLE_SIZE) {
		block = compress(block);
		trailer = TRAILER_COMPRESSED;
	}

	writevSync(this._fd, [escapeBlock(block), trailer]);
	this._outgoing = [];
	this._outgoingSize = 0;

	if (this._timer !== null) {
		clearTimeout(this._timer);
		this._timer = null;
	}
}

function escapeBlock(block) {
	let indexOfEscape = block.indexOf(ESCAPE);
	let indexOfSeparator = block.indexOf(SEPARATOR);
	if (indexOfEscape >= 0 || indexOfSeparator >= 0) {
		let offset = 0;
		const parts = [];
		do {
			if (indexOfSeparator < 0 || indexOfEscape >= 0 && indexOfEscape < indexOfSeparator) {
				parts.push(block.subarray(offset, indexOfEscape), ESCAPED_ESCAPE);
				offset = indexOfEscape + ESCAPE.byteLength;
				indexOfEscape = block.indexOf(ESCAPE, offset);
			} else {
				parts.push(block.subarray(offset, indexOfSeparator), ESCAPED_SEPARATOR);
				offset = indexOfSeparator + SEPARATOR.byteLength;
				indexOfSeparator = block.indexOf(SEPARATOR, offset);
			}
		} while (indexOfEscape >= 0 || indexOfSeparator >= 0);
		parts.push(block.subarray(offset));
		return Buffer.concat(parts);
	}
	return block;
}
