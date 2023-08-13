'use strict';
const Logger = require('./logger');
const RequestLogger = require('./request-logger');
const constants = require('./constants');
const getExceptionData = require('./get-exception-data');

/*
	A logger for recording changes within a server cluster's worker process.
 */

module.exports = class WorkerLogger extends Logger {
	constructor(filename, options) {
		if (constants.WORKER_ID === null) {
			throw new TypeError('WorkerLogger can only be used within a cluster worker process');
		}
		super(filename, options);
	}

	WORKER_ONLINE() {
		return super.log([constants.WORKER_ONLINE, Date.now(), constants.WORKER_ID]).flush();
	}

	WORKER_GOING_OFFLINE() {
		return super.log([constants.WORKER_GOING_OFFLINE, Date.now(), constants.WORKER_ID]).flush();
	}

	WORKER_OFFLINE() {
		return super.log([constants.WORKER_OFFLINE, Date.now(), constants.WORKER_ID]).flush();
	}

	WORKER_DONE() {
		return super.log([constants.WORKER_DONE, Date.now(), constants.WORKER_ID]).flush();
	}

	WORKER_LOG(data) {
		if (this._fd < 0) return this; // Fast path for closed logs
		return super.log([constants.WORKER_LOG, Date.now(), constants.WORKER_ID, data]);
	}

	WORKER_UNCAUGHT_EXCEPTION(err) {
		if (this._fd < 0) return this; // Fast path for closed logs
		return super.log([constants.WORKER_UNCAUGHT_EXCEPTION, Date.now(), constants.WORKER_ID, getExceptionData(err)]);
	}

	log(data) {
		return this.WORKER_LOG(data);
	}

	newRequest() {
		return new RequestLogger(this, super.log);
	}
};
