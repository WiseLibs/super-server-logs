'use strict';
const cluster = require('cluster');
const Logger = require('./logger');
const RequestLogger = require('./request-logger');
const ExceptionUtil = require('./exception-util');
const LimitQueue = require('./limit-queue');
const EventTypes = require('./event-types');

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
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.WORKER_STARTED, this._workerId, this._nonce()]).flush();
		this._pingTimer.refresh();
		return this;
	}

	WORKER_GOING_ONLINE() {
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.WORKER_GOING_ONLINE, this._workerId, this._nonce()]).flush();
		this._pingTimer.refresh();
		return this;
	}

	WORKER_ONLINE() {
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.WORKER_ONLINE, this._workerId, this._nonce()]).flush();
		this._pingTimer.refresh();
		return this;
	}

	WORKER_GOING_OFFLINE() {
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.WORKER_GOING_OFFLINE, this._workerId, this._nonce()]).flush();
		this._pingTimer.refresh();
		return this;
	}

	WORKER_OFFLINE() {
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.WORKER_OFFLINE, this._workerId, this._nonce()]).flush();
		this._pingTimer.refresh();
		return this;
	}

	WORKER_DONE() {
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.WORKER_DONE, this._workerId, this._nonce()]).flush();
		this._pingTimer.refresh();
		return this;
	}

	WORKER_UNCAUGHT_EXCEPTION(err) {
		if (this._fd < 0) return this;
		const exceptionData = ExceptionUtil.encode(err, this._debugLogs.drain());
		super.log([Date.now(), EventTypes.WORKER_UNCAUGHT_EXCEPTION, this._workerId, this._nonce(), exceptionData]);
		this._pingTimer.refresh();
		return this;
	}

	critical(data) {
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.WORKER_LOG_CRITICAL, this._workerId, this._nonce(), data]);
		this._pingTimer.refresh();
		return this;
	}

	error(data) {
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.WORKER_LOG_ERROR, this._workerId, this._nonce(), data]);
		this._pingTimer.refresh();
		return this;
	}

	warn(data) {
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.WORKER_LOG_WARN, this._workerId, this._nonce(), data]);
		this._pingTimer.refresh();
		return this;
	}

	info(data) {
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.WORKER_LOG_INFO, this._workerId, this._nonce(), data]);
		this._pingTimer.refresh();
		return this;
	}

	debug(data) {
		if (this._fd < 0) return this;
		this._debugLogs.push([Date.now(), data]);
		return this;
	}

	log() {
		throw new TypeError('Private method');
	}

	rotate(filename) {
		if (this._fd < 0) return this;
		super.rotate(filename);
		this._ping().flush();
		this._pingTimer.refresh();
		return this;
	}

	close() {
		super.close();
		clearInterval(this._pingTimer);
		return this;
	}

	newRequest() {
		return new RequestLogger(this, this._logForRequest);
	}

	_logForRequest(data) {
		super.log(data);
		this._pingTimer.refresh();
	}

	_ping() {
		return super.log([Date.now(), EventTypes.WORKER_PING, this._workerId, this._nonce()]);
	}

	_nonce() {
		const nonce = this._nextNonce;
		this._nextNonce = nonce + 1 & 0xffff;
		return nonce;
	}
};
