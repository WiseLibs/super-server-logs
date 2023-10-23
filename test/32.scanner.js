'use strict';
const fs = require('fs/promises');
const { MasterLogger, Vfs } = require('..');
const Scanner = require('../src/shared/scanner');

const START_TIME = 1000000000000;
const LOGS_PER_BLOCK = 4;

describe('Scanner', function () {
	this.slow(500);
	let vfs;

	afterEach(async function () {
		if (vfs && !vfs.closed) {
			await vfs.teardown();
		}
	});

	it('can scan forward from the beginning (by default)', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		const timestamps = [];
		for await (const log of scanner.forwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([...Array(5000)].map((_, i) => START_TIME + i * 10));
	});

	it('can scan forward from the beginning (offset === 0)', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		await scanner.goto(0);
		const timestamps = [];
		for await (const log of scanner.forwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([...Array(5000)].map((_, i) => START_TIME + i * 10));
	});

	it('can scan forward from the end (offset === totalSize)', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		await scanner.goto(totalSize);
		const timestamps = [];
		for await (const log of scanner.forwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([]);
	});

	it('can scan backward from the end (offset === totalSize)', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		await scanner.goto(totalSize);
		const timestamps = [];
		for await (const log of scanner.backwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([...Array(5000)].map((_, i) => START_TIME + i * 10).reverse());
	});

	it('can scan backward from the beginning (offset === 0)', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		await scanner.goto(0);
		const timestamps = [];
		for await (const log of scanner.backwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([]);
	});

	it('can jump to a given byte offset and scan forward', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		await scanner.goto(Math.floor(totalSize / 2));

		const timestamps = [];
		for await (const log of scanner.forwardScan()) {
			timestamps.push(log.timestamp);
		}

		const expectedTimestamps = [...Array(2500)].map((_, i) => START_TIME + (i + 2500) * 10);
		if (timestamps[0] < expectedTimestamps[0]) {
			const additional = [];
			for (const timestamp of timestamps) {
				if (timestamp < expectedTimestamps[0]) {
					additional.push(timestamp);
				}
			}
			expect(additional.length).to.be.below(Vfs.PAGE_SIZE / 100);
			timestamps.splice(0, additional.length);
		} else {
			const missing = [];
			for (const expectedTimestamp of expectedTimestamps) {
				if (timestamps[0] > expectedTimestamp) {
					missing.push(expectedTimestamp);
				}
			}
			expect(missing.length).to.be.below(Vfs.PAGE_SIZE / 100);
			timestamps.splice(0, 0, ...missing);
		}

		expect(timestamps).to.deep.equal(expectedTimestamps);
	});

	it('can jump to a given byte offset and scan backward', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		await scanner.goto(Math.floor(totalSize / 2));

		const timestamps = [];
		for await (const log of scanner.backwardScan()) {
			timestamps.push(log.timestamp);
		}

		const expectedTimestamps = [...Array(2500)].map((_, i) => START_TIME + i * 10).reverse();
		if (timestamps[0] > expectedTimestamps[0]) {
			const additional = [];
			for (const timestamp of timestamps) {
				if (timestamp > expectedTimestamps[0]) {
					additional.push(timestamp);
				}
			}
			expect(additional.length).to.be.below(Vfs.PAGE_SIZE / 100);
			timestamps.splice(0, additional.length);
		} else {
			const missing = [];
			for (const expectedTimestamp of expectedTimestamps) {
				if (timestamps[0] < expectedTimestamp) {
					missing.push(expectedTimestamp);
				}
			}
			expect(missing.length).to.be.below(Vfs.PAGE_SIZE / 100);
			timestamps.splice(0, 0, ...missing);
		}

		expect(timestamps).to.deep.equal(expectedTimestamps);
	});

	it('can reverse the scan direction at any time', async function () {
		this.slow(2500);
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);

		for (const ratio of [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]) {
			await scanner.goto(Math.floor(totalSize * ratio));

			const timestamps = [];
			for await (const log of scanner.forwardScan()) {
				timestamps.push(log.timestamp);
				if (timestamps.length === 5) break;
			}
			for await (const log of scanner.backwardScan()) {
				timestamps.push(log.timestamp);
				if (timestamps.length === 6) break;
			}
			for await (const log of scanner.forwardScan()) {
				timestamps.push(log.timestamp);
				if (timestamps.length === 8) break;
			}
			for await (const log of scanner.backwardScan()) {
				timestamps.push(log.timestamp);
				if (timestamps.length === 20) break;
			}
			for await (const log of scanner.forwardScan()) {
				timestamps.push(log.timestamp);
				if (timestamps.length === 24) break;
			}
			for await (const log of scanner.forwardScan()) {
				timestamps.push(log.timestamp);
				if (timestamps.length === 30) break;
			}

			const first = timestamps[0];
			expect(timestamps).to.deep.equal([
				first, // start first loop
				first + 10,
				first + 20,
				first + 30,
				first + 40, // end first loop
				first + 40, // start second loop, end second loop
				first + 40, // start third loop
				first + 50, // end third loop
				first + 50, // start fourth loop
				first + 40,
				first + 30,
				first + 20,
				first + 10,
				first,
				first - 10,
				first - 20,
				first - 30,
				first - 40,
				first - 50,
				first - 60, // end fourth loop
				first - 60, // start fifth loop
				first - 50,
				first - 40,
				first - 30,
				first - 20,
				first - 10,
				first,
				first + 10,
				first + 20,
				first + 30, // end fifth loop
			]);
		}
	});

	it('can reverse the scan direction at the beginning', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		await scanner.goto(Math.floor(totalSize / 2));
		const timestamps = [];
		for await (const log of scanner.backwardScan()) { /* no-op */ }
		for await (const log of scanner.forwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([...Array(5000)].map((_, i) => START_TIME + i * 10));
	});

	it('can reverse the scan direction at the end (with a complete block)', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		const timestamps = [];
		for await (const log of scanner.forwardScan()) { /* no-op */ }
		for await (const log of scanner.backwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([...Array(5000)].map((_, i) => START_TIME + i * 10).reverse());
	});

	it('can reverse the scan direction at the end (with an incomplete block)', async function () {
		writeLogs(util.next(), 5000, 100);
		await fs.appendFile(util.current(), Buffer.allocUnsafe(100).fill(200));
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		const timestamps = [];
		for await (const log of scanner.forwardScan()) { /* no-op */ }
		for await (const log of scanner.backwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([...Array(5000)].map((_, i) => START_TIME + i * 10).reverse());
	});

	it('can reverse the scan direction at the end (with a large incomplete block)', async function () {
		writeLogs(util.next(), 5000, 100);
		await fs.appendFile(util.current(), Buffer.allocUnsafe(1024 * 128).fill(200));
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		const timestamps = [];
		for await (const log of scanner.forwardScan()) { /* no-op */ }
		for await (const log of scanner.backwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([...Array(5000)].map((_, i) => START_TIME + i * 10).reverse());
	});

	it('can reverse the scan direction while the position is in a forward tail', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		expect(scanner._tailLength).to.be.a('number');
		expect(scanner._isBlockBundary).to.be.a('boolean');
		const timestamps = [];
		for await (const log of scanner.forwardScan()) {
			timestamps.push(log.timestamp);
			if (scanner._tailLength > 0 && scanner._isBlockBundary === true) {
				break;
			}
		}
		const reversedTimestamps = [];
		for await (const log of scanner.backwardScan()) {
			reversedTimestamps.push(log.timestamp);
		}
		expect(timestamps).to.deep.equal(reversedTimestamps.reverse());
	});

	it('can reverse the scan direction while the position is in a backward tail', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		expect(scanner._tailLength).to.be.a('number');
		expect(scanner._isBlockBundary).to.be.a('boolean');
		await scanner.goto(totalSize);
		const timestamps = [];
		for await (const log of scanner.backwardScan()) {
			timestamps.push(log.timestamp);
			if (scanner._tailLength < 0 && scanner._isBlockBundary === true) {
				break;
			}
		}
		const reversedTimestamps = [];
		for await (const log of scanner.forwardScan()) {
			reversedTimestamps.push(log.timestamp);
		}
		expect(timestamps).to.deep.equal(reversedTimestamps.reverse());
	});

	it('can jump to the middle of the last block, scan forward, then backward', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		await scanner.goto(totalSize - 10);
		const timestamps = [];
		for await (const log of scanner.forwardScan()) throw new Error('Unexpected log');
		for await (const log of scanner.backwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([...Array(5000)].map((_, i) => START_TIME + i * 10).reverse());
	});

	it('can update the Vfs size when not on the last page', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, Math.floor(totalSize / 2));
		const timestamps = [];
		await scanner.updateSize(totalSize);
		for await (const log of scanner.forwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([...Array(5000)].map((_, i) => START_TIME + i * 10));
	});

	it('can update the Vfs size after scanning to the last page', async function () {
		writeLogs(util.next(), 5000, 100);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, Math.floor(totalSize / 2));
		const timestamps = [];
		for await (const log of scanner.forwardScan()) timestamps.push(log.timestamp);
		expect(timestamps.length).to.be.within(2000, 3000);
		await scanner.updateSize(totalSize);
		for await (const log of scanner.forwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([...Array(5000)].map((_, i) => START_TIME + i * 10));
	});

	it('works correctly with very large blocks', async function () {
		writeLogs(util.next(), 25, 20000);
		vfs = await createVfs(util.current());
		const totalSize = await vfs.size();
		const scanner = new Scanner(vfs, totalSize);
		await scanner.goto(Math.floor(totalSize / 2));

		let timestamps = [];
		for await (const log of scanner.forwardScan()) {
			timestamps.push(log.timestamp);
			if (timestamps.length === 5) break;
		}
		for await (const log of scanner.backwardScan()) {
			timestamps.push(log.timestamp);
			if (timestamps.length === 6) break;
		}
		for await (const log of scanner.forwardScan()) {
			timestamps.push(log.timestamp);
			if (timestamps.length === 8) break;
		}
		for await (const log of scanner.backwardScan()) {
			timestamps.push(log.timestamp);
			if (timestamps.length === 20) break;
		}
		for await (const log of scanner.forwardScan()) {
			timestamps.push(log.timestamp);
			if (timestamps.length === 24) break;
		}
		for await (const log of scanner.forwardScan()) {
			timestamps.push(log.timestamp);
			if (timestamps.length === 30) break;
		}

		const first = timestamps[0];
		expect(timestamps).to.deep.equal([
			first, // start first loop
			first + 10,
			first + 20,
			first + 30,
			first + 40, // end first loop
			first + 40, // start second loop, end second loop
			first + 40, // start third loop
			first + 50, // end third loop
			first + 50, // start fourth loop
			first + 40,
			first + 30,
			first + 20,
			first + 10,
			first,
			first - 10,
			first - 20,
			first - 30,
			first - 40,
			first - 50,
			first - 60, // end fourth loop
			first - 60, // start fifth loop
			first - 50,
			first - 40,
			first - 30,
			first - 20,
			first - 10,
			first,
			first + 10,
			first + 20,
			first + 30, // end fifth loop
		]);

		await scanner.goto(0);
		timestamps = [];
		for await (const log of scanner.forwardScan()) timestamps.push(log.timestamp);
		expect(timestamps).to.deep.equal([...Array(25)].map((_, i) => START_TIME + i * 10));
	});
});

async function createVfs(filename) {
	let handle;
	const vfs = new Vfs({
		async setup() {
			handle = await fs.open(filename);
		},
		async teardown() {
			await handle.close();
		},
		async read(byteOffset, byteLength) {
			const chunk = Buffer.allocUnsafe(byteLength);
			const { bytesRead } = await handle.read(chunk, 0, byteLength, byteOffset);
			if (bytesRead < byteLength) return chunk.subarray(0, bytesRead);
			return chunk;
		},
		async size() {
			const { size } = await handle.stat();
			return size;
		},
	});

	await vfs.setup();
	return vfs;
}

function writeLogs(filename, logCount, logSize) {
	const originalNow = Date.now;
	let currentTime = START_TIME;
	Date.now = () => currentTime;
	try {
		const logger = new MasterLogger(filename);
		try {
			for (let i = 0; i < logCount; currentTime = START_TIME + ++i * 10) {
				logger.info(randomString(logSize));
				if (i % LOGS_PER_BLOCK === 0) {
					logger.flush();
				}
			}
		} finally {
			logger.close();
		}
	} finally {
		Date.now = originalNow;
	}
	return currentTime;
}

function randomString(length) {
	const buffer = Buffer.allocUnsafe(length);
	for (let i = 0; i < length; ++i) {
		buffer[i] = Math.random() * 95 + 32;
	}
	return buffer.toString();
}
