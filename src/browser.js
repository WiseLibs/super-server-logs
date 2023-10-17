'use strict';
const DECODER = new TextDecoder();
const POOL_SIZE = 1024 * 8;
const MAX_POOL_SLICE_SIZE = POOL_SIZE / 4;
let POOL = new ArrayBuffer(POOL_SIZE);
let POOL_OFFSET = 0;

Object.assign(require('./shared/buffer-util'), {
	isFastAllocation(byteLength) {
		return byteLength <= MAX_POOL_SLICE_SIZE;
	},
	alloc(byteLength) {
		if (byteLength <= MAX_POOL_SLICE_SIZE) {
			if (POOL_OFFSET + byteLength > POOL_SIZE) {
				POOL = new ArrayBuffer(POOL_SIZE);
				POOL_OFFSET = 0;
			}
			const output = new Uint8Array(POOL, POOL_OFFSET, byteLength);
			POOL_OFFSET += byteLength;
			return output;
		}
		return new Uint8Array(byteLength);
	},
	from(values) {
		return new Uint8Array(values);
	},
	normalize(input) {
		return input;
	},
	copy(input, output, inputBegin, inputEnd) {
		output.set(input.subarray(inputBegin, inputEnd));
	},
	toString(input, inputBegin, inputEnd) {
		return DECODER.decode(input.subarray(inputBegin, inputEnd));
	},
});

Object.assign(require('./shared/common'), {
	compress: require('pako').deflate,
	decompress: require('pako').inflate,
});

exports.LogEntry = require('./shared/log-entry');
exports.LogReader = require('./shared/log-reader');
exports.BulkParser = require('./shared/bulk-parser');
exports.Vfs = require('./shared/vfs');
Object.assign(exports, require('./shared/public-enums'));
