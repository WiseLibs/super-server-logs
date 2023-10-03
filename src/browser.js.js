'use strict';
exports.LogReader = require('./reader');
exports.Vfs = require('./reader/vfs');

require('./reader/environment-util').define(async () => ({
	decompress: (await import('@schickling-tmp/lz4-wasm-web')).decompress,
}));
