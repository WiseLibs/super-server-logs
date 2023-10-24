'use strict';
const fs = require('fs/promises');
const { MasterLogger, Vfs } = require('..');
const binarySearch = require('../src/shared/binary-search');

const START_TIME = 1000000000000;
const LOGS_PER_BLOCK = 4;

describe('binarySearch()', function () {
	this.slow(500);

	describe('returns the approximate byte offset of a given log timestamp', function () {
		let vfs;
		let endTime;
		let totalTime;
		let totalSize;
		let pageCount

		before(async function () {
			this.timeout(10000);
			endTime = writeLogs(util.next(), 100000, 100);
			totalTime = endTime - START_TIME;
			vfs = await createVfs(util.current());
			totalSize = await vfs.size();
			pageCount = Math.ceil(totalSize / Vfs.PAGE_SIZE);
		});

		after(async function () {
			if (vfs && !vfs.closed) {
				await vfs.teardown();
			}
		});

		afterEach(function () {
			vfs.readCount = 0;
		});

		specify('timestamp before the first log', async function () {
			expect(await binarySearch(vfs, totalSize, START_TIME - 10)).to.equal(0);
			expect(vfs.readCount).to.be.below(14);
		});

		specify('timestamp equal to the first log', async function () {
			expect(await binarySearch(vfs, totalSize, START_TIME)).to.equal(0);
			expect(vfs.readCount).to.be.below(14);
		});

		specify('timestamp within the first half of logs', async function () {
			const desiredTimestamp = Math.floor(START_TIME + totalTime / 3);
			const pageNumber = Math.floor(pageCount / 3);
			const minOffset = (pageNumber - 3) * Vfs.PAGE_SIZE;
			const maxOffset = (pageNumber + 3) * Vfs.PAGE_SIZE;
			expect(await binarySearch(vfs, totalSize, desiredTimestamp))
				.to.be.within(minOffset, maxOffset);
			expect(vfs.readCount).to.be.below(14);
		});

		specify('timestamp equal to the middle log', async function () {
			const desiredTimestamp = Math.floor(START_TIME + totalTime / 2);
			const pageNumber = Math.floor(pageCount / 2);
			const minOffset = (pageNumber - 3) * Vfs.PAGE_SIZE;
			const maxOffset = (pageNumber + 3) * Vfs.PAGE_SIZE;
			expect(await binarySearch(vfs, totalSize, desiredTimestamp))
				.to.be.within(minOffset, maxOffset);
			expect(vfs.readCount).to.be.below(14);
		});

		specify('timestamp within the last half of logs', async function () {
			const desiredTimestamp = Math.floor(START_TIME + totalTime * 2 / 3);
			const pageNumber = Math.floor(pageCount * 2 / 3);
			const minOffset = (pageNumber - 3) * Vfs.PAGE_SIZE;
			const maxOffset = (pageNumber + 3) * Vfs.PAGE_SIZE;
			expect(await binarySearch(vfs, totalSize, desiredTimestamp))
				.to.be.within(minOffset, maxOffset);
			expect(vfs.readCount).to.be.below(14);
		});

		specify('timestamp equal to the last log', async function () {
			const desiredTimestamp = START_TIME + totalTime - 10;
			const lastPageOffset = (pageCount - 1) * Vfs.PAGE_SIZE;
			expect(await binarySearch(vfs, totalSize, desiredTimestamp)).to.equal(lastPageOffset);
			expect(vfs.readCount).to.be.below(14);
		});

		specify('timestamp after the last log', async function () {
			const desiredTimestamp = START_TIME + totalTime;
			const lastPageOffset = (pageCount - 1) * Vfs.PAGE_SIZE;
			expect(await binarySearch(vfs, totalSize, desiredTimestamp)).to.equal(lastPageOffset);
			expect(vfs.readCount).to.be.below(14);
		});
	});

	describe('supports unusual page layouts', function () {
		let vfs;

		afterEach(async function () {
			if (vfs && !vfs.closed) {
				await vfs.teardown();
			}
		});

		specify('zero pages', async function () {
			await fs.writeFile(util.next(), '');
			vfs = await createVfs(util.current());
			const totalSize = await vfs.size();
			expect(await binarySearch(vfs, totalSize, START_TIME)).to.equal(0);
			expect(vfs.readCount).to.be.below(2);
		});

		specify('one page', async function () {
			writeLogs(util.next(), 1, 100);
			vfs = await createVfs(util.current());
			const totalSize = await vfs.size();
			expect(await binarySearch(vfs, totalSize, START_TIME)).to.equal(0);
			expect(vfs.readCount).to.be.below(2);
		});

		specify('pages with no separators', async function () {
			this.slow(1500);
			const endTime = writeLogs(util.next(), 1000, 10000);
			const totalTime = endTime - START_TIME;
			vfs = await createVfs(util.current());
			const totalSize = await vfs.size();
			const pageCount = Math.ceil(totalSize / Vfs.PAGE_SIZE);
			const expectedReadFactor = Math.ceil(10000 * LOGS_PER_BLOCK / Vfs.PAGE_SIZE);

			expect(await binarySearch(vfs, totalSize, START_TIME))
				.to.be.within(0, expectedReadFactor * Vfs.PAGE_SIZE);
			expect(vfs.readCount).to.be.below(14 * expectedReadFactor);
			vfs.readCount = 0;

			expect(await binarySearch(vfs, totalSize, START_TIME + totalTime - 10))
				.to.above((pageCount - 2 - expectedReadFactor) * Vfs.PAGE_SIZE);
			expect(vfs.readCount).to.be.below(14 * expectedReadFactor);
			vfs.readCount = 0;

			const pageNumber = Math.floor(pageCount / 2);
			const minOffset = (pageNumber - 3 - expectedReadFactor) * Vfs.PAGE_SIZE;
			const maxOffset = (pageNumber + 3 + expectedReadFactor) * Vfs.PAGE_SIZE;
			expect(await binarySearch(vfs, totalSize, Math.floor(START_TIME + totalTime / 2)))
				.to.be.within(minOffset, maxOffset);
			expect(vfs.readCount).to.be.below(14 * expectedReadFactor);
		});
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
			vfs.readCount += 1;
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

	vfs.readCount = 0;
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
