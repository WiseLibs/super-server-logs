'use strict';
Object.assign(require('./shared/common'), {
	compress: require('pako').deflate,
	decompress: require('pako').inflate,
});

exports.LogEntry = require('./shared/log-entry');
exports.LogReader = require('./shared/log-reader');
exports.BulkParser = require('./shared/bulk-parser');
exports.Vfs = require('./shared/vfs');
Object.assign(exports, require('./shared/public-enums'));
