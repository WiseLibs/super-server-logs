'use strict';
const Vfs = require('./vfs');
const Scanner = require('./scanner');
const binarySearch = require('./binary-search');
const { STARTING_UP, WORKER_SPAWNED, WORKER_EXITED, MASTER_PING } = require('../event-types');

/*
	Searches the given Vfs and yields all logs starting from a given minimum
	timestamp bound (inclusive), and continues to yield new logs indefinitely as
	they are detected. Logs are yielded in the same order as how they are layed
	out in the Vfs. If the Vfs is reading from raw log files, this means the
	logs are yielded in chronological order per process (but logs from different
	processes may not be exactly sorted).
 */

module.exports = async function* readTail(vfs, minTimestamp, pollInterval) {
	if (!(vfs instanceof Vfs)) {
		throw new TypeError('Expected vfs to be a Vfs object');
	}
	if (!Number.isInteger(minTimestamp)) {
		throw new TypeError('Expected minTimestamp to be an integer');
	}
	if (!Number.isInteger(pollInterval)) {
		throw new TypeError('Expected pollInterval to be an integer');
	}
	if (minTimestamp < 0) {
		throw new RangeError('Expected minTimestamp to be non-negative');
	}
	if (pollInterval < 1) {
		throw new RangeError('Expected pollInterval to be at least 1 ms');
	}
	if (pollInterval > 0x7fffffff) {
		throw new RangeError('Expected pollInterval to be no greater than 2147483647');
	}

	let totalSize = await vfs.size();
	const scanner = new Scanner(vfs, totalSize);
	await scanner.goto(await binarySearch(vfs, totalSize, minTimestamp));

	let pendingWorkers = null;
	for await (const log of scanner.backwardScan()) {
		const [timestamp, eventType] = log;
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

	for (;;) {
		for await (const log of scanner.forwardScan()) {
			const [timestamp] = log;
			if (timestamp >= minTimestamp) {
				yield log;
			}
		}

		for (;;) {
			await sleep(pollInterval);

			const newSize = await vfs.size();
			if (newSize > totalSize) {
				totalSize = newSize;
				break;
			}
		}

		await scanner.updateSize(totalSize);
	}
};

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
