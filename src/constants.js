'use strict';
const cluster = require('cluster');

exports.WORKER_ID = cluster.isWorker ? cluster.worker.id : null;

// Events related to a request/response.
exports.REQUEST = 1;
exports.REQUEST_LOG = 2;
exports.RESPONSE = 3;
exports.RESPONSE_FINISHED = 4;

// Events related to a worker process.
exports.WORKER_ONLINE = 5;
exports.WORKER_GOING_OFFLINE = 6;
exports.WORKER_OFFLINE = 7;
exports.WORKER_DONE = 8;
exports.WORKER_LOG = 9;
exports.WORKER_UNCAUGHT_EXCEPTION = 10;

// Events related to the master process.
exports.STARTING_UP = 11;
exports.STARTING_UP_COMPLETED = 12;
exports.SHUTTING_DOWN = 13;
exports.SHUTTING_DOWN_COMPLETED = 14;
exports.WORKER_SPAWNED = 15;
exports.WORKER_EXITED = 16;
exports.MASTER_LOG = 17;
exports.MASTER_UNCAUGHT_EXCEPTION = 18;
