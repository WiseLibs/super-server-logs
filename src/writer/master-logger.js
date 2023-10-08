'use strict';
const EventTypes = require('../shared/event-types');
const ExceptionUtil = require('../shared/exception-util');
const LimitQueue = require('./limit-queue');
const Logger = require('./logger');

/*
	A logger for recording changes within a server cluster's master process.

	This logger keeps track of which workers are alive via the STARTING_UP,
	WORKER_SPAWNED, and WORKER_EXITED events, and it uses this information to
	generate correct logs long after those events occur. Therefore, only a
	single MasterLogger instance should be used for the lifetime of a server
	cluster, or else the logs will likely become corrupted.
 */

module.exports = class MasterLogger extends Logger {
	constructor(filename, { pingDelay = 1000 * 60, debugLogLimit = 100, ...options } = {}) {
		if (!Number.isInteger(pingDelay)) {
			throw new TypeError('Expected options.pingDelay to be an integer');
		}
		if (!Number.isInteger(debugLogLimit)) {
			throw new TypeError('Expected options.debugLogLimit to be an integer');
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

		super(filename, options);
		this._pingTimer = null;
		this._workerIds = new Set();
		this._debugLogs = new LimitQueue(debugLogLimit);
		this._nextNonce = 0;

		if (this._fd >= 0) {
			this._pingTimer = setInterval(this._ping.bind(this), pingDelay).unref();
		}
	}

	STARTING_UP() {
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.STARTING_UP, this._nonce()]).flush();
		this._workerIds.clear();
		return this;
	}

	STARTING_UP_COMPLETED() {
		if (this._fd < 0) return this;
		return super.log([Date.now(), EventTypes.STARTING_UP_COMPLETED, this._nonce()]).flush();
	}

	SHUTTING_DOWN() {
		if (this._fd < 0) return this;
		return super.log([Date.now(), EventTypes.SHUTTING_DOWN, this._nonce()]).flush();
	}

	SHUTTING_DOWN_COMPLETED() {
		if (this._fd < 0) return this;
		return super.log([Date.now(), EventTypes.SHUTTING_DOWN_COMPLETED, this._nonce()]).flush();
	}

	WORKER_SPAWNED(workerId) {
		if (!Number.isInteger(workerId)) {
			throw new TypeError('Expected workerId to be an integer');
		}
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.WORKER_SPAWNED, this._nonce(), workerId]).flush();
		this._workerIds.add(workerId);
		return this;
	}

	WORKER_EXITED(workerId, reason) {
		if (!Number.isInteger(workerId)) {
			throw new TypeError('Expected workerId to be an integer');
		}
		if (!Number.isInteger(reason) && typeof reason !== 'string') {
			throw new TypeError('Expected reason to be an integer or string');
		}
		if (this._fd < 0) return this;
		super.log([Date.now(), EventTypes.WORKER_EXITED, this._nonce(), workerId, reason]).flush();
		this._workerIds.delete(workerId);
		return this;
	}

	MASTER_UNCAUGHT_EXCEPTION(err) {
		if (this._fd < 0) return this;
		const exceptionData = ExceptionUtil.encode(err, this._debugLogs.drain());
		return super.log([Date.now(), EventTypes.MASTER_UNCAUGHT_EXCEPTION, this._nonce(), exceptionData]);
	}

	critical(data) {
		if (this._fd < 0) return this;
		return super.log([Date.now(), EventTypes.MASTER_LOG_CRITICAL, this._nonce(), data]);
	}

	error(data) {
		if (this._fd < 0) return this;
		return super.log([Date.now(), EventTypes.MASTER_LOG_ERROR, this._nonce(), data]);
	}

	warn(data) {
		if (this._fd < 0) return this;
		return super.log([Date.now(), EventTypes.MASTER_LOG_WARN, this._nonce(), data]);
	}

	info(data) {
		if (this._fd < 0) return this;
		return super.log([Date.now(), EventTypes.MASTER_LOG_INFO, this._nonce(), data]);
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
		return this._ping().flush();
	}

	close() {
		super.close();
		clearInterval(this._pingTimer);
		return this;
	}

	_ping() {
		return super.log([Date.now(), EventTypes.MASTER_PING, this._nonce(), [...this._workerIds]]);
	}

	_nonce() {
		const nonce = this._nextNonce;
		this._nextNonce = nonce + 1 & 0xffff;
		return nonce;
	}
};
