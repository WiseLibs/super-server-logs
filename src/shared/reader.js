'use strict';
const BYTE_SLICE = Uint8Array.prototype.slice;
const BYTE_COPY = Buffer.prototype.copy; // TODO: not available in browsers
const TO_STRING = Buffer.prototype.toString; // TODO: not available in browsers
const POOL_SIZE = 1024 * 8;
const MAX_POOL_SLICE_SIZE = POOL_SIZE / 4;
let POOL = new ArrayBuffer(POOL_SIZE);
let POOL_OFFSET = 0;

/*
	This class provides the low-level functions for reading binary-format logs.
 */

module.exports = class Reader {
	constructor(input) {
		if (!(input instanceof Uint8Array)) {
			throw new TypeError('Expected input to be a Uint8Array');
		}

		this.input = input;
		this.offset = 0;
	}

	uint8() {
		const { input } = this;
		if (this.offset >= input.byteLength) {
			throw new RangeError('BUFFER_SHORTAGE');
		}

		return input[this.offset++];
	}

	uint16() {
		const { input } = this;
		if (this.offset + 2 > input.byteLength) {
			throw new RangeError('BUFFER_SHORTAGE');
		}

		return input[this.offset++] << 8 | input[this.offset++];
	}

	uint32() {
		const { input } = this;
		if (this.offset + 4 > input.byteLength) {
			throw new RangeError('BUFFER_SHORTAGE');
		}

		return input[this.offset++] * 0x1000000 +
			(input[this.offset++] << 16 |
			input[this.offset++] << 8 |
			input[this.offset++]);
	}

	uint48() {
		const { input } = this;
		if (this.offset + 6 > input.byteLength) {
			throw new RangeError('BUFFER_SHORTAGE');
		}

		return (
			input[this.offset++] * 0x1000000 +
			(input[this.offset++] << 16 |
			input[this.offset++] << 8 |
			input[this.offset++])
		) * 0x10000 + (
			input[this.offset++] << 8 |
			input[this.offset++]
		);
	}

	bytes(byteLength) {
		if (!Number.isInteger(byteLength)) {
			throw new TypeError('Expected byteLength to be an integer');
		}

		const { input } = this;
		if (this.offset + byteLength > input.byteLength) {
			throw new RangeError('BUFFER_SHORTAGE');
		}

		if (byteLength <= MAX_POOL_SLICE_SIZE) {
			if (POOL_OFFSET + byteLength > POOL_SIZE) {
				POOL = new ArrayBuffer(POOL_SIZE);
				POOL_OFFSET = 0;
			}

			const output = new Uint8Array(POOL, POOL_OFFSET, byteLength);
			POOL_OFFSET += byteLength;
			BYTE_COPY.call(input, output, 0, this.offset, this.offset += byteLength);
			return output;
		}

		// TODO: BYTE_SLICE could return a Buffer, but it should always be a Uint8Array
		return BYTE_SLICE.call(input, this.offset, this.offset += byteLength);
	}

	string() {
		const byteLength = this.dynamicInteger();
		if (byteLength === 0) {
			return '';
		}

		const { input } = this;
		if (this.offset + byteLength > input.byteLength) {
			throw new RangeError('BUFFER_SHORTAGE');
		}

		if (byteLength <= 24) {
			return readUtf8(input, this.offset, this.offset += byteLength);
		} else {
			return TO_STRING.call(input, 'utf8', this.offset, this.offset += byteLength);
		}
	}

	dynamicInteger() {
		const { input } = this;
		if (this.offset >= input.byteLength) {
			throw new RangeError('BUFFER_SHORTAGE');
		}

		const firstByte = input[this.offset++];
		if (firstByte <= 0xfd) {
			return firstByte;
		} else if (firstByte === 0xfe) {
			return this.uint16();
		} else {
			return this.uint32();
		}
	}

	dynamicIntegerArray() {
		const length = this.dynamicInteger();
		const arr = new Array(length);
		for (let i = 0; i < length; ++i) {
			arr[i] = this.dynamicInteger();
		}
		return arr;
	}
};

// This decodes UTF-8 (given as part of a Uint8Array) to a string. Compared to
// native implementations such as TextDecoder and Buffer, this performs faster
// for small strings and worse for large strings.
function readUtf8(input, offset, offsetEnd) {
	const output = [];

	while (offset < offsetEnd) {
		const byte1 = input[offset++];
		if ((byte1 & 0x80) === 0) {
			// 1 byte
			output.push(byte1);
		} else if ((byte1 & 0xe0) === 0xc0) {
			// 2 bytes
			const byte2 = input[offset++] & 0x3f;
			output.push(((byte1 & 0x1f) << 6) | byte2);
		} else if ((byte1 & 0xf0) === 0xe0) {
			// 3 bytes
			const byte2 = input[offset++] & 0x3f;
			const byte3 = input[offset++] & 0x3f;
			output.push(((byte1 & 0x1f) << 12) | (byte2 << 6) | byte3);
		} else if ((byte1 & 0xf8) === 0xf0) {
			// 4 bytes
			const byte2 = input[offset++] & 0x3f;
			const byte3 = input[offset++] & 0x3f;
			const byte4 = input[offset++] & 0x3f;
			let unit = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
			if (unit > 0xffff) {
				unit -= 0x10000;
				output.push(((unit >>> 10) & 0x3ff) | 0xd800);
				unit = 0xdc00 | (unit & 0x3ff);
			}
			output.push(unit);
		} else {
			output.push(byte1);
		}
	}

	return String.fromCharCode.apply(String, output);
};
