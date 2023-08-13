'use strict';
const { fstatSync } = require('fs');
const Logger = require('./logger');
const constants = require('./constants');
const getExceptionData = require('./get-exception-data');
const shrinkMasterLog = require('./shrink-master-log');

/*
	A logger for recording changes within a server cluster's master process.
 */

module.exports = class MasterLogger extends Logger {
	constructor(filename, { maxSize = 1024 * 32, ...options } = {}) {
		if (constants.WORKER_ID !== null) {
			throw new TypeError('MasterLogger can only be used within a cluster master process');
		}
		if (!Number.isInteger(maxSize)) {
			throw new TypeError('Expected options.maxSize to be an integer');
		}
		if (maxSize < 4096) {
			throw new RangeError('Expected options.maxSize to be 4096 or greater');
		}
		super(filename, options, 'a+');
		this._flush = wrapFlush.call(this, this._flush, maxSize);
	}

	STARTING_UP() {
		return super.log([constants.STARTING_UP, Date.now()]).flush();
	}

	STARTING_UP_COMPLETED(urls = []) {
		if (!Array.isArray(urls)) {
			throw new TypeError('Expected urls to be an array');
		}
		return super.log([constants.STARTING_UP_COMPLETED, Date.now(), urls]).flush();
	}

	SHUTTING_DOWN() {
		return super.log([constants.SHUTTING_DOWN, Date.now()]).flush();
	}

	SHUTTING_DOWN_COMPLETED() {
		return super.log([constants.SHUTTING_DOWN_COMPLETED, Date.now()]).flush();
	}

	WORKER_SPAWNED(workerId, pid) {
		if (!Number.isInteger(workerId)) {
			throw new TypeError('Expected workerId to be an integer');
		}
		if (!Number.isInteger(pid)) {
			throw new TypeError('Expected pid to be an integer');
		}
		return super.log([constants.WORKER_SPAWNED, Date.now(), workerId, pid]).flush();
	}

	WORKER_EXITED(workerId, code) {
		if (!Number.isInteger(workerId)) {
			throw new TypeError('Expected workerId to be an integer');
		}
		if (typeof code !== 'string') {
			throw new TypeError('Expected code to be a string');
		}
		return super.log([constants.WORKER_EXITED, Date.now(), workerId, code]).flush();
	}

	MASTER_LOG(data) {
		if (this._fd < 0) return this; // Fast path for closed logs
		return super.log([constants.MASTER_LOG, Date.now(), data]);
	}

	MASTER_UNCAUGHT_EXCEPTION(err) {
		if (this._fd < 0) return this; // Fast path for closed logs
		return super.log([constants.MASTER_UNCAUGHT_EXCEPTION, Date.now(), getExceptionData(err)]);
	}

	log(data) {
		return this.MASTER_LOG(data);
	}
};

function wrapFlush(flush, maxSize) {
	let currentSize = this._fd < 0 ? 0 : fstatSync(this._fd).size;

	if (currentSize > maxSize) {
		currentSize = shrinkMasterLog(this._fd, Math.floor(maxSize / 2), currentSize);
	}

	return () => {
		const outgoingSize = this._outgoingSize;
		flush();
		currentSize += outgoingSize;

		if (currentSize > maxSize) {
			currentSize = shrinkMasterLog(this._fd, Math.floor(maxSize / 2), currentSize);
		}
	};
}
