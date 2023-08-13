'use strict';
const { openSync, closeSync, writevSync } = require('fs');

const NEWLINE = Buffer.from('\n');

/*
	A generic logger that writes lines of JSON to a file. It buffers its output
	until either the highWaterMark is reached (in bytes) or the outputDelay time
	has passed (in milliseconds). When the logger is closed, all remaining
	buffered data is flushed synchronously.
 */

module.exports = class Logger {
	constructor(filename, { highWaterMark = 1024 * 32, outputDelay = 10 } = {}, flags = 'a') {
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

		this._fd = filename === null ? -1 : openSync(filename, flags);
		this._outgoing = [];
		this._outgoingSize = 0;
		this._highWaterMark = highWaterMark;
		this._outputDelay = outputDelay;
		this._timer = null;
		this._flush = flush.bind(this);
		this._flags = flags;
	}

	log(data) {
		const json = JSON.stringify(data);
		if (typeof json !== 'string') {
			throw new TypeError('The given data is not serializable as JSON');
		}
		if (this._fd < 0) {
			return this;
		}

		const buffer = Buffer.from(json);
		this._outgoing.push(buffer, NEWLINE);
		this._outgoingSize += buffer.byteLength + 1;

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

		this.close();
		this._fd = openSync(filename, this._flags);

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

function flush() {
	writevSync(this._fd, this._outgoing);
	this._outgoing = [];
	this._outgoingSize = 0;

	if (this._timer !== null) {
		clearTimeout(this._timer);
		this._timer = null;
	}
}
