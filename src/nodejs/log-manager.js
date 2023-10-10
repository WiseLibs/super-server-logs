'use strict';
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { isLogBasename, toLogBasename, toLogTimestamp } = require('./common');

/*
	LogManager is used by a server cluster's master process to manage the logs
	within a specified directory. It provides the filename that should be used
	to write new logs, and it periodically emits "rotate" events, indicating
	that a new filename should be used.

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
	} = {}) {
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
		if (pollInterval > 0x7fffffff) {
			throw new RangeError('Expected options.pollInterval to be no greater than 2147483647');
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
				const timestamp = toLogTimestamp(basename);
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
			return {
				filename: path.join(dirname, basename),
				timestamp: toLogTimestamp(basename),
				size: 0,
			};
		}
	}
	return null;
}

function getNewLogFile(dirname, time = Date.now()) {
	return {
		filename: path.join(dirname, toLogBasename(time)),
		timestamp: time,
		size: 0,
	};
}

function ignoreENOENT(err) {
	if (err != null && err.code === 'ENOENT') {
		return { size: 0 };
	}
	throw err;
}
