'use strict'

exports.ESCAPE = 0xf8;
exports.SEPARATOR = 0xfa;
exports.ESCAPE_CODE_ESCAPE = 0xf8;
exports.ESCAPE_CODE_SEPARATOR = 0xf9;

exports.compress = () => {
	throw new TypeError('Bootstrapping required by index.js or browser.js');
};

exports.decompress = () => {
	throw new TypeError('Bootstrapping required by index.js or browser.js');
};
