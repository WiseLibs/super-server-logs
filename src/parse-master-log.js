'use strict';
const {
	STARTING_UP,
	STARTING_UP_COMPLETED,
	SHUTTING_DOWN,
	SHUTTING_DOWN_COMPLETED,
	WORKER_SPAWNED,
	WORKER_EXITED,
	MASTER_LOG,
	MASTER_UNCAUGHT_EXCEPTION,
} = require('./constants');

/*
	Parses the raw content of a master log file, returning an array of
	"lifecycle" objects, which each contain an array of "event" objects. All
	lifecycle and event objects are sorted chronologically.

	In order for the master log file to be valid:
		1. The STARTING_UP event must occur before anything else.
		2. Each WORKER_SPAWNED event must have a unique workerId.
		3. Each WORKER_EXITED event must occur *after* its WORKER_SPAWNED event.
 */

module.exports = (content, { includeSources = false } = {}) => {
	if (!Buffer.isBuffer(content)) {
		throw new TypeError('Expected content to be a Buffer');
	}

	let entries;
	try {
		entries = splitByLine(content).map(line => ({
			entry: JSON.parse(line.toString()),
			source: line,
		}));
	} catch (_) {
		fail();
	}

	for (const { entry } of entries) {
		if (!Array.isArray(entry)
			|| entry.length < 2
			|| !Number.isInteger(entry[0])
			|| !Number.isInteger(entry[1])
		) {
			fail();
		}
	}

	entries.sort((a, b) => {
		return a.entry[1] - b.entry[1];
	});

	let currentWorkers;
	let currentLifecycle;
	const lifecycles = [];
	for (const { entry, source } of entries) {
		switch (entry[0]) {
			case STARTING_UP: {
				currentWorkers = new Map();
				currentLifecycle = {
					STARTING_UP: entry[1],
					STARTING_UP_COMPLETED: null,
					SHUTTING_DOWN: null,
					SHUTTING_DOWN_COMPLETED: null,
					urls: [],
					events: [],
				};
				includeSources && (currentLifecycle.sources = [source]);
				lifecycles.push(currentLifecycle);
			} break;
			case STARTING_UP_COMPLETED: {
				const lifecycle = currentLifecycle || fail();
				lifecycle.STARTING_UP_COMPLETED = entry[1];
				lifecycle.urls = entry[2];
				includeSources && lifecycle.sources.push(source);
			} break;
			case SHUTTING_DOWN: {
				const lifecycle = currentLifecycle || fail();
				if (lifecycle.SHUTTING_DOWN === null) {
					lifecycle.SHUTTING_DOWN = entry[1];
				}
				includeSources && lifecycle.sources.push(source);
			} break;
			case SHUTTING_DOWN_COMPLETED: {
				const lifecycle = currentLifecycle || fail();
				lifecycle.SHUTTING_DOWN_COMPLETED = entry[1];
				includeSources && lifecycle.sources.push(source);
			} break;
			case WORKER_SPAWNED: {
				const lifecycle = currentLifecycle || fail();
				const workers = currentWorkers || fail();
				const workerId = entry[2];
				const event = {
					WORKER_SPAWNED: entry[1],
					WORKER_EXITED: null,
					workerId: workerId,
					pid: entry[3],
					exitReason: null,
				};
				includeSources && (event.sources = [source]);
				workers.has(workerId) && fail();
				workers.set(workerId, event);
				lifecycle.events.push(event);
			} break;
			case WORKER_EXITED: {
				const workers = currentWorkers || fail();
				const event = workers.get(entry[2]) || fail();
				event.WORKER_EXITED = entry[1];
				event.exitReason = entry[3];
				includeSources && event.sources.push(source);
			} break;
			case MASTER_LOG: {
				const lifecycle = currentLifecycle || fail();
				const event = { MASTER_LOG: entry[1], data: entry[2] };
				includeSources && (event.sources = [source]);
				lifecycle.events.push(event);
			} break;
			case MASTER_UNCAUGHT_EXCEPTION: {
				const lifecycle = currentLifecycle || fail();
				const event = { MASTER_UNCAUGHT_EXCEPTION: entry[1], data: entry[2] };
				includeSources && (event.sources = [source]);
				lifecycle.events.push(event);
			} break;
			default:
				fail();
		}
	}

	if (includeSources) {
		const sources = entries.map(entry => entry.source);
		return { lifecycles, sources };
	}
	return lifecycles;
};

// Splits a buffer into an array of buffers, where the resulting buffers each
// end in a newline ("\n") character (except maybe the last), and the
// concatenation of all resulting buffers equals the original one.
function splitByLine(buffer) {
	let offset = 0;
	const chunks = [];
	while (offset < buffer.byteLength) {
		const nextLine = buffer.indexOf(0xa, offset) + 1;
		if (nextLine > 0) {
			chunks.push(buffer.subarray(offset, nextLine));
			offset = nextLine;
		} else {
			chunks.push(buffer.subarray(offset));
			break;
		}
	}
	return chunks;
}

function fail() {
	throw new Error('Could not parse malformed or corrupted master log');
}
