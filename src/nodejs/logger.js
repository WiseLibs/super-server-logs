'use strict';
const { openSync, closeSync, writevSync } = require('fs');
const { normalize } = require('../shared/buffer-util');
const { compress } = require('../shared/common');
const { SEPARATOR } = require('../shared/common');
const { escapeBlock } = require('./common');

/*
	A generic logger that writes binary chunks to a file. It buffers its output
	until either the highWaterMark is reached (in bytes) or the outputDelay time
	has passed (in milliseconds). When the logger is closed, all remaining
	buffered data is flushed synchronously.

	Whenever a group of logs are flushed to disk, they are first concatenated
	into a single block, then compressed (except when their total size is very
	small), and then a separator byte is appended to the end of the block. Any
	separators that appear within a block are escaped.
 */

module.exports = class Logger {
	constructor(filename, { highWaterMark = 1024 * 32, outputDelay = 100, compression = true } = {}) {
		if (typeof filename !== 'string' && filename !== null) {
			throw new TypeError('Expected filename to be a string or null');
		}
		if (!Number.isInteger(highWaterMark)) {
			throw new TypeError('Expected options.highWaterMark to be an integer');
		}
		if (!Number.isInteger(outputDelay)) {
			throw new TypeError('Expected options.outputDelay to be an integer');
		}
		if (typeof compression !== 'boolean') {
			throw new TypeError('Expected options.compression to be a boolean');
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
		this._compression = compression;
		this._timer = null;
		this._flush = flush.bind(this);
	}

	log(data) {
		if (!(data instanceof Uint8Array)) {
			throw new TypeError('Expected argument to be a Uint8Array');
		}
		if (this._fd < 0) {
			return this;
		}

		this._outgoing.push(normalize(data));
		this._outgoingSize += data.byteLength;

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

const SEPARATOR_CHUNK = Buffer.from([SEPARATOR]);
const COMPRESSION_THRESHOLD = 400;

function flush() {
	const outgoing = this._outgoing;
	let block = outgoing.length > 1 ? Buffer.concat(outgoing) : outgoing[0];

	if (this._compression && (outgoing.length > 1 || block.byteLength >= COMPRESSION_THRESHOLD)) {
		block = compress(block);
		// We swap the two 4-bit fields of the zlib header, thus ensuring that
		// the block's first byte always has a 1 as its most significant bit.
		// This is how parsers know the block is compressed; uncompressed blocks
		// will never start with a 1 as the most significant bit, because there
		// are no EventTypes > 127.
		block[0] = block[0] >> 4 | (block[0] & 0xf) << 4;
	}

	writevSync(this._fd, [escapeBlock(block), SEPARATOR_CHUNK]);
	this._outgoing = [];
	this._outgoingSize = 0;

	if (this._timer !== null) {
		clearTimeout(this._timer);
		this._timer = null;
	}
}
