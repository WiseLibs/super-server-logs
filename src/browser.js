'use strict';
exports.LogReader = require('./reader/log-reader');
exports.BulkParser = require('./reader/bulk-parser');
exports.Vfs = require('./reader/vfs');

require('./reader/environment-util').define(async () => ({
	decompress: (await import('@schickling-tmp/lz4-wasm-web')).decompress,
}));
