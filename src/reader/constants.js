'use strict';

exports.ESCAPE = new Uint8Array([0xc1, 0, 0xff, 0]);
exports.SEPARATOR = new Uint8Array([0xc1, 0, 0xfe, 0]);
exports.TRAILER_LENGTH = exports.SEPARATOR.byteLength + 1;
exports.ESCAPED_SEQUENCE_LENGTH = exports.ESCAPE.byteLength + 1;
