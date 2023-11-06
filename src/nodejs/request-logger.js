'use strict';
const { v4: uuidV4, stringify: uuidStringify } = require('uuid');
const { Address4, Address6 } = require('ip-address');
const { REQUEST, REQUEST_META, RESPONSE, RESPONSE_FINISHED } = require('../shared/event-types');
const { REQUEST_LOG_CRITICAL, REQUEST_LOG_ERROR, REQUEST_LOG_WARN, REQUEST_LOG_INFO } = require('../shared/event-types');
const { HttpMethod } = require('../shared/public-enums');
const ExceptionUtil = require('../shared/exception-util');
const Writer = require('./writer');
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
			const writer = createWriter(REQUEST, parent, this._requestIdBuffer);
			writeRequest(writer, req);
			this._logFn.call(parent, writer.done());
		}
		return this;
	}

	REQUEST_META(data) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			const writer = createWriter(REQUEST_META, parent, this._requestIdBuffer);
			this._logFn.call(parent, writer.json(data).done());
		}
		return this;
	}

	RESPONSE(statusCode, err, isExpectedError = false) {
		if (!Number.isInteger(statusCode)) {
			throw new TypeError('Expected statusCode to be an integer');
		}
		if (typeof isExpectedError !== 'boolean') {
			throw new TypeError('Expected third argument to be a boolean, if provided');
		}
		const parent = this._parent;
		if (parent._fd >= 0) {
			const writer = createWriter(RESPONSE, parent, this._requestIdBuffer);

			if (err == null) {
				writer.string('');
				writer.uint8(0);
			} else {
				writer.json(ExceptionUtil.encode(err, this._debugLogs, isExpectedError));
				writer.uint8(isExpectedError ? 1 : 0);
				this._debugLogs = null;
			}

			this._logFn.call(parent, writer.dynamicInteger(statusCode).done());
		}
		return this;
	}

	RESPONSE_FINISHED(err) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			const writer = createWriter(RESPONSE_FINISHED, parent, this._requestIdBuffer);

			if (err == null) {
				writer.string('');
			} else {
				writer.json(ExceptionUtil.encode(err, this._debugLogs));
				this._debugLogs = null;
			}

			this._logFn.call(parent, writer.done());
		}
		return this;
	}

	critical(data) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			const writer = createWriter(REQUEST_LOG_CRITICAL, parent, this._requestIdBuffer);
			this._logFn.call(parent, writer.json(data).done());
		}
		return this;
	}

	error(data) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			const writer = createWriter(REQUEST_LOG_ERROR, parent, this._requestIdBuffer);
			this._logFn.call(parent, writer.json(data).done());
		}
		return this;
	}

	warn(data) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			const writer = createWriter(REQUEST_LOG_WARN, parent, this._requestIdBuffer);
			this._logFn.call(parent, writer.json(data).done());
		}
		return this;
	}

	info(data) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			const writer = createWriter(REQUEST_LOG_INFO, parent, this._requestIdBuffer);
			this._logFn.call(parent, writer.json(data).done());
		}
		return this;
	}

	debug(data) {
		const parent = this._parent;
		if (parent._fd >= 0) {
			const debugLogs = this._debugLogs || (this._debugLogs = []);
			debugLogs.push([Date.now(), data]);
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

function createWriter(eventType, parent, requestId) {
	return new Writer()
		.uint8(eventType)
		.uint48(Date.now())
		.uint16(parent._nonce())
		.dynamicInteger(parent._workerId)
		.bytes(requestId);
}

function writeRequest(writer, req) {
	const methodEnumValue = HttpMethod[req.method];
	const isUnknownMethod = methodEnumValue === undefined;
	const ipAddressString = req.socket.remoteAddress;
	const isIPv6Address = ipAddressString.includes(':');
	const flagByte = (req.httpVersionMajor & 0b111) << 3
		| req.httpVersionMinor & 0b111
		| (isIPv6Address ? 0b01000000 : 0)
		| (isUnknownMethod ? 0b10000000 : 0);

	writer.uint8(flagByte);

	if (isIPv6Address) {
		writer.bytes(encodeIPv6(ipAddressString));
	} else {
		writer.uint32(encodeIPv4(ipAddressString));
	}

	if (isUnknownMethod) {
		writer.string(req.method);
	} else {
		writer.uint8(methodEnumValue);
	}

	writer.string(req.url);
}

function encodeIPv6(ipAddressString) {
	const bytes = new Address6(ipAddressString).toUnsignedByteArray();
	if (bytes.length === 16) return Buffer.from(bytes);
	const buffer = Buffer.allocUnsafe(16).fill(0);
	buffer.set(bytes, 16 - bytes.length);
	return buffer;
}

function encodeIPv4(ipAddressString) {
	const bytes = new Address4(ipAddressString).toArray();
	return bytes[0] * 0x1000000 +
		(bytes[1] << 16 |
		bytes[2] << 8 |
		bytes[3]);
}
