'use strict';
Object.assign(require('./shared/common'), {
	compress: require('zlib').deflateSync,
	decompress: require('zlib').inflateSync,
});

exports.LogReader = require('./shared/log-reader');
exports.BulkParser = require('./shared/bulk-parser');
exports.Vfs = require('./shared/vfs');
exports.LogDirectorySource = require('./nodejs/log-directory-source');
exports.LogManager = require('./nodejs/log-manager');
exports.MasterLogger = require('./nodejs/master-logger');
exports.WorkerLogger = require('./nodejs/worker-logger');
exports.RequestLogger = require('./nodejs/request-logger');
