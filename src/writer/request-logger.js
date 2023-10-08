'use strict';
const { v4: uuidV4, stringify: uuidStringify } = require('uuid');
const { Address4, Address6 } = require('ip-address');
const { REQUEST, REQUEST_META, RESPONSE, RESPONSE_FINISHED } = require('../shared/event-types');
const { REQUEST_LOG_CRITICAL, REQUEST_LOG_ERROR, REQUEST_LOG_WARN, REQUEST_LOG_INFO } = require('../shared/event-types');
const ExceptionUtil = require('../shared/exception-util');
const Logger = require('./logger');

/*
	A logger for recording request/response pairs. Each RequestLogger is
	automatically assigned a UUID "requestId", which is automatically included
	in any logs that it writes. The requestId can therefore be used by
	applications to identify a specific request and to find its related logs.
 */

module.exports = class RequestLogger {
	constructor(parent, logFn) {
		if (!(parent instanceof Logger)) {
			throw new TypeError('Expected parent to be a Logger');
		}
		if (!Number.isInteger(parent._workerId)) {
			throw new TypeError('Expected parent to be a WorkerLogger');
		}
		if (typeof logFn !== 'function') {
			throw new TypeError('Expected logFn to be a function');
		}

		this._parent = parent;
		this._logFn = logFn;
		this._requestIdString = '';
		this._requestIdBuffer = Buffer.allocUnsafe(16);
		this._debugLogs = null;

		uuidV4(undefined, this._requestIdBuffer);
	}

	REQUEST(req) {
		if (req == null || req.socket == null || typeof req.httpVersionMajor !== 'number') {
			throw new TypeError('Expected req to be an HTTP request object');
		}
		const parent = this._parent;
		if (parent._fd >= 0) {
			this._logFn.call(parent, [Date.now(), REQUEST, parent._workerId, parent._nonce(),
				this._requestIdBuffer, encodeIpAddress(req.socket.remoteAddress),
				req.httpVersionMajor, req.httpVersionMinor, req.url, encodeHttpMethod(req.method)]);
		}
		return this;
	}

	REQUEST_META(data) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			this._logFn.call(parent, [Date.now(), REQUEST_META, parent._workerId, parent._nonce(),
				this._requestIdBuffer, data]);
		}
		return this;
	}

	RESPONSE(statusCode, err) {
		if (!Number.isInteger(statusCode)) {
			throw new TypeError('Expected statusCode to be an integer');
		}
		const parent = this._parent;
		if (parent._fd >= 0) {
			const exceptionData = err == null ? null : ExceptionUtil.encode(err, this._debugLogs);
			this._debugLogs = null;
			this._logFn.call(parent, [Date.now(), RESPONSE, parent._workerId, parent._nonce(),
				this._requestIdBuffer, statusCode, exceptionData]);
		}
		return this;
	}

	RESPONSE_FINISHED(err) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			const exceptionData = err == null ? null : ExceptionUtil.encode(err, this._debugLogs);
			this._debugLogs = null;
			this._logFn.call(parent, [Date.now(), RESPONSE_FINISHED, parent._workerId, parent._nonce(),
				this._requestIdBuffer, exceptionData]);
		}
		return this;
	}

	critical(data) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			this._logFn.call(parent, [Date.now(), REQUEST_LOG_CRITICAL, parent._workerId, parent._nonce(),
				this._requestIdBuffer, data]);
		}
		return this;
	}

	error(data) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			this._logFn.call(parent, [Date.now(), REQUEST_LOG_ERROR, parent._workerId, parent._nonce(),
				this._requestIdBuffer, data]);
		}
		return this;
	}

	warn(data) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			this._logFn.call(parent, [Date.now(), REQUEST_LOG_WARN, parent._workerId, parent._nonce(),
				this._requestIdBuffer, data]);
		}
		return this;
	}

	info(data) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			this._logFn.call(parent, [Date.now(), REQUEST_LOG_INFO, parent._workerId, parent._nonce(),
				this._requestIdBuffer, data]);
		}
		return this;
	}

	debug(data) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			if (!this._debugLogs) this._debugLogs = [];
			this._debugLogs.push([Date.now(), data]);
		}
		return this;
	}

	get closed() {
		return this._parent.closed;
	}

	get requestId() {
		if (!this._requestIdString) {
			this._requestIdString = uuidStringify(this._requestIdBuffer);
		}
		return this._requestIdString;
	}
};

// If given an IPv4 address, an equivalant big-endian integer is returned.
// If given an IPv6 address, an equivalant Buffer is returned, with any leading
// zeroes omitted.
function encodeIpAddress(ipAddressString) {
	if (ipAddressString.includes(':')) {
		const bytes = new Address6(ipAddressString).toUnsignedByteArray();
		let offset = 0;
		while (bytes[offset] === 0) offset += 1;
		if (offset === 0) return Buffer.from(bytes);
		return Buffer.from(bytes.slice(offset));
	} else {
		const bytes = new Address4(ipAddressString).toArray();
		return bytes[0] << 24
			| bytes[1] << 16
			| bytes[2] << 8
			| bytes[3];
	}
}

// Returns an integer corresponding to the given HTTP method given. If an
// unrecognized HTTP method was given, it is returned as-is.
// TODO: define these magic numbers in a way so they can be used for decoding too
function encodeHttpMethod(method) {
	switch (method) {
		case 'GET':
			return 0;
		case 'HEAD':
			return 1;
		case 'POST':
			return 2;
		case 'PUT':
			return 3;
		case 'PATCH':
			return 4;
		case 'DELETE':
			return 5;
		case 'OPTIONS':
			return 6;
		case 'TRACE':
			return 7;
		case 'CONNECT':
			return 8;
		default:
			return method;
	}
}
