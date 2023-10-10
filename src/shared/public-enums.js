'use strict';
const EventTypes = require('./event-types');

exports.LogType = Object.assign(Object.create(null), {
	REQUEST: 1,
	REQUEST_META: 2,
	RESPONSE: 3,
	RESPONSE_FINISHED: 4,
	LOG: 5,
	LIFECYCLE: 6,
	UNCAUGHT_EXCEPTION: 7,
});

exports.LogLevel = Object.assign(Object.create(null), {
	CRITICAL: 2,
	ERROR: 4,
	WARN: 5,
	INFO: 6,
	INTERNAL: 8,
});

exports.Lifecycle = Object.assign(Object.create(null), {
	WORKER_STARTED: 1,
	WORKER_GOING_ONLINE: 2,
	WORKER_ONLINE: 3,
	WORKER_GOING_OFFLINE: 4,
	WORKER_OFFLINE: 5,
	WORKER_DONE: 6,
	WORKER_PING: 7,
	STARTING_UP: 8,
	STARTING_UP_COMPLETED: 9,
	SHUTTING_DOWN: 10,
	SHUTTING_DOWN_COMPLETED: 11,
	WORKER_SPAWNED: 12,
	WORKER_EXITED: 13,
	MASTER_PING: 14,
});

exports.HttpMethod = Object.assign(Object.create(null), {
	GET: 1,
	HEAD: 2,
	POST: 3,
	PUT: 4,
	PATCH: 5,
	DELETE: 6,
	OPTIONS: 7,
	TRACE: 8,
	CONNECT: 9,
});
