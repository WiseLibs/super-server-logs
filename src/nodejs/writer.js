'use strict';
const { normalize } = require('../shared/buffer-util');

const MIN_BUFFER_PREALLOC_SIZE = 1024 * 2;
const MAX_BUFFER_PREALLOC_SIZE = 1024 * 64;

/*
	This class provides the low-level functions for writing binary-format logs.
	After writing, the resulting log's Buffer should be retreived via done().
	After done() is called, the writer instance must not be used anymore.
 */

module.exports = class Writer {
	constructor() {
		this._buffer = Buffer.allocUnsafe(MIN_BUFFER_PREALLOC_SIZE);
		this._offset = 0;
		this._start = 0;
		this._buffers = undefined;
	}

	_push(chunk) {
		const buffers = this._buffers || (this._buffers = []);
		buffers.push(chunk);
	}

	_write(chunk) {
		const offset = this._offset;
		const endOffset = offset + chunk.byteLength;
		if (endOffset <= this._buffer.byteLength) {
			this._buffer.set(chunk, offset);
			this._offset = endOffset;
		} else {
			if (this._start < offset) {
				this._push(this._buffer.subarray(this._start, offset));
				this._start = offset;
			}
			this._push(chunk);
		}
	}

	_reserve(byteLength) {
		const currentSize = this._buffer.byteLength;
		const offset = this._offset;
		if (offset + byteLength > currentSize) {
			if (this._start < offset) {
				this._push(this._buffer.subarray(this._start, offset));
			}
			this._start = 0;
			this._offset = 0;
			this._buffer = Buffer.allocUnsafe(
				Math.max(byteLength, Math.min(currentSize * 2, MAX_BUFFER_PREALLOC_SIZE))
			);
		}
	}

	done() {
		const buffers = this._buffers;
		if (!buffers) {
			return this._buffer.subarray(0, this._offset);
		} else if (buffers.length === 1 && this._offset === 0) {
			return buffers[0];
		} else {
			if (this._start < this._offset) {
				buffers.push(this._buffer.subarray(this._start, this._offset));
			}
			return Buffer.concat(buffers);
		}
	}

	uint8(value) {
		if (!Number.isInteger(value)) {
			throw new TypeError('Expected value to be an integer');
		}

		this._reserve(1);
		this._buffer[this._offset++] = value;
		return this;
	}

	uint16(value) {
		if (!Number.isInteger(value)) {
			throw new TypeError('Expected value to be an integer');
		}

		this._reserve(2);
		const buffer = this._buffer;
		buffer[this._offset++] = value >>> 8;
		buffer[this._offset++] = value;
		return this;
	}

	uint32(value) {
		if (!Number.isInteger(value)) {
			throw new TypeError('Expected value to be an integer');
		}

		this._reserve(4);
		const buffer = this._buffer;
		buffer[this._offset++] = value >>> 24;
		buffer[this._offset++] = value >>> 16;
		buffer[this._offset++] = value >>> 8;
		buffer[this._offset++] = value;
		return this;
	}

	uint48(value) {
		if (!Number.isInteger(value)) {
			throw new TypeError('Expected value to be an integer');
		}

		this._reserve(6);
		const buffer = this._buffer;
		const high32 = value / 0x10000 >>> 0;
		const low32 = value >>> 0;
		buffer[this._offset++] = high32 >>> 24;
		buffer[this._offset++] = high32 >>> 16;
		buffer[this._offset++] = high32 >>> 8;
		buffer[this._offset++] = high32;
		buffer[this._offset++] = low32 >>> 8;
		buffer[this._offset++] = low32;
		return this;
	}

	bytes(data) {
		if (!(data instanceof Uint8Array)) {
			throw new TypeError('Expected data to be a Uint8Array');
		}
		if (!data.byteLength) {
			return this;
		}

		this._write(normalize(data));
		return this;
	}

	string(str) {
		if (typeof str !== 'string') {
			throw new TypeError('Expected str to be a string');
		}
		if (!str) {
			this.dynamicInteger(0);
			return this;
		}

		const data = Buffer.from(str);
		this.dynamicInteger(data.byteLength);
		this._write(data);
		return this;
	}

	json(value) {
		const json = JSON.stringify(value, jsonReplacer);
		if (!json) {
			throw new TypeError('Expected some valid JSON data');
		}

		return this.string(json);
	}

	dynamicInteger(value) {
		if (!Number.isInteger(value)) {
			throw new TypeError('Expected value to be an integer');
		}

		value >>>= 0;

		if (value <= 0xfd) {
			this._reserve(1);
			this._buffer[this._offset++] = value;
		} else if (value <= 0xffff) {
			this._reserve(3);
			const buffer = this._buffer;
			buffer[this._offset++] = 0xfe;
			buffer[this._offset++] = value >>> 8;
			buffer[this._offset++] = value;
		} else {
			this._reserve(5);
			const buffer = this._buffer;
			buffer[this._offset++] = 0xff;
			buffer[this._offset++] = value >>> 24;
			buffer[this._offset++] = value >>> 16;
			buffer[this._offset++] = value >>> 8;
			buffer[this._offset++] = value;
		}

		return this;
	}

	dynamicIntegerArray(values) {
		if (!Array.isArray(values)) {
			throw new TypeError('Expected values to be an array');
		}

		this.dynamicInteger(values.length);
		for (let i = 0; i < values.length; ++i) {
			this.dynamicInteger(values[i]);
		}

		return this;
	}
};

function jsonReplacer(key, value) {
	if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
		if (value.type === 'Buffer' && Array.isArray(value.data)) {
			return;
		}
		if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
			return;
		}
	}
	return value;
}
