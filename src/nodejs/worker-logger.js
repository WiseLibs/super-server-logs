'use strict';
const cluster = require('cluster');
const EventTypes = require('../shared/event-types');
const ExceptionUtil = require('../shared/exception-util');
const RequestLogger = require('./request-logger');
const LimitQueue = require('./limit-queue');
const Writer = require('./writer');
const Logger = require('./logger');

const WORKER_ID = cluster.isWorker ? cluster.worker.id : null;

/*
	A logger for recording changes within a server cluster's worker process.
 */

module.exports = class WorkerLogger extends Logger {
	constructor(filename, { pingDelay = 1000 * 60, debugLogLimit = 100, workerId = WORKER_ID, ...options } = {}) {
		if (!Number.isInteger(pingDelay)) {
			throw new TypeError('Expected options.pingDelay to be an integer');
		}
		if (!Number.isInteger(debugLogLimit)) {
			throw new TypeError('Expected options.debugLogLimit to be an integer');
		}
		if (!Number.isInteger(workerId)) {
			throw new TypeError('Expected options.workerId to be an integer');
		}
		if (pingDelay < 1) {
			throw new RangeError('Expected options.pingDelay to be at least 1 ms');
		}
		if (pingDelay > 0x7fffffff) {
			throw new RangeError('Expected options.pingDelay to be no greater than 2147483647');
		}
		if (debugLogLimit < 0) {
			throw new RangeError('Expected options.debugLogLimit to be non-negative');
		}
		if (workerId <= 0) {
			throw new RangeError('Expected options.workerId to be positive');
		}

		super(filename, options);
		this._pingTimer = null;
		this._workerId = workerId;
		this._debugLogs = new LimitQueue(debugLogLimit);
		this._nextNonce = 0;

		if (this._fd >= 0) {
			this._pingTimer = setInterval(this._ping.bind(this), pingDelay).unref();
		}
	}

	WORKER_STARTED() {
		if (this._fd >= 0) this._lifecycle(EventTypes.WORKER_STARTED).flush();
		return this;
	}

	WORKER_GOING_ONLINE() {
		if (this._fd >= 0) this._lifecycle(EventTypes.WORKER_GOING_ONLINE).flush();
		return this;
	}

	WORKER_ONLINE() {
		if (this._fd >= 0) this._lifecycle(EventTypes.WORKER_ONLINE).flush();
		return this;
	}

	WORKER_GOING_OFFLINE() {
		if (this._fd >= 0) this._lifecycle(EventTypes.WORKER_GOING_OFFLINE).flush();
		return this;
	}

	WORKER_OFFLINE() {
		if (this._fd >= 0) this._lifecycle(EventTypes.WORKER_OFFLINE).flush();
		return this;
	}

	WORKER_DONE() {
		if (this._fd >= 0) this._lifecycle(EventTypes.WORKER_DONE).flush();
		return this;
	}

	UNCAUGHT_EXCEPTION(err) {
		if (this._fd >= 0) {
			super.log(new Writer()
				.uint8(EventTypes.WORKER_UNCAUGHT_EXCEPTION)
				.uint48(Date.now())
				.uint16(this._nonce())
				.dynamicInteger(this._workerId)
				.json(ExceptionUtil.encode(err, this._debugLogs.drain()))
				.done()
			);
			this._pingTimer.refresh();
		}
		return this;
	}

	critical(data) {
		if (this._fd >= 0) this._log(EventTypes.WORKER_LOG_CRITICAL, data);
		return this;
	}

	error(data) {
		if (this._fd >= 0) this._log(EventTypes.WORKER_LOG_ERROR, data);
		return this;
	}

	warn(data) {
		if (this._fd >= 0) this._log(EventTypes.WORKER_LOG_WARN, data);
		return this;
	}

	info(data) {
		if (this._fd >= 0) this._log(EventTypes.WORKER_LOG_INFO, data);
		return this;
	}

	debug(data) {
		if (this._fd >= 0) this._debugLogs.push([Date.now(), data]);
		return this;
	}

	log() {
		throw new TypeError('Private method');
	}

	rotate(filename) {
		if (this._fd >= 0) {
			super.rotate(filename);
			this._ping().flush();
			this._pingTimer.refresh();
		}
		return this;
	}

	close() {
		super.close();
		clearInterval(this._pingTimer);
		return this;
	}

	newRequest() {
		return new RequestLogger(this, this._requestLoggerFn);
	}

	_requestLoggerFn(data) {
		super.log(data);
		this._pingTimer.refresh();
	}

	_lifecycle(eventType) {
		super.log(new Writer()
			.uint8(eventType)
			.uint48(Date.now())
			.uint16(this._nonce())
			.dynamicInteger(this._workerId)
			.done()
		);
		this._pingTimer.refresh();
		return this;
	}

	_log(eventType, data) {
		super.log(new Writer()
			.uint8(eventType)
			.uint48(Date.now())
			.uint16(this._nonce())
			.dynamicInteger(this._workerId)
			.json(data)
			.done()
		);
		this._pingTimer.refresh();
		return this;
	}

	_ping() {
		return super.log(new Writer()
			.uint8(EventTypes.WORKER_PING)
			.uint48(Date.now())
			.uint16(this._nonce())
			.dynamicInteger(this._workerId)
			.done()
		);
	}

	_nonce() {
		const nonce = this._nextNonce;
		this._nextNonce = nonce + 1 & 0xffff;
		return nonce;
	}
};
