'use strict';
const fs = require('fs/promises');
const path = require('path');
const { LogReader, BulkParser, LogDirectorySource, MasterLogger } = require('..');
const { toLogBasename } = require('../src/nodejs/common');

describe('LogReader', function () {
	this.slow(1000);
	const originalNow = Date.now;
	let context;

	beforeEach(function () {
		context = createContext(util.next());
		Date.now = () => context.currentTime;
	});

	afterEach(function () {
		Date.now = originalNow;
	});

	describe('tail()', function () {
		it('yields all logs within a future minimum timestamp bound (inclusive)', async function () {
			const reader = new LogReader(await createVfs(context, { pollInterval: 10 }));
			const minTime = context.currentTime + 100;
			const timestamps = [];
			let lastTimestamp = NaN;
			let lastTimestampRead = NaN;
			await new Promise((resolve, reject) => {
				new Promise(r => setTimeout(r, 20))
					.then(() => writeLogs(context, 500))
					.then(() => {
						lastTimestamp = context.currentTime - 1;
						if (lastTimestampRead === lastTimestamp) {
							setTimeout(resolve, 1000);
						}
					})
					.catch(reject);

				Promise.resolve().then(async () => {
					for await (const log of reader.tail(minTime, { pollInterval: 10 })) {
						timestamps.push(log.timestamp);
						if (log.timestamp === lastTimestamp) break;
						lastTimestampRead = log.timestamp;
					}
				}).then(resolve, reject);
			});
			expect(timestamps.length).to.be.above(395);
			let prevTimestamp = 0;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(minTime - 1);
				expect(timestamp).to.be.above(prevTimestamp - 1);
				prevTimestamp = timestamp;
			}
			expect(prevTimestamp).to.equal(lastTimestamp);
		});

		it('yields all logs within a past minimum timestamp bound (inclusive)', async function () {
			const reader = new LogReader(await createVfs(context, { pollInterval: 10 }));
			const minTime = context.currentTime - 100;
			const timestamps = [];
			let lastTimestamp = NaN;
			let lastTimestampRead = NaN;
			await new Promise((resolve, reject) => {
				new Promise(r => setTimeout(r, 20))
					.then(() => writeLogs(context, 500))
					.then(() => {
						lastTimestamp = context.currentTime - 1;
						if (lastTimestampRead === lastTimestamp) {
							setTimeout(resolve, 1000);
						}
					})
					.catch(reject);

				Promise.resolve().then(async () => {
					for await (const log of reader.tail(minTime, { pollInterval: 10 })) {
						timestamps.push(log.timestamp);
						if (log.timestamp === lastTimestamp) break;
						lastTimestampRead = log.timestamp;
					}
				}).then(resolve, reject);
			});
			expect(timestamps.length).to.be.above(595);
			let prevTimestamp = 0;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(minTime - 1);
				expect(timestamp).to.be.above(prevTimestamp - 1);
				prevTimestamp = timestamp;
			}
			expect(prevTimestamp).to.equal(lastTimestamp);
		});

		it('throws if options.pollInterval is not a positive integer', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.tail(context.currentTime, { pollInterval: null }), TypeError);
			await expectToThrow(reader.tail(context.currentTime, { pollInterval: '1024' }), TypeError);
			await expectToThrow(reader.tail(context.currentTime, { pollInterval: { valueOf: () => 1024 } }), TypeError);
			await expectToThrow(reader.tail(context.currentTime, { pollInterval: BigInt(1024) }), TypeError);
			await expectToThrow(reader.tail(context.currentTime, { pollInterval: 1024.5 }), TypeError);
			await expectToThrow(reader.tail(context.currentTime, { pollInterval: -1024 }), RangeError);
			await expectToThrow(reader.tail(context.currentTime, { pollInterval: -1 }), RangeError);
			await expectToThrow(reader.tail(context.currentTime, { pollInterval: 0 }), RangeError);
		});

		it('throws if options.pollInterval is larger than 2147483647', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.tail(context.currentTime, { pollInterval: 2147483648 }), RangeError);
		});

		it('throws if the minimum timestamp is not a non-negative integer', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.tail(null), TypeError);
			await expectToThrow(reader.tail('1024'), TypeError);
			await expectToThrow(reader.tail({ valueOf: () => 1024 }), TypeError);
			await expectToThrow(reader.tail(BigInt(1024)), TypeError);
			await expectToThrow(reader.tail(1024.5), TypeError);
			await expectToThrow(reader.tail(-1024), RangeError);
			await expectToThrow(reader.tail(-1), RangeError);
		});

		it('throws if called concurrently', async function () {
			const reader = new LogReader(await createVfs(context));
			for await (const _ of reader.tail(context.currentTime - 100)) {
				await expectToThrow(reader.tail(context.currentTime - 100), Error);
				break;
			}
		});
	});

	describe('range()', function () {
		it('yields all logs (ascending) between two timestamp bounds (inclusive)', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 200;
			const maxTime = context.currentTime - 100;
			const timestamps = [];
			for await (const log of reader.range(minTime, maxTime)) {
				timestamps.push(log.timestamp);
			}
			expect(timestamps.length).to.be.within(100, 110);
			let prevTimestamp = 0;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(minTime - 1);
				expect(timestamp).to.be.below(maxTime + 1);
				expect(timestamp).to.be.above(prevTimestamp - 1);
				prevTimestamp = timestamp;
			}
			expect(prevTimestamp).to.equal(maxTime);
		});

		it('works when the maximum timestamp bound exceeds the last log', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 100;
			const maxTime = context.currentTime + 100;
			const timestamps = [];
			for await (const log of reader.range(minTime, maxTime)) {
				timestamps.push(log.timestamp);
			}
			expect(timestamps.length).to.be.within(100, 110);
			let prevTimestamp = 0;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(minTime - 1);
				expect(timestamp).to.be.below(maxTime + 1);
				expect(timestamp).to.be.above(prevTimestamp - 1);
				prevTimestamp = timestamp;
			}
			expect(prevTimestamp).to.equal(context.currentTime);
		});

		it('works when the minimum timestamp bound preceeds the first log', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.startTime - 100;
			const maxTime = context.startTime + 200;
			const timestamps = [];
			for await (const log of reader.range(minTime, maxTime)) {
				timestamps.push(log.timestamp);
			}
			expect(timestamps.length).to.be.within(200, 220);
			let prevTimestamp = 0;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(minTime - 1);
				expect(timestamp).to.be.below(maxTime + 1);
				expect(timestamp).to.be.above(prevTimestamp - 1);
				prevTimestamp = timestamp;
			}
			expect(prevTimestamp).to.equal(maxTime);
		});

		it('works when the minimum timestamp equals the maximum', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 100;
			const maxTime = minTime;
			const timestamps = [];
			for await (const log of reader.range(minTime, maxTime)) {
				timestamps.push(log.timestamp);
			}
			expect(timestamps.length).to.be.within(1, 3);
			for (const timestamp of timestamps) {
				expect(timestamp).to.equal(minTime);
			}
		});

		it('yields nothing when the minimum timestamp is greater than the maximum', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 200;
			const maxTime = context.currentTime - 300;
			const timestamps = [];
			for await (const log of reader.range(minTime, maxTime)) {
				timestamps.push(log.timestamp);
			}
			expect(timestamps.length).to.equal(0);
		});

		it('throws if the minimum timestamp is not a non-negative integer', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.range(null, context.currentTime), TypeError);
			await expectToThrow(reader.range('1024', context.currentTime), TypeError);
			await expectToThrow(reader.range({ valueOf: () => 1024 }, context.currentTime), TypeError);
			await expectToThrow(reader.range(BigInt(1024), context.currentTime), TypeError);
			await expectToThrow(reader.range(1024.5, context.currentTime), TypeError);
			await expectToThrow(reader.range(-1024, context.currentTime), RangeError);
			await expectToThrow(reader.range(-1, context.currentTime), RangeError);
		});

		it('throws if the maximum timestamp is not a non-negative integer', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.range(context.currentTime, null), TypeError);
			await expectToThrow(reader.range(context.currentTime, '1024'), TypeError);
			await expectToThrow(reader.range(context.currentTime, { valueOf: () => 1024 }), TypeError);
			await expectToThrow(reader.range(context.currentTime, BigInt(1024)), TypeError);
			await expectToThrow(reader.range(context.currentTime, 1024.5), TypeError);
			await expectToThrow(reader.range(context.currentTime, -1024), RangeError);
			await expectToThrow(reader.range(context.currentTime, -1), RangeError);
		});

		it('throws if called concurrently', async function () {
			const reader = new LogReader(await createVfs(context));
			for await (const _ of reader.range(context.currentTime - 100, context.currentTime)) {
				await expectToThrow(reader.range(context.currentTime - 100, context.currentTime), Error);
				break;
			}
		});
	});

	describe('rangeReversed()', function () {
		it('yields all logs (descending) between two timestamp bounds (inclusive)', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 200;
			const maxTime = context.currentTime - 100;
			const timestamps = [];
			for await (const log of reader.rangeReversed(minTime, maxTime)) {
				timestamps.push(log.timestamp);
			}
			expect(timestamps.length).to.be.within(100, 110);
			let prevTimestamp = Infinity;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(minTime - 1);
				expect(timestamp).to.be.below(maxTime + 1);
				expect(timestamp).to.be.below(prevTimestamp + 1);
				prevTimestamp = timestamp;
			}
			expect(prevTimestamp).to.equal(minTime);
		});

		it('works when the maximum timestamp bound exceeds the last log', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 100;
			const maxTime = context.currentTime + 100;
			const timestamps = [];
			for await (const log of reader.rangeReversed(minTime, maxTime)) {
				timestamps.push(log.timestamp);
			}
			expect(timestamps.length).to.be.within(100, 110);
			let prevTimestamp = Infinity;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(minTime - 1);
				expect(timestamp).to.be.below(maxTime + 1);
				expect(timestamp).to.be.below(prevTimestamp + 1);
				prevTimestamp = timestamp;
			}
			expect(prevTimestamp).to.equal(minTime);
		});

		it('works when the minimum timestamp bound proceeds the first log', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.startTime - 100;
			const maxTime = context.startTime + 200;
			const timestamps = [];
			for await (const log of reader.rangeReversed(minTime, maxTime)) {
				timestamps.push(log.timestamp);
			}
			expect(timestamps.length).to.be.within(200, 220);
			let prevTimestamp = Infinity;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(minTime - 1);
				expect(timestamp).to.be.below(maxTime + 1);
				expect(timestamp).to.be.below(prevTimestamp + 1);
				prevTimestamp = timestamp;
			}
			expect(prevTimestamp).to.equal(context.startTime);
		});

		it('works when the minimum timestamp equals the maximum', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 100;
			const maxTime = minTime;
			const timestamps = [];
			for await (const log of reader.rangeReversed(minTime, maxTime)) {
				timestamps.push(log.timestamp);
			}
			expect(timestamps.length).to.be.within(1, 3);
			for (const timestamp of timestamps) {
				expect(timestamp).to.equal(minTime);
			}
		});

		it('yields nothing when the minimum timestamp is greater than the maximum', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 200;
			const maxTime = context.currentTime - 300;
			const timestamps = [];
			for await (const log of reader.rangeReversed(minTime, maxTime)) {
				timestamps.push(log.timestamp);
			}
			expect(timestamps.length).to.equal(0);
		});

		it('throws if the minimum timestamp is not a non-negative integer', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.rangeReversed(null, context.currentTime), TypeError);
			await expectToThrow(reader.rangeReversed('1024', context.currentTime), TypeError);
			await expectToThrow(reader.rangeReversed({ valueOf: () => 1024 }, context.currentTime), TypeError);
			await expectToThrow(reader.rangeReversed(BigInt(1024), context.currentTime), TypeError);
			await expectToThrow(reader.rangeReversed(1024.5, context.currentTime), TypeError);
			await expectToThrow(reader.rangeReversed(-1024, context.currentTime), RangeError);
			await expectToThrow(reader.rangeReversed(-1, context.currentTime), RangeError);
		});

		it('throws if the maximum timestamp is not a non-negative integer', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.rangeReversed(context.currentTime, null), TypeError);
			await expectToThrow(reader.rangeReversed(context.currentTime, '1024'), TypeError);
			await expectToThrow(reader.rangeReversed(context.currentTime, { valueOf: () => 1024 }), TypeError);
			await expectToThrow(reader.rangeReversed(context.currentTime, BigInt(1024)), TypeError);
			await expectToThrow(reader.rangeReversed(context.currentTime, 1024.5), TypeError);
			await expectToThrow(reader.rangeReversed(context.currentTime, -1024), RangeError);
			await expectToThrow(reader.rangeReversed(context.currentTime, -1), RangeError);
		});

		it('throws if called concurrently', async function () {
			const reader = new LogReader(await createVfs(context));
			for await (const _ of reader.rangeReversed(context.currentTime - 100, context.currentTime)) {
				await expectToThrow(reader.rangeReversed(context.currentTime - 100, context.currentTime), Error);
				break;
			}
		});
	});

	describe('bulkTail()', function () {
		it('yields a bulk stream with a future minimum timestamp bound (inclusive)', async function () {
			const reader = new LogReader(await createVfs(context, { pollInterval: 10 }));
			const minTime = context.currentTime + 100;
			const timestamps = [];
			let lastTimestamp = NaN;
			let lastTimestampRead = NaN;
			await new Promise((resolve, reject) => {
				new Promise(r => setTimeout(r, 20))
					.then(() => writeLogs(context, 500))
					.then(() => {
						lastTimestamp = context.currentTime - 1;
						if (lastTimestampRead === lastTimestamp) {
							setTimeout(resolve, 1000);
						}
					})
					.catch(reject);

				Promise.resolve().then(async () => {
					for await (const block of BulkParser.read(reader.bulkTail(minTime, { pollInterval: 10 }))) {
						expect(block).to.be.an.instanceof(Uint8Array);
						for (const log of BulkParser.parse(block)) {
							timestamps.push(log.timestamp);
							if (log.timestamp === lastTimestamp) return;
							lastTimestampRead = log.timestamp;
						}
					}
				}).then(resolve, reject);
			});
			expect(timestamps.length).to.be.above(395);
			expect(timestamps.length).to.be.below(580);
			let prevTimestamp = 0;
			let firstTimestamp = NaN;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(prevTimestamp - 1);
				prevTimestamp = timestamp;
				firstTimestamp = firstTimestamp || timestamp;
			}
			expect(prevTimestamp).to.equal(lastTimestamp);
			expect(firstTimestamp).to.be.below(minTime);
		});

		it('yields a bulk stream with a past minimum timestamp bound (inclusive)', async function () {
			const reader = new LogReader(await createVfs(context, { pollInterval: 10 }));
			const minTime = context.currentTime - 100;
			const timestamps = [];
			let lastTimestamp = NaN;
			let lastTimestampRead = NaN;
			await new Promise((resolve, reject) => {
				new Promise(r => setTimeout(r, 20))
					.then(() => writeLogs(context, 500))
					.then(() => {
						lastTimestamp = context.currentTime - 1;
						if (lastTimestampRead === lastTimestamp) {
							setTimeout(resolve, 1000);
						}
					})
					.catch(reject);

				Promise.resolve().then(async () => {
					for await (const block of BulkParser.read(reader.bulkTail(minTime, { pollInterval: 10 }))) {
						expect(block).to.be.an.instanceof(Uint8Array);
						for (const log of BulkParser.parse(block)) {
							timestamps.push(log.timestamp);
							if (log.timestamp === lastTimestamp) return;
							lastTimestampRead = log.timestamp;
						}
					}
				}).then(resolve, reject);
			});
			expect(timestamps.length).to.be.above(595);
			expect(timestamps.length).to.be.below(780);
			let prevTimestamp = 0;
			let firstTimestamp = NaN;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(prevTimestamp - 1);
				prevTimestamp = timestamp;
				firstTimestamp = firstTimestamp || timestamp;
			}
			expect(prevTimestamp).to.equal(lastTimestamp);
			expect(firstTimestamp).to.be.below(minTime);
		});

		it('throws if options.pollInterval is not a positive integer', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.bulkTail(context.currentTime, { pollInterval: null }), TypeError);
			await expectToThrow(reader.bulkTail(context.currentTime, { pollInterval: '1024' }), TypeError);
			await expectToThrow(reader.bulkTail(context.currentTime, { pollInterval: { valueOf: () => 1024 } }), TypeError);
			await expectToThrow(reader.bulkTail(context.currentTime, { pollInterval: BigInt(1024) }), TypeError);
			await expectToThrow(reader.bulkTail(context.currentTime, { pollInterval: 1024.5 }), TypeError);
			await expectToThrow(reader.bulkTail(context.currentTime, { pollInterval: -1024 }), RangeError);
			await expectToThrow(reader.bulkTail(context.currentTime, { pollInterval: -1 }), RangeError);
			await expectToThrow(reader.bulkTail(context.currentTime, { pollInterval: 0 }), RangeError);
		});

		it('throws if options.pollInterval is larger than 2147483647', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.tail(context.currentTime, { pollInterval: 2147483648 }), RangeError);
		});

		it('throws if the minimum timestamp is not a non-negative integer', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.bulkTail(null), TypeError);
			await expectToThrow(reader.bulkTail('1024'), TypeError);
			await expectToThrow(reader.bulkTail({ valueOf: () => 1024 }), TypeError);
			await expectToThrow(reader.bulkTail(BigInt(1024)), TypeError);
			await expectToThrow(reader.bulkTail(1024.5), TypeError);
			await expectToThrow(reader.bulkTail(-1024), RangeError);
			await expectToThrow(reader.bulkTail(-1), RangeError);
		});

		it('throws if called concurrently', async function () {
			const reader = new LogReader(await createVfs(context));
			for await (const _ of reader.bulkTail(context.currentTime - 100)) {
				await expectToThrow(reader.bulkTail(context.currentTime - 100), Error);
				break;
			}
		});
	});

	describe('bulkRange()', function () {
		it('yields a bulk stream of all logs between two timestamp bounds', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 200;
			const maxTime = context.currentTime - 100;
			const timestamps = [];
			for await (const block of BulkParser.read(reader.bulkRange(minTime, maxTime))) {
				for (const log of BulkParser.parse(block)) {
					timestamps.push(log.timestamp);
				}
			}
			expect(timestamps.length).to.be.within(100, 230);
			let prevTimestamp = 0;
			let firstTimestamp = NaN;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(prevTimestamp - 1);
				prevTimestamp = timestamp;
				firstTimestamp = firstTimestamp || timestamp;
			}
			expect(prevTimestamp).to.be.above(maxTime);
			expect(firstTimestamp).to.be.below(minTime);
		});

		it('works when the maximum timestamp bound exceeds the last log', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 100;
			const maxTime = context.currentTime + 100;
			const timestamps = [];
			for await (const block of BulkParser.read(reader.bulkRange(minTime, maxTime))) {
				for (const log of BulkParser.parse(block)) {
					timestamps.push(log.timestamp);
				}
			}
			expect(timestamps.length).to.be.within(100, 230);
			let prevTimestamp = 0;
			let firstTimestamp = NaN;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(prevTimestamp - 1);
				prevTimestamp = timestamp;
				firstTimestamp = firstTimestamp || timestamp;
			}
			expect(prevTimestamp).to.equal(context.currentTime);
			expect(firstTimestamp).to.be.below(minTime);
		});

		it('works when the minimum timestamp bound preceeds the first log', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.startTime - 100;
			const maxTime = context.startTime + 200;
			const timestamps = [];
			for await (const block of BulkParser.read(reader.bulkRange(minTime, maxTime))) {
				for (const log of BulkParser.parse(block)) {
					timestamps.push(log.timestamp);
				}
			}
			expect(timestamps.length).to.be.within(200, 220);
			let prevTimestamp = 0;
			let firstTimestamp = NaN;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(prevTimestamp - 1);
				prevTimestamp = timestamp;
				firstTimestamp = firstTimestamp || timestamp;
			}
			expect(prevTimestamp).to.be.above(maxTime);
			expect(firstTimestamp).to.equal(context.startTime);
		});

		it('works when the minimum timestamp equals the maximum', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 100;
			const maxTime = minTime;
			const timestamps = [];
			for await (const block of BulkParser.read(reader.bulkRange(minTime, maxTime))) {
				for (const log of BulkParser.parse(block)) {
					timestamps.push(log.timestamp);
				}
			}
			expect(timestamps.length).to.be.within(2, 123);
			let prevTimestamp = 0;
			let firstTimestamp = NaN;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.above(prevTimestamp - 1);
				prevTimestamp = timestamp;
				firstTimestamp = firstTimestamp || timestamp;
			}
			expect(prevTimestamp).to.be.above(maxTime);
			expect(firstTimestamp).to.be.below(minTime);
		});

		it('yields nothing when the minimum timestamp is greater than the maximum', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 200;
			const maxTime = context.currentTime - 300;
			const timestamps = [];
			for await (const block of BulkParser.read(reader.bulkRange(minTime, maxTime))) {
				for (const log of BulkParser.parse(block)) {
					timestamps.push(log.timestamp);
				}
			}
			expect(timestamps.length).to.equal(0);
		});

		it('throws if the minimum timestamp is not a non-negative integer', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.bulkRange(null, context.currentTime), TypeError);
			await expectToThrow(reader.bulkRange('1024', context.currentTime), TypeError);
			await expectToThrow(reader.bulkRange({ valueOf: () => 1024 }, context.currentTime), TypeError);
			await expectToThrow(reader.bulkRange(BigInt(1024), context.currentTime), TypeError);
			await expectToThrow(reader.bulkRange(1024.5, context.currentTime), TypeError);
			await expectToThrow(reader.bulkRange(-1024, context.currentTime), RangeError);
			await expectToThrow(reader.bulkRange(-1, context.currentTime), RangeError);
		});

		it('throws if the maximum timestamp is not a non-negative integer', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.bulkRange(context.currentTime, null), TypeError);
			await expectToThrow(reader.bulkRange(context.currentTime, '1024'), TypeError);
			await expectToThrow(reader.bulkRange(context.currentTime, { valueOf: () => 1024 }), TypeError);
			await expectToThrow(reader.bulkRange(context.currentTime, BigInt(1024)), TypeError);
			await expectToThrow(reader.bulkRange(context.currentTime, 1024.5), TypeError);
			await expectToThrow(reader.bulkRange(context.currentTime, -1024), RangeError);
			await expectToThrow(reader.bulkRange(context.currentTime, -1), RangeError);
		});

		it('throws if called concurrently', async function () {
			const reader = new LogReader(await createVfs(context));
			for await (const _ of reader.bulkRange(context.currentTime - 100, context.currentTime)) {
				await expectToThrow(reader.bulkRange(context.currentTime - 100, context.currentTime), Error);
				break;
			}
		});
	});

	describe('bulkRangeReversed()', function () {
		it('yields a reverse bulk stream of all logs between two timestamp bounds', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 200;
			const maxTime = context.currentTime - 100;
			const timestamps = [];
			for await (const block of BulkParser.readReversed(reader.bulkRangeReversed(minTime, maxTime))) {
				for (const log of [...BulkParser.parse(block)].reverse()) {
					timestamps.push(log.timestamp);
				}
			}
			expect(timestamps.length).to.be.within(100, 230);
			let prevTimestamp = Infinity;
			let firstTimestamp = NaN;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.below(prevTimestamp + 1);
				prevTimestamp = timestamp;
				firstTimestamp = firstTimestamp || timestamp;
			}
			expect(prevTimestamp).to.be.below(minTime);
			expect(firstTimestamp).to.be.above(maxTime);
		});

		it('works when the maximum timestamp bound exceeds the last log', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 100;
			const maxTime = context.currentTime + 100;
			const timestamps = [];
			for await (const block of BulkParser.readReversed(reader.bulkRangeReversed(minTime, maxTime))) {
				for (const log of [...BulkParser.parse(block)].reverse()) {
					timestamps.push(log.timestamp);
				}
			}
			expect(timestamps.length).to.be.within(100, 230);
			let prevTimestamp = Infinity;
			let firstTimestamp = NaN;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.below(prevTimestamp + 1);
				prevTimestamp = timestamp;
				firstTimestamp = firstTimestamp || timestamp;
			}
			expect(prevTimestamp).to.be.below(minTime);
			expect(firstTimestamp).to.equal(context.currentTime);
		});

		it('works when the minimum timestamp bound preceeds the first log', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.startTime - 100;
			const maxTime = context.startTime + 200;
			const timestamps = [];
			for await (const block of BulkParser.readReversed(reader.bulkRangeReversed(minTime, maxTime))) {
				for (const log of [...BulkParser.parse(block)].reverse()) {
					timestamps.push(log.timestamp);
				}
			}
			expect(timestamps.length).to.be.within(200, 220);
			let prevTimestamp = Infinity;
			let firstTimestamp = NaN;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.below(prevTimestamp + 1);
				prevTimestamp = timestamp;
				firstTimestamp = firstTimestamp || timestamp;
			}
			expect(prevTimestamp).to.equal(context.startTime);
			expect(firstTimestamp).to.be.above(maxTime);
		});

		it('works when the minimum timestamp equals the maximum', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 100;
			const maxTime = minTime;
			const timestamps = [];
			for await (const block of BulkParser.readReversed(reader.bulkRangeReversed(minTime, maxTime))) {
				for (const log of [...BulkParser.parse(block)].reverse()) {
					timestamps.push(log.timestamp);
				}
			}
			expect(timestamps.length).to.be.within(2, 123);
			let prevTimestamp = Infinity;
			let firstTimestamp = NaN;
			for (const timestamp of timestamps) {
				expect(timestamp).to.be.below(prevTimestamp + 1);
				prevTimestamp = timestamp;
				firstTimestamp = firstTimestamp || timestamp;
			}
			expect(prevTimestamp).to.be.below(minTime);
			expect(firstTimestamp).to.be.above(maxTime);
		});

		it('yields nothing when the minimum timestamp is greater than the maximum', async function () {
			const reader = new LogReader(await createVfs(context));
			const minTime = context.currentTime - 200;
			const maxTime = context.currentTime - 300;
			const timestamps = [];
			for await (const block of BulkParser.readReversed(reader.bulkRangeReversed(minTime, maxTime))) {
				for (const log of [...BulkParser.parse(block)].reverse()) {
					timestamps.push(log.timestamp);
				}
			}
			expect(timestamps.length).to.equal(0);
		});

		it('throws if the minimum timestamp is not a non-negative integer', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.bulkRangeReversed(null, context.currentTime), TypeError);
			await expectToThrow(reader.bulkRangeReversed('1024', context.currentTime), TypeError);
			await expectToThrow(reader.bulkRangeReversed({ valueOf: () => 1024 }, context.currentTime), TypeError);
			await expectToThrow(reader.bulkRangeReversed(BigInt(1024), context.currentTime), TypeError);
			await expectToThrow(reader.bulkRangeReversed(1024.5, context.currentTime), TypeError);
			await expectToThrow(reader.bulkRangeReversed(-1024, context.currentTime), RangeError);
			await expectToThrow(reader.bulkRangeReversed(-1, context.currentTime), RangeError);
		});

		it('throws if the maximum timestamp is not a non-negative integer', async function () {
			const reader = new LogReader(await createVfs(context));
			await expectToThrow(reader.bulkRangeReversed(context.currentTime, null), TypeError);
			await expectToThrow(reader.bulkRangeReversed(context.currentTime, '1024'), TypeError);
			await expectToThrow(reader.bulkRangeReversed(context.currentTime, { valueOf: () => 1024 }), TypeError);
			await expectToThrow(reader.bulkRangeReversed(context.currentTime, BigInt(1024)), TypeError);
			await expectToThrow(reader.bulkRangeReversed(context.currentTime, 1024.5), TypeError);
			await expectToThrow(reader.bulkRangeReversed(context.currentTime, -1024), RangeError);
			await expectToThrow(reader.bulkRangeReversed(context.currentTime, -1), RangeError);
		});

		it('throws if called concurrently', async function () {
			const reader = new LogReader(await createVfs(context));
			for await (const _ of reader.bulkRangeReversed(context.currentTime - 100, context.currentTime)) {
				await expectToThrow(reader.bulkRangeReversed(context.currentTime - 100, context.currentTime), Error);
				break;
			}
		});
	});
});

async function createVfs(context, options, logCount) {
	await fs.mkdir(context.dirname);
	await writeLogs(context, logCount);
	return new LogDirectorySource(context.dirname, options);
}

async function writeLogs(context, logCount = 2000) {
	await inContext(context, async (logger) => {
		const data = '1234567890'.repeat(50);
		if (context.isStart) {
			logger.STARTING_UP();
			context.isStart = false;
			context.estimatedSize = 9;
		}
		for (let i = 0; i < logCount; ++i) {
			context.log(logger, data);
			if (i % 2 === 0) {
				context.flush(logger);
			}
			if (i % 50 == 0) {
				await new Promise(r => setTimeout(r, 2)); // MASTER_PING
				context.currentTime += 1;
			}
			if (context.estimatedSize > 1024 * 100) {
				context.rotate(logger);
			}
		}
	});
}

async function inContext(context, fn) {
	let filename;
	if (context.filenames.length) {
		filename = context.filenames[context.filenames.length - 1];
	} else {
		filename = path.join(context.dirname, toLogBasename(context.currentTime));
		context.filenames.push(filename);
	}

	const logger = new MasterLogger(filename, { pingDelay: 1, compression: false });
	try {
		await fn(logger);
	} finally {
		logger.close();
	}
}

function createContext(dirname) {
	const now = Date.now();
	return {
		dirname,
		filenames: [],
		startTime: now,
		currentTime: now,
		isStart: true,
		estimatedSize: 0,
		log(logger, data) {
			logger.info(data);
			this.currentTime += 1;
			this.estimatedSize += data.length + 2 + 3 + 9;
		},
		flush(logger) {
			logger.flush();
			this.estimatedSize += 1;
		},
		rotate(logger) {
			const filename = path.join(this.dirname, toLogBasename(this.currentTime++));
			logger.rotate(filename);
			this.filenames.push(filename);
			this.estimatedSize = 10;
		},
	};
}

async function expectToThrow(promise, ...args) {
	try {
		if (typeof promise[Symbol.asyncIterator] === 'function') {
			for await (const _ of promise[Symbol.asyncIterator]()) { /* no-op */ }
		} else {
			await promise;
		}
	} catch (err) {
		expect(() => { throw err; }).to.throw(...args);
		return;
	}
	throw new Error('Expected promise to throw');
}
