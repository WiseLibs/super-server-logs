'use strict';
exports.LogManager = require('./writer/log-manager');
exports.MasterLogger = require('./writer/master-logger');
exports.WorkerLogger = require('./writer/worker-logger');
exports.RequestLogger = require('./writer/request-logger');
exports.LogReader = require('./reader/log-reader');
exports.BulkParser = require('./reader/bulk-parser');
exports.Vfs = require('./reader/vfs');
exports.LogDirectorySource = require('./log-directory-source');

require('./reader/environment-util').define(async () => ({
	decompress: require('lz4-napi').uncompressSync,
}));
