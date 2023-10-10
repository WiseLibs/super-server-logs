'use strict';
const Vfs = require('./vfs');
const Scanner = require('./scanner');
const BoundFinder = require('./bound-finder');
const binarySearch = require('./binary-search');

const PAGE_SIZE = Vfs.PAGE_SIZE * 8;

module.exports = class LogReader {
	constructor(vfs) {
		if (!(vfs instanceof Vfs)) {
			throw new TypeError('Expected argument to be a Vfs object');
		}
		if (!vfs.closed || vfs.busy) {
			throw new Error('Vfs object is already in use');
		}

		this._vfs = vfs;
	}

	async *range(minTimestamp, maxTimestamp) {
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
		if (!this._vfs.closed || this._vfs.busy) {
			throw new Error('LogReader is already busy with another operation');
		}
		if (minTimestamp > maxTimestamp) {
			return;
		}

		await this._vfs.setup();
		try {
			const totalSize = await this._vfs.size();
			const scanner = new Scanner(this._vfs, totalSize);
			await scanner.goto(await binarySearch(this._vfs, totalSize, minTimestamp));

			const lowerBound = new BoundFinder(minTimestamp);
			for await (const log of scanner.backwardScan()) {
				if (lowerBound.reachedLowerBound(log)) {
					break;
				}
			}

			const upperBound = new BoundFinder(maxTimestamp, lowerBound.state);
			for await (const log of scanner.forwardScan()) {
				const [timestamp] = log;
				if (timestamp >= minTimestamp && timestamp <= maxTimestamp) {
					yield log; // TODO: yield a friendly log object
				}
				if (upperBound.reachedUpperBound(log)) {
					break;
				}
			}
		} finally {
			await this._vfs.teardown();
		}
	}

	async *rangeReversed(minTimestamp, maxTimestamp) {
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
		if (!this._vfs.closed || this._vfs.busy) {
			throw new Error('LogReader is already busy with another operation');
		}
		if (minTimestamp > maxTimestamp) {
			return;
		}

		await this._vfs.setup();
		try {
			const totalSize = await this._vfs.size();
			const scanner = new Scanner(this._vfs, totalSize);
			await scanner.goto(await binarySearch(this._vfs, totalSize, maxTimestamp));

			const upperBound = new BoundFinder(maxTimestamp);
			for await (const log of scanner.forwardScan()) {
				if (upperBound.reachedUpperBound(log)) {
					break;
				}
			}

			const lowerBound = new BoundFinder(minTimestamp, upperBound.state);
			for await (const log of scanner.backwardScan()) {
				const [timestamp] = log;
				if (timestamp >= minTimestamp && timestamp <= maxTimestamp) {
					yield log; // TODO: yield a friendly log object
				}
				if (lowerBound.reachedLowerBound(log)) {
					break;
				}
			}
		} finally {
			await this._vfs.teardown();
		}
	}

	async *tail(minTimestamp = Date.now(), { pollInterval = 200 } = {}) {
		if (!Number.isInteger(minTimestamp)) {
			throw new TypeError('Expected minTimestamp to be an integer');
		}
		if (!Number.isInteger(pollInterval)) {
			throw new TypeError('Expected options.pollInterval to be an integer');
		}
		if (minTimestamp < 0) {
			throw new RangeError('Expected minTimestamp to be non-negative');
		}
		if (pollInterval < 1) {
			throw new RangeError('Expected options.pollInterval to be at least 1 ms');
		}
		if (pollInterval > 0x7fffffff) {
			throw new RangeError('Expected options.pollInterval to be no greater than 2147483647');
		}
		if (!this._vfs.closed || this._vfs.busy) {
			throw new Error('LogReader is already busy with another operation');
		}

		await this._vfs.setup();
		try {
			let totalSize = await this._vfs.size();
			const scanner = new Scanner(this._vfs, totalSize);
			await scanner.goto(await binarySearch(this._vfs, totalSize, minTimestamp));

			const lowerBound = new BoundFinder(minTimestamp);
			for await (const log of scanner.backwardScan()) {
				if (lowerBound.reachedLowerBound(log)) {
					break;
				}
			}

			for (;;) {
				for await (const log of scanner.forwardScan()) {
					const [timestamp] = log;
					if (timestamp >= minTimestamp) {
						yield log; // TODO: yield a friendly log object
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
		} finally {
			await this._vfs.teardown();
		}
	}

	async *bulkRange(minTimestamp, maxTimestamp) {
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
		if (!this._vfs.closed || this._vfs.busy) {
			throw new Error('LogReader is already busy with another operation');
		}
		if (minTimestamp > maxTimestamp) {
			return;
		}

		await this._vfs.setup();
		try {
			const totalSize = await this._vfs.size();
			const scanner = new Scanner(this._vfs, totalSize);
			await scanner.goto(await binarySearch(this._vfs, totalSize, maxTimestamp));

			const upperBound = new BoundFinder(maxTimestamp);
			for await (const log of scanner.forwardScan()) {
				if (upperBound.reachedUpperBound(log)) {
					break;
				}
			}

			const upperByteOffset = scanner.calculateByteOffset();
			await scanner.goto(await binarySearch(this._vfs, totalSize, minTimestamp));

			const lowerBound = new BoundFinder(minTimestamp);
			for await (const log of scanner.backwardScan()) {
				if (lowerBound.reachedLowerBound(log)) {
					break;
				}
			}

			let lowerByteOffset = scanner.calculateByteOffset();
			while (upperByteOffset > lowerByteOffset) {
				const byteLength = Math.min(PAGE_SIZE, upperByteOffset - lowerByteOffset);
				yield await this._vfs.read(lowerByteOffset, byteLength);
				lowerByteOffset += byteLength;
			}
		} finally {
			await this._vfs.teardown();
		}
	}

	async *bulkRangeReversed(minTimestamp, maxTimestamp) {
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
		if (!this._vfs.closed || this._vfs.busy) {
			throw new Error('LogReader is already busy with another operation');
		}
		if (minTimestamp > maxTimestamp) {
			return;
		}

		await this._vfs.setup();
		try {
			const totalSize = await this._vfs.size();
			const scanner = new Scanner(this._vfs, totalSize);
			await scanner.goto(await binarySearch(this._vfs, totalSize, minTimestamp));

			const lowerBound = new BoundFinder(minTimestamp);
			for await (const log of scanner.backwardScan()) {
				if (lowerBound.reachedLowerBound(log)) {
					break;
				}
			}

			const lowerByteOffset = scanner.calculateByteOffset();
			await scanner.goto(await binarySearch(this._vfs, totalSize, maxTimestamp));

			const upperBound = new BoundFinder(maxTimestamp);
			for await (const log of scanner.forwardScan()) {
				if (upperBound.reachedUpperBound(log)) {
					break;
				}
			}

			let upperByteOffset = scanner.calculateByteOffset();
			while (upperByteOffset > lowerByteOffset) {
				const byteLength = Math.min(PAGE_SIZE, upperByteOffset - lowerByteOffset);
				upperByteOffset -= byteLength;
				yield prependLength(await this._vfs.read(upperByteOffset, byteLength));
			}
		} finally {
			await this._vfs.teardown();
		}
	}

	async *bulkTail(minTimestamp = Date.now(), { pollInterval = 200 } = {}) {
		if (!Number.isInteger(minTimestamp)) {
			throw new TypeError('Expected minTimestamp to be an integer');
		}
		if (!Number.isInteger(pollInterval)) {
			throw new TypeError('Expected options.pollInterval to be an integer');
		}
		if (minTimestamp < 0) {
			throw new RangeError('Expected minTimestamp to be non-negative');
		}
		if (pollInterval < 1) {
			throw new RangeError('Expected options.pollInterval to be at least 1 ms');
		}
		if (pollInterval > 0x7fffffff) {
			throw new RangeError('Expected options.pollInterval to be no greater than 2147483647');
		}
		if (!this._vfs.closed || this._vfs.busy) {
			throw new Error('LogReader is already busy with another operation');
		}

		await this._vfs.setup();
		try {
			let totalSize = await this._vfs.size();
			const scanner = new Scanner(this._vfs, totalSize);
			await scanner.goto(await binarySearch(this._vfs, totalSize, minTimestamp));

			const lowerBound = new BoundFinder(minTimestamp);
			for await (const log of scanner.backwardScan()) {
				if (lowerBound.reachedLowerBound(log)) {
					break;
				}
			}

			let byteOffset = scanner.calculateByteOffset();
			for (;;) {
				while (byteOffset < totalSize) {
					const byteLength = Math.min(PAGE_SIZE, totalSize - byteOffset);
					yield await this._vfs.read(byteOffset, byteLength);
					byteOffset += byteLength;
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
		} finally {
			await this._vfs.teardown();
		}
	}
};

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function prependLength(chunk) {
	const length = chunk.byteLength;
	const result = new Uint8Array(length + 4);

	result[0] = length >>> 24;
	result[1] = length >>> 16;
	result[2] = length >>> 8;
	result[3] = length;
	result.set(chunk, 4);

	return result;
}
