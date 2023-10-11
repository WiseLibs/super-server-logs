'use strict';
const path = require('path');
const fs = require('fs/promises');
const Vfs = require('../shared/vfs');
const BulkParser = require('../shared/bulk-parser');
const BlockParser = require('../shared/block-parser');
const { STARTING_UP, WORKER_SPAWNED, WORKER_EXITED, MASTER_PING } = require('../shared/event-types');
const { isLogBasename } = require('./common');

const PAGE_SIZE = Vfs.PAGE_SIZE;

/*
	LogDirectorySource is a Vfs that reads directly from a log directory, which
	may or may not be actively in-use by a live server.

	By default, the logs are read from a single point-in-time view. To support
	tailing, the "pollInterval" option must be set, which allows the
	LogDirectorySource to periodically detect new logs being written.

	By default, the LogDirectorySource eagerly opens all log files in the
	directory, which prevents the logs from being deleted (e.g., by log
	rotation) while the Vfs is open. This may be undesirable if the
	LogDirectorySource is very long-lived, and if you don't need to read very
	old logs (e.g., because you are tailing the logs). In such situations, you
	can set the "lazy" option to true, which causes files to only be opened
	while they are being actively read. In this mode, attempting to read old
	logs which have been deleted will cause an exception to be thrown.

	By default, the LogDirectorySource assumes that a live server might be
	actively writing to the logs. Some extra book-keeping is required to
	maintain correctness in such a situation. If you're sure that no live server
	is writing to the logs, you can set the "immutable" option to true, which
	allows the LogDirectorySource to avoid some unnecessary work.
 */

module.exports = class LogDirectorySource extends Vfs {
	constructor(dirname, { cacheSize, pollInterval = null, lazy = false, immutable = false } = {}) {
		if (typeof dirname !== 'string') {
			throw new TypeError('Expected dirname to be a string');
		}
		if (pollInterval !== null) {
			if (!Number.isInteger(pollInterval)) {
				throw new TypeError('Expected options.pollInterval to be an integer or null');
			}
			if (pollInterval < 1) {
				throw new RangeError('Expected options.pollInterval to be at least 1 ms');
			}
			if (pollInterval > 0x7fffffff) {
				throw new RangeError('Expected options.pollInterval to be no greater than 2147483647');
			}
		}
		if (typeof lazy !== 'boolean') {
			throw new TypeError('Expected options.lazy to be a boolean');
		}
		if (typeof immutable !== 'boolean') {
			throw new TypeError('Expected options.immutable to be a boolean');
		}

		const files = [];
		let lastBasename = '';
		let nextPollTime = Infinity;

		dirname = path.resolve(dirname);

		// When detecting new log files, we only consider files that have a
		// newer timestamp compared to any existing file. Otherwise, new files
		// could "push" existing files to different byte offsets.
		const isNewLog = (basename) => {
			return basename > lastBasename && isLogBasename(basename);
		};

		// This function detects new log files and any new data written to
		// existing log files. If polling is enabled, it gets called regularly.
		const updateState = async () => {
			// Detect new log files in the directory.
			for (const basename of (await fs.readdir(dirname)).filter(isNewLog).sort()) {
				const filename = path.join(dirname, basename);
				files.push({ filename, handle: null, size: 0, isRotating: true });
				lastBasename = basename;
			}

			// If any files are being rotated to, we need to check if that's
			// still the case. Also, any files that are *not* being rotated to
			// are considered readable, so we need to update their size.
			const readableFiles = [];
			const liveFiles = getLiveFiles(files);
			if (liveFiles[liveFiles.length - 1].isRotating) {
				// By the nature of log rotation, any files that are being
				// rotated must appear *after* any files that are not.
				// Therefore, as an optimization, we check them in reverse
				// order; when we find one that is not being rotated, we know
				// the rest will be the same.
				for (let i = liveFiles.length - 1; i >= 0; --i) {
					const file = liveFiles[i];
					if (immutable || !file.isRotating || !(await isRotating(file))) {
						do {
							liveFiles[i].isRotating = false;
							readableFiles.push(liveFiles[i]);
						} while (--i >= 0);
						break;
					}
				}
			} else {
				// If no files are being rotated, there's only one live file.
				readableFiles.push(liveFiles[0]);
			}

			await waitAll(readableFiles.map(updateSize));

			if (pollInterval !== null) {
				nextPollTime = Date.now() + pollInterval;
			}
		};

		super({
			setup: async () => {
				try {
					await updateState();
				} catch (err) {
					await Promise.all(files.map(closeHandle));
					throw err;
				}
				if (lazy) {
					await Promise.all(files.map(closeHandle));
				}
			},
			teardown: async () => {
				await Promise.all(files.map(closeHandle));
			},
			read: async (byteOffset, byteLength, saveToCache) => {
				if (Date.now() >= nextPollTime) {
					await updateState();
				}

				// Determine which files are part of the requested byte range.
				let readOffset = 0;
				let fileOffset = 0;
				const byteOffsetEnd = byteOffset + byteLength;
				const includedFiles = [];
				const excludedFiles = [];
				const firstLiveFile = lazy ? getLiveFiles(files)[0] : undefined;
				for (const file of files) {
					if (file.isRotating) {
						break; // Don't read from rotating files
					}

					const fileOffsetEnd = fileOffset + file.size;
					if (fileOffset < byteOffsetEnd && fileOffsetEnd > byteOffset) {
						if (!includedFiles.length) {
							readOffset = byteOffset - fileOffset;
						}
						includedFiles.push(file);
					} else if (lazy) {
						if (file.handle !== null) {
							// We only close files if polling is disabled or if
							// it's not a live file. Live files are kept open
							// because they'll be needed on the next call to
							// updateState(). We only need to check the first
							// live file because the others are guaranteed to be
							// rotating, so they're just skipped regardless.
							if (pollInterval === null || file !== firstLiveFile) {
								excludedFiles.push(file);
							}
						}
					} else if (includedFiles.length) {
						break; // Micro-optimization
					}

					fileOffset = fileOffsetEnd;
				}

				// If we're in lazy mode, we might need to open or close files.
				if (lazy) {
					await waitAll([
						...includedFiles.map(openHandle),
						...excludedFiles.map(closeHandle),
					]);
				}

				// Read a chunk from each file.
				const chunks = [];
				for (const file of includedFiles) {
					const length = Math.min(byteLength, file.size - readOffset);
					const chunk = Buffer.allocUnsafe(length);
					const { bytesRead } = await file.handle.read(chunk, 0, length, readOffset);
					if (bytesRead < length) {
						throw new RangeError('Vfs data corruption detected');
					}

					chunks.push(chunk);
					byteLength -= length;
					readOffset = 0;
				}

				const result = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
				saveToCache(byteOffset, result);
				return result;
			},
			size: async () => {
				if (Date.now() >= nextPollTime) {
					await updateState();
				}

				let totalSize = 0;
				for (const file of files) {
					if (file.isRotating) {
						break; // Don't read from rotating files
					} else {
						totalSize += file.size;
					}
				}

				return totalSize;
			},
			cacheSize,
		});
	}
};

// Returns true if a live server is currently rotating *to* the given log file.
// If true, it means the *previous* log file might still have active writers.
async function isRotating(file) {
	await openHandle(file);

	let pendingWorkers = null;
	for await (const block of BulkParser.read(readPages(file.handle))) {
		for (const log of BlockParser.parseAll(block)) {
			const eventType = log[1];
			if (eventType === STARTING_UP) {
				return false;
			} else if (!pendingWorkers) {
				if (eventType === MASTER_PING) {
					pendingWorkers = new Set(log[3]);
				}
			} else {
				if (eventType < 40 /* worker/request/response events */) {
					pendingWorkers.delete(log[3]);
					if (!pendingWorkers.size) {
						return false;
					}
				} else if (eventType === WORKER_EXITED) {
					pendingWorkers.delete(log[3]);
					if (!pendingWorkers.size) {
						return false;
					}
				}
			}
		}
	}

	return true;
}

// Returns all files that might have active writers. All files that are in the
// middle of a rotation are considered live, as well as the last file that is
// not in the middle of a rotation.
function getLiveFiles(files) {
	let index = files.length - 1;
	while (index > 0) {
		if (files[index].isRotating) {
			index -= 1;
		} else {
			break;
		}
	}
	return files.slice(index);
}

async function updateSize(file) {
	await openHandle(file);
	file.size = (await file.handle.stat()).size;
}

async function openHandle(file) {
	if (file.handle === null) {
		file.handle = await fs.open(file.filename);
	}
}

async function closeHandle(file) {
	if (file.handle === null) {
		return;
	}

	try {
		await file.handle.close();
	} catch (err) {
		process.emitWarning(err);
	}

	file.handle = null;
}

async function* readPages(handle) {
	let offset = 0;
	for (;;) {
		const buffer = Buffer.allocUnsafe(PAGE_SIZE);
		const { bytesRead } = await handle.read(buffer, 0, PAGE_SIZE, offset);
		if (bytesRead === PAGE_SIZE) {
			offset += bytesRead;
			yield buffer;
		} else {
			if (bytesRead > 0) {
				yield buffer.fill(0, bytesRead).subarray(0, bytesRead);
			}
			break;
		}
	}
}

// This is similuar to Promise.all(), except it waits until all promises have
// been settled before throwing the first exception. This is important when
// opening multiple file handles concurrently, because we generally want to
// close all files upon failure, but we need to make sure we don't attempt to do
// so while some handles are yet to be opened, as that would result in a leak.
async function waitAll(promises) {
	const settled = await Promise.allSettled(promises);
	const failure = settled.find(x => x.status === 'rejected');
	if (failure) {
		throw failure.reason;
	}
}
