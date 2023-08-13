'use strict';
const { v4: uuidV4 } = require('uuid');
const WorkerLogger = require('./worker-logger');
const { WORKER_ID, REQUEST, REQUEST_LOG, RESPONSE, RESPONSE_FINISHED } = require('./constants');
const getExceptionData = require('./get-exception-data');

/*
	A logger for recording request/response pairs.
 */

module.exports = class RequestLogger {
	constructor(parent, logFn) {
		if (!(parent instanceof WorkerLogger)) {
			throw new TypeError('Expected parent to be a WorkerLogger');
		}
		if (typeof logFn !== 'function') {
			throw new TypeError('Expected logFn to be a function');
		}

		this._parent = parent;
		this._logFn = logFn;
		this.requestId = uuidV4();
	}

	REQUEST(req) {
		if (req == null || req.socket == null || typeof req.httpVersion !== 'string') {
			throw new TypeError('Expected req to be an HTTP request object');
		}
		if (this.parent._fd >= 0) {
			this._logFn.call(this._parent, [REQUEST, Date.now(), WORKER_ID, this.requestId,
				req.socket.remoteAddress, req.httpVersion, req.url, req.method]);
		}
		return this;
	}

	REQUEST_LOG(data) {
		if (this.parent._fd >= 0) {
			this._logFn.call(this._parent, [REQUEST_LOG, Date.now(), WORKER_ID, this.requestId, data]);
		}
		return this;
	}

	RESPONSE(statusCode, err) {
		if (!Number.isInteger(statusCode)) {
			throw new TypeError('Expected statusCode to be an integer');
		}
		if (this.parent._fd >= 0) {
			this._logFn.call(this._parent, [RESPONSE, Date.now(), WORKER_ID, this.requestId,
				statusCode, err == null ? null : getExceptionData(err)]);
		}
		return this;
	}

	RESPONSE_FINISHED() {
		if (this.parent._fd >= 0) {
			this._logFn.call(this._parent, [RESPONSE_FINISHED, Date.now(), WORKER_ID, this.requestId]);
		}
		return this;
	}

	log(data) {
		return this.REQUEST_LOG(data);
	}

	get closed() {
		return this._parent.closed;
	}
};
