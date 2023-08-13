'use strict';
const { readSync, ftruncateSync, writevSync } = require('fs');
const parseMasterLog = require('./parse-master-log');

/*
	Shrinks a master log to the targetSize by deleting lines within previous
	lifecycles or old lines within the current lifecycle. This operation
	synchronously reads and write the master log file, which is okay since it is
	a very rare operation and the master log doesn't have concurrent writers.
 */

module.exports = (fd, targetSize, currentSize) => {
	if (!Number.isInteger(fd)) {
		throw new TypeError('Expected fd to be an integer');
	}
	if (!Number.isInteger(targetSize)) {
		throw new TypeError('Expected targetSize to be an integer');
	}
	if (!Number.isInteger(currentSize)) {
		throw new TypeError('Expected currentSize to be an integer');
	}
	if (currentSize <= targetSize) {
		throw new RangeError('Expected targetSize to be less than currentSize');
	}

	// Try to read currentSize + 1 bytes, to validate the actual file size.
	const buffer = Buffer.allocUnsafe(currentSize + 1);
	const bytesRead = readSync(fd, buffer, 0, currentSize + 1, 0);
	if (bytesRead !== currentSize) {
		throw new Error('Failed to maintain accurate log size (probably due to concurrent writers)');
	}
	const { lifecycles, sources } = parseMasterLog(
		buffer.subarray(0, currentSize),
		{ includeSources: true }
	);

	// Discard or keep each lifecycle, starting from the oldest first.
	const lastLifecycle = lifecycles[lifecycles.length - 1];
	const keptLifecycles = [];
	for (const lifecycle of lifecycles) {
		if (currentSize <= targetSize) {
			keptLifecycles.push(lifecycle);
			continue;
		}

		// Discard or keep events within the lifecycle, starting from the oldest
		// first. Workers that have not yet exited are always kept.
		const keptEvents = [];
		for (const event of lifecycle.events.sort(prioritizeEvents)) {
			if (currentSize <= targetSize || event.WORKER_EXITED === null) {
				keptEvents.push(event);
			} else {
				for (const source of event.sources) {
					currentSize -= source.byteLength;
				}
			}
		}

		// Update or discard the lifecycle. Always keep the last lifecycle.
		if (currentSize <= targetSize || lifecycle === lastLifecycle) {
			lifecycle.events = keptEvents;
			keptLifecycles.push(lifecycle);
		} else {
			for (const event of keptEvents) {
				for (const source of event.sources) {
					currentSize -= source.byteLength;
				}
			}
			for (const source of lifecycle.sources) {
				currentSize -= source.byteLength;
			}
		}
	}

	// Gather all remaining source lines, and calculate their total size.
	let totalSize = 0;
	const keptSources = new Set();
	for (const lifecycle of keptLifecycles) {
		for (const source of lifecycle.sources) {
			totalSize += source.byteLength;
			keptSources.add(source);
		}
		for (const event of lifecycle.events) {
			for (const source of event.sources) {
				totalSize += source.byteLength;
				keptSources.add(source);
			}
		}
	}

	if (totalSize !== currentSize) {
		throw new Error('Failed to calculate accurate log size (probably due to concurrent writers)');
	}

	// Replace the file's contents with just the source lines that were kept.
	ftruncateSync(fd);
	writevSync(fd, sources.filter(x => keptSources.has(x)));

	return totalSize;
};

function prioritizeEvents(a, b) {
	let aDate = null;
	if (a.WORKER_SPAWNED != null) aDate = a.WORKER_EXITED;
	else if (a.MASTER_LOG != null) aDate = a.MASTER_LOG;
	else if (a.MASTER_UNCAUGHT_EXCEPTION != null) aDate = a.MASTER_UNCAUGHT_EXCEPTION;
	else throw new Error('Could not parse malformed or corrupted master log');

	let bDate = null;
	if (b.WORKER_SPAWNED != null) bDate = b.WORKER_EXITED;
	else if (b.MASTER_LOG != null) bDate = b.MASTER_LOG;
	else if (b.MASTER_UNCAUGHT_EXCEPTION != null) bDate = b.MASTER_UNCAUGHT_EXCEPTION;
	else throw new Error('Could not parse malformed or corrupted master log');

	if (aDate === bDate) return 0;
	if (aDate === null) return 1;
	if (bDate === null) return -1;
	return aDate - bDate;
}
