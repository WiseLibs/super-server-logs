'use strict';

// Events related to a request/response.
exports.REQUEST = 1;
exports.REQUEST_META = 2;
exports.RESPONSE = 3;
exports.RESPONSE_FINISHED = 4;

// Log levels related to a request/response.
exports.REQUEST_LOG_CRITICAL = 11;
exports.REQUEST_LOG_ERROR = 13;
exports.REQUEST_LOG_WARN = 14;
exports.REQUEST_LOG_INFO = 15;
exports.REQUEST_LOG_DEBUG = 17;

// Events related to a worker process.
exports.WORKER_STARTED = 20;
exports.WORKER_GOING_ONLINE = 21;
exports.WORKER_ONLINE = 22;
exports.WORKER_GOING_OFFLINE = 23;
exports.WORKER_OFFLINE = 24;
exports.WORKER_DONE = 25;
exports.WORKER_UNCAUGHT_EXCEPTION = 26;
exports.WORKER_PING = 27;

// Log levels related to a worker process.
exports.WORKER_LOG_CRITICAL = 31;
exports.WORKER_LOG_ERROR = 33;
exports.WORKER_LOG_WARN = 34;
exports.WORKER_LOG_INFO = 35;
exports.WORKER_LOG_DEBUG = 37;

// Events related to the master process.
exports.STARTING_UP = 40;
exports.STARTING_UP_COMPLETED = 41;
exports.SHUTTING_DOWN = 42;
exports.SHUTTING_DOWN_COMPLETED = 43;
exports.WORKER_SPAWNED = 44;
exports.WORKER_EXITED = 45;
exports.MASTER_UNCAUGHT_EXCEPTION = 46;
exports.MASTER_PING = 47;

// Log levels related to the master process.
exports.MASTER_LOG_CRITICAL = 51;
exports.MASTER_LOG_ERROR = 53;
exports.MASTER_LOG_WARN = 54;
exports.MASTER_LOG_INFO = 55;
exports.MASTER_LOG_DEBUG = 57;
