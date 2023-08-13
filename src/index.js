'use strict';
const LogManager = require('./log-manager');
const WorkerLogger = require('./worker-logger');

exports.createLogManager = (dirname, options) => {
	return new LogManager(dirname, options);
};

exports.createLogger = (filename, options) => {
	return new WorkerLogger(filename, options);
};

exports.LogManager = LogManager;
exports.MasterLogger = require('./master-logger');
exports.WorkerLogger = WorkerLogger;
exports.RequestLogger = require('./request-logger');
exports.Logger = require('./logger');
