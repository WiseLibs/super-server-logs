'use strict';

/*
	This file exposes utilities that need different implementations depending on
	the current JavaScript environment. The utilities are defined in both
	index.js and browser.js. Other code can import this module and use the
	utilities without caring which implementation is being used.
 */

let initFn;
let promise;

exports.define = (fn) => {
	if (typeof fn !== 'function') {
		throw new TypeError('Expected fn to be a function');
	}
	if (initFn) {
		throw new TypeError('EnvironmentUtil was already defined');
	}

	initFn = fn;
};

exports.use = async () => {
	if (!initFn) {
		throw new TypeError('EnvironmentUtil was not yet defined');
	}
	if (!promise) {
		promise = Promise.resolve(initFn());
	}

	return promise;
};
