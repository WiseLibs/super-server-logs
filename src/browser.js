'use strict';
Object.assign(require('./shared/common'), {
	compress: require('pako').deflate,
	decompress: require('pako').inflate,
});

exports.LogReader = require('./shared/log-reader');
exports.BulkParser = require('./shared/bulk-parser');
exports.Vfs = require('./shared/vfs');
