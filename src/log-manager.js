'use strict';
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const MasterLogger = require('./master-logger');

/*
	LogManager is used by a server cluster's master process to manage the logs
	within a specified directory. It provides a MasterLogger for the master
	process to use, and it provides the filename that worker processes should
	use for their WorkerLoggers. Also, "rotate" events are periodically emitted,
	indicating that a new filename should be used by workers.

	Whenever a "rotate" event is emitted, the log directory is scanned and
	obsolete log files are automatically deleted. To facilitate this, log files
	are rotated based on a configured granularity. For example, if the
	granularity is 20, then the current log file is rotated whenever it exceeds
	(logSizeLimit / 20), which allows granular log deletion without needing to
	read or modify old log files.
 */

module.exports = class LogManager extends EventEmitter {
	constructor(dirname, {
		pollInterval = 1000 * 5,
		logSizeLimit = 1024 * 1024 * 1024 * 2,
		logAgeLimit = 1000 * 60 * 60 * 24 * 365,
		granularity = 20,
	}) {
		if (typeof dirname !== 'string' && dirname !== null) {
			throw new TypeError('Expected dirname to be a string or null');
		}
		if (!Number.isInteger(pollInterval)) {
			throw new TypeError('Expected options.pollInterval to be an integer');
		}
		if (!Number.isInteger(logSizeLimit)) {
			throw new TypeError('Expected options.logSizeLimit to be an integer');
		}
		if (!Number.isInteger(logAgeLimit)) {
			throw new TypeError('Expected options.logAgeLimit to be an integer');
		}
		if (!Number.isInteger(granularity)) {
			throw new TypeError('Expected options.granularity to be an integer');
		}
		if (pollInterval < 1) {
			throw new RangeError('Expected options.pollInterval to be at least 1 ms');
		}
		if (logSizeLimit < 1024 * 1024) {
			throw new RangeError('Expected options.logSizeLimit to be at least 1048576 bytes');
		}
		if (logAgeLimit < 60000) {
			throw new RangeError('Expected options.logAgeLimit to be at least 60000 ms');
		}
		if (granularity < 2) {
			throw new RangeError('Expected options.granularity to be at least 2');
		}
		if (logAgeLimit / granularity < 1000) {
			throw new RangeError('Granularity is too large for the given logAgeLimit');
		}

		this._dirname = null;
		this._filename = null;
		this._pollTimer = null;
		this._logger = null;
		this._closed = true;

		if (dirname !== null) {
			this._closed = false;
			this._dirname = path.resolve(dirname);
			fs.mkdirSync(this._dirname, { recursive: true, mode: 0o700 });

			startPolling.call(this,
				this._dirname,
				pollInterval,
				logSizeLimit,
				logAgeLimit,
				granularity
			);
		}
	}

	createLogger(options) {
		if (!this._logger || this._logger.closed) {
			const filename = this._closed ? null : path.join(this._dirname, 'master.log');
			this._logger = new MasterLogger(filename, options);
		}
		return this._logger;
	}

	close() {
		if (!this._closed) {
			clearTimeout(this._pollTimer);
			this._pollTimer = null;
			this._closed = true;
		}
	}

	get closed() {
		return this._closed;
	}

	get dirname() {
		return this._dirname;
	}

	get filename() {
		return this._filename;
	}
};

function startPolling(dirname, pollInterval, logSizeLimit, logAgeLimit, granularity) {
	const fileSizeLimit = Math.ceil(logSizeLimit / granularity);
	const fileAgeLimit = Math.ceil(logAgeLimit / granularity);
	let currentFile = getLatestLogFile(dirname);

	const nextPoll = () => {
		fs.stat(currentFile.filename, poll);
	};

	const poll = (err, stats) => {
		if (this._closed) return;
		this._pollTimer = setTimeout(nextPoll, pollInterval);

		if (err == null) {
			currentFile.size = stats.size;
		} else if (err.code === 'ENOENT') {
			currentFile.size = 0;
		} else {
			return onError(err);
		}

		// Check if the current log file needs to be rotated out.
		const now = Date.now();
		const isTooBig = currentFile.size >= fileSizeLimit;
		const isTooOld = currentFile.timestamp <= now - fileAgeLimit;
		if (isTooBig || isTooOld) {
			deleteLogs(now).catch(onError);
			currentFile = getNewLogFile(dirname, now);
			this._filename = currentFile.filename;
			this.emit('rotate', currentFile.filename);
		}
	};

	const deleteLogs = async (now) => {
		// Get all existing log files, sorted by ascending age.
		const basenames = (await fs.promises.readdir(dirname))
			.filter(isLogBasename)
			.sort()
			.reverse();

		// Identify log files that either exceed the size limit or age limit.
		// After one is found, all subsequent files are also guaranteed to
		// exceed the same limit, due to the sort order.
		let totalSize = 0;
		let shouldDelete = [];
		for (const basename of basenames) {
			const filename = path.join(dirname, basename);
			if (shouldDelete.length) {
				shouldDelete.push(filename); // Already exceeded a limit
			} else {
				const timestamp = Number(basename.slice(0, -4));
				if (timestamp <= now - logAgeLimit) {
					shouldDelete.push(filename); // Age limit exceeded
				} else {
					const stats = await fs.promises.stat(filename).catch(ignoreENOENT);
					totalSize += stats.size;
					if (totalSize >= logSizeLimit) {
						shouldDelete.push(filename); // Size limit exceeded
					}
				}
			}
		}

		// Delete the outdated files in oldest-first order. We purposefully
		// don't delete them in parallel because we don't want to drown the
		// event loop with low-priority cleanup duties.
		for (const filename of shouldDelete.reverse()) {
			await fs.promises.rm(filename, { force: true, recursive: true, maxRetries: 2 });
		}
	};

	const onError = (err) => {
		queueMicrotask(this.emit.bind(this, 'error', err));
	};

	// If a log file exists, poll it immediately, otherwise just poll later.
	if (currentFile) {
		poll(null, fs.statSync(currentFile.filename));
	} else {
		currentFile = getNewLogFile(dirname);
		this._pollTimer = setTimeout(nextPoll, pollInterval);
	}

	this._filename = currentFile.filename;
}

function getLatestLogFile(dirname) {
	for (const basename of fs.readdirSync(dirname).sort().reverse()) {
		if (isLogBasename(basename)) {
			const filename = path.join(dirname, basename);
			return {
				filename,
				timestamp: Number(basename.slice(0, -4)),
				size: 0,
			};
		}
	}
	return null;
}

function getNewLogFile(dirname, time = Date.now()) {
	const basename = `${String(time).padStart(14, '0')}.log`;
	return {
		filename: path.join(dirname, basename),
		timestamp: time,
		size: 0,
	};
}

function isLogBasename(basename) {
	return /^[0-9]{14}\.log$/.test(basename);
}

function ignoreENOENT(err) {
	if (err != null && err.code === 'ENOENT') {
		return { size: 0 };
	}
	throw err;
}
