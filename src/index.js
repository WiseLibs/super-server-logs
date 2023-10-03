'use strict';
exports.LogManager = require('./log-manager');
exports.MasterLogger = require('./master-logger');
exports.WorkerLogger = require('./worker-logger');
exports.RequestLogger = require('./request-logger');
exports.LogReader = require('./reader');
exports.Vfs = require('./reader/vfs');

require('./reader/environment-util').define(async () => ({
	decompress: require('lz4-napi').uncompressSync,
}));
