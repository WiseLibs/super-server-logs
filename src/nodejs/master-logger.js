'use strict';
const EventTypes = require('../shared/event-types');
const ExceptionUtil = require('../shared/exception-util');
const LimitQueue = require('./limit-queue');
const Writer = require('./writer');
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
		if (this._fd >= 0) {
			this._lifecycle(EventTypes.STARTING_UP).flush();
			this._workerIds.clear();
		}
		return this;
	}

	STARTING_UP_COMPLETED() {
		if (this._fd >= 0) {
			this._lifecycle(EventTypes.STARTING_UP_COMPLETED).flush();
		}
		return this;
	}

	SHUTTING_DOWN() {
		if (this._fd >= 0) {
			this._lifecycle(EventTypes.SHUTTING_DOWN).flush();
		}
		return this;
	}

	SHUTTING_DOWN_COMPLETED() {
		if (this._fd >= 0) {
			this._lifecycle(EventTypes.SHUTTING_DOWN_COMPLETED).flush();
		}
		return this;
	}

	WORKER_SPAWNED(workerId) {
		if (!Number.isInteger(workerId)) {
			throw new TypeError('Expected workerId to be an integer');
		}
		if (this._fd >= 0) {
			super.log(new Writer()
				.uint8(EventTypes.WORKER_SPAWNED)
				.uint48(Date.now())
				.uint16(this._nonce())
				.dynamicInteger(workerId)
				.done()
			).flush();
			this._workerIds.add(workerId);
		}
		return this;
	}

	WORKER_EXITED(workerId, exitCode, signal = null) {
		if (!Number.isInteger(workerId)) {
			throw new TypeError('Expected workerId to be an integer');
		}
		if (!Number.isInteger(exitCode)) {
			throw new TypeError('Expected exitCode to be an integer');
		}
		if (signal !== null && typeof signal !== 'string') {
			throw new TypeError('Expected signal to be a string or null');
		}
		if (this._fd >= 0) {
			super.log(new Writer()
				.uint8(EventTypes.WORKER_EXITED)
				.uint48(Date.now())
				.uint16(this._nonce())
				.dynamicInteger(workerId)
				.uint8(exitCode)
				.string(signal || '')
				.done()
			).flush();
			this._workerIds.delete(workerId);
		}
		return this;
	}

	UNCAUGHT_EXCEPTION(err) {
		if (this._fd >= 0) {
			super.log(new Writer()
				.uint8(EventTypes.MASTER_UNCAUGHT_EXCEPTION)
				.uint48(Date.now())
				.uint16(this._nonce())
				.json(ExceptionUtil.encode(err, this._debugLogs.drain()))
				.done()
			);
		}
		return this;
	}

	critical(data) {
		if (this._fd >= 0) this._log(EventTypes.MASTER_LOG_CRITICAL, data);
		return this;
	}

	error(data) {
		if (this._fd >= 0) this._log(EventTypes.MASTER_LOG_ERROR, data);
		return this;
	}

	warn(data) {
		if (this._fd >= 0) this._log(EventTypes.MASTER_LOG_WARN, data);
		return this;
	}

	info(data) {
		if (this._fd >= 0) this._log(EventTypes.MASTER_LOG_INFO, data);
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
		}
		return this;
	}

	close() {
		super.close();
		clearInterval(this._pingTimer);
		return this;
	}

	_lifecycle(eventType) {
		return super.log(new Writer()
			.uint8(eventType)
			.uint48(Date.now())
			.uint16(this._nonce())
			.done()
		);
	}

	_log(eventType, data) {
		return super.log(new Writer()
			.uint8(eventType)
			.uint48(Date.now())
			.uint16(this._nonce())
			.json(data)
			.done()
		);
	}

	_ping() {
		return super.log(new Writer()
			.uint8(EventTypes.MASTER_PING)
			.uint48(Date.now())
			.uint16(this._nonce())
			.dynamicIntegerArray([...this._workerIds])
			.done()
		);
	}

	_nonce() {
		const nonce = this._nextNonce;
		this._nextNonce = nonce + 1 & 0xffff;
		return nonce;
	}
};
