'use strict';
const Vfs = require('./vfs');
const Scanner = require('./scanner');
const binarySearch = require('./binary-search');
const { STARTING_UP, WORKER_SPAWNED, WORKER_EXITED, MASTER_PING } = require('../event-types');

/*
	Searches the given Vfs and yields all logs within the given timestamps
	bounds (inclusive). Logs are yielded in the reverse order from how they are
	layed out in the Vfs. If the Vfs is reading from raw log files, this means
	the logs are yielded in reverse chronological order per process (but logs
	from different processes may not be exactly sorted).
 */

module.exports = async function* readRange(vfs, minTimestamp, maxTimestamp) {
	if (!(vfs instanceof Vfs)) {
		throw new TypeError('Expected vfs to be a Vfs object');
	}
	if (!Number.isInteger(minTimestamp)) {
		throw new TypeError('Expected minTimestamp to be an integer');
	}
	if (!Number.isInteger(maxTimestamp)) {
		throw new TypeError('Expected maxTimestamp to be an integer');
	}
	if (minTimestamp < 0) {
		throw new RangeError('Expected minTimestamp to be non-negative');
	}
	if (maxTimestamp < 0) {
		throw new RangeError('Expected maxTimestamp to be non-negative');
	}
	if (!vfs.closed) {
		throw new Error('Vfs object is already in use');
	}
	if (minTimestamp > maxTimestamp) {
		return;
	}

	await vfs.setup();
	try {
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		await scanner.goto(await binarySearch(vfs, totalSize, maxTimestamp));

		let allWorkers = null;
		let pendingWorkers = null;
		for await (const log of scanner.forwardScan()) {
			const [timestamp, eventType] = log;
			if (eventType === STARTING_UP) {
				allWorkers = new Set([-1]);
				if (timestamp > maxTimestamp) {
					break;
				} else {
					pendingWorkers = new Set(allWorkers);
				}
			} else if (!pendingWorkers) {
				if (eventType === MASTER_PING) {
					allWorkers = new Set([-1, ...log[2]]);
					if (timestamp > maxTimestamp) {
						if (!log[2].length) {
							break;
						} else {
							pendingWorkers = new Set(log[2]);
						}
					} else {
						pendingWorkers = new Set(allWorkers);
					}
				}
			} else {
				if (eventType < 40 /* worker/request/response events */) {
					if (timestamp > maxTimestamp) {
						pendingWorkers.delete(log[2]);
						if (!pendingWorkers.size) {
							break;
						}
					}
				} else {
					if (eventType === WORKER_SPAWNED) {
						if (timestamp > maxTimestamp) {
							pendingWorkers.delete(-1);
							if (!pendingWorkers.size) {
								break;
							}
						} else {
							allWorkers.add(log[2]);
							pendingWorkers.add(log[2]);
						}
					} else if (eventType === WORKER_EXITED) {
						allWorkers.delete(log[2]);
						pendingWorkers.delete(log[2]);
						if (timestamp > maxTimestamp) {
							pendingWorkers.delete(-1);
						}
						if (!pendingWorkers.size) {
							break;
						}
					} else {
						if (timestamp > maxTimestamp) {
							pendingWorkers.delete(-1);
							if (!pendingWorkers.size) {
								break;
							}
						}
					}
				}
			}
		}

		pendingWorkers = new Set(allWorkers);
		for await (const log of scanner.backwardScan()) {
			const [timestamp, eventType] = log;
			if (timestamp >= minTimestamp && timestamp <= maxTimestamp) {
				yield log;
			}

			if (eventType === STARTING_UP) {
				if (timestamp < minTimestamp) {
					break;
				} else {
					pendingWorkers = null;
				}
			} else if (!pendingWorkers) {
				if (eventType === MASTER_PING) {
					if (timestamp < minTimestamp) {
						if (!log[2].length) {
							break;
						} else {
							pendingWorkers = new Set(log[2]);
						}
					} else {
						pendingWorkers = new Set([-1, ...log[2]]);
					}
				}
			} else {
				if (eventType < 40 /* worker/request/response events */) {
					if (timestamp < minTimestamp) {
						pendingWorkers.delete(log[2]);
						if (!pendingWorkers.size) {
							break;
						}
					}
				} else {
					if (eventType === WORKER_SPAWNED) {
						pendingWorkers.delete(log[2]);
						if (timestamp < minTimestamp) {
							pendingWorkers.delete(-1);
						}
						if (!pendingWorkers.size) {
							break;
						}
					} else if (eventType === WORKER_EXITED) {
						if (timestamp < minTimestamp) {
							pendingWorkers.delete(-1);
							if (!pendingWorkers.size) {
								break;
							}
						} else {
							pendingWorkers.add(log[2]);
						}
					} else {
						if (timestamp < minTimestamp) {
							pendingWorkers.delete(-1);
							if (!pendingWorkers.size) {
								break;
							}
						}
					}
				}
			}
		}
	} finally {
		await vfs.teardown();
	}
};
