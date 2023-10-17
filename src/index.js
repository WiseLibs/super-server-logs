'use strict';
const MAX_POOL_SLICE_SIZE = Buffer.poolSize >> 1;

Object.assign(require('./shared/buffer-util'), {
	isFastAllocation(byteLength) {
		return byteLength <= MAX_POOL_SLICE_SIZE;
	},
	alloc(byteLength) {
		return Buffer.allocUnsafe(byteLength);
	},
	from(values) {
		return Buffer.from(values);
	},
	normalize(input) {
		if (Buffer.isBuffer(input)) return input;
		return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
	},
	copy(input, output, outputOffset, inputBegin, inputEnd) {
		input.copy(output, outputOffset, inputBegin, inputEnd);
	},
	toString(input, inputBegin, inputEnd) {
		return input.toString('utf8', inputBegin, inputEnd);
	},
});

Object.assign(require('./shared/common'), {
	compress: require('zlib').deflateSync,
	decompress: require('zlib').inflateSync,
});

exports.LogEntry = require('./shared/log-entry');
exports.LogReader = require('./shared/log-reader');
exports.BulkParser = require('./shared/bulk-parser');
exports.Vfs = require('./shared/vfs');
exports.LogDirectorySource = require('./nodejs/log-directory-source');
exports.LogManager = require('./nodejs/log-manager');
exports.MasterLogger = require('./nodejs/master-logger');
exports.WorkerLogger = require('./nodejs/worker-logger');
exports.RequestLogger = require('./nodejs/request-logger');
Object.assign(exports, require('./shared/public-enums'));
