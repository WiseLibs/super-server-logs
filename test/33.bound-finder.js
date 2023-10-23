'use strict';
const { Lifecycle: { STARTING_UP, WORKER_SPAWNED, WORKER_EXITED, MASTER_PING } } = require('..');
const BoundFinder = require('../src/shared/bound-finder');

describe('BoundFinder', function () {
	this.slow(500);

	const logs = [];
	const START_TIME = Date.now();
	let TIME_RANGE;

	before(function () {
		let now = START_TIME;
		for (let run = 0; run < 3; ++run) {
			let workerIds = [null, 1, 2, 3, 4];
			logs.push(new FakeLog(now++, null, { event: STARTING_UP }));
			logs.push(new FakeLog(now++, null));
			logs.push(new FakeLog(now++, 1, { event: WORKER_SPAWNED }));
			logs.push(new FakeLog(now++, 1));
			logs.push(new FakeLog(now++, 1));
			logs.push(new FakeLog(now++, null));
			logs.push(new FakeLog(now++, 2, { event: WORKER_SPAWNED }));
			logs.push(new FakeLog(now++, null));
			logs.push(new FakeLog(now++, 3, { event: WORKER_SPAWNED }));
			logs.push(new FakeLog(now++, null));
			logs.push(new FakeLog(now++, 4, { event: WORKER_SPAWNED }));
			logs.push(new FakeLog(now++, null));
			logs.push(new FakeLog(now++, 4));
			logs.push(new FakeLog(now++, 2));
			logs.push(new FakeLog(now++, 3));
			logs.push(new FakeLog(now++, 1));
			logs.push(new FakeLog(now++, null));
			for (let i = 0; i < 5000; ++i) {
				const workerId = workerIds[Math.floor(Math.random() * workerIds.length)];
				logs.push(new FakeLog(now++, workerId));
				now += Math.floor(Math.random() * 2);
				if (i % 100 === 50) {
					const ids = workerIds.filter(x => x !== null);
					logs.push(new FakeLog(now++, null, { event: MASTER_PING, workerIds: ids }));
				}
			}
			logs.push(new FakeLog(now++, 2, { event: WORKER_EXITED }));
			logs.push(new FakeLog(now++, 3));
			logs.push(new FakeLog(now++, 1));
			logs.push(new FakeLog(now++, null));
			logs.push(new FakeLog(now++, 5, { event: WORKER_SPAWNED }));
			workerIds = [null, 1, 3, 4, 5];
			for (let i = 0; i < 5000; ++i) {
				const workerId = workerIds[Math.floor(Math.random() * workerIds.length)];
				logs.push(new FakeLog(now++, workerId));
				now += Math.floor(Math.random() * 2);
				if (i % 100 === 50) {
					const ids = workerIds.filter(x => x !== null);
					logs.push(new FakeLog(now++, null, { event: MASTER_PING, workerIds: ids }));
				}
			}
			logs.push(new FakeLog(now++, 3, { event: WORKER_EXITED }));
			logs.push(new FakeLog(now++, null));
			logs.push(new FakeLog(now++, 4, { event: WORKER_EXITED }));

			// For the "can inherit state" tests, we need to ensure the logs end
			// in a MASTER_PING.
			const ids = workerIds.filter(x => x !== null);
			logs.push(new FakeLog(now++, null, { event: MASTER_PING, workerIds: ids }));
		}
		TIME_RANGE = now - START_TIME;
	});

	describe('finds upper bounds within a series of logs', function () {
		for (const numeratorBegin of [0, 1, 2, 3, 4, 5, 6]) {
			const ratioBegin = numeratorBegin / 6;
			for (const numeratorEnd of [0, 1, 2, 3, 4, 5, 6]) {
				const ratioEnd = numeratorEnd / 6;

				specify(`range: ${numeratorBegin}/6 -> ${numeratorEnd}/6`, function () {
					const timestampBegin = Math.floor(START_TIME + TIME_RANGE * ratioBegin);
					const timestampEnd = Math.floor(START_TIME + TIME_RANGE * ratioEnd);
					const bound = new BoundFinder(timestampEnd);
					let count = 0;
					let index = 0;
					while (index < logs.length - 1 && logs[index].timestamp < timestampBegin) {
						index += 1;
					}
					while (index < logs.length) {
						const log = logs[index++];
						count += 1;
						if (bound.reachedUpperBound(log)) {
							break;
						}
					}
					for (let i = index; i < logs.length; ++i) {
						expect(logs[i].timestamp).to.be.above(timestampEnd);
					}
					const ratioDiff = Math.max(0, ratioEnd - ratioBegin);
					expect(count / logs.length).to.be.within(ratioDiff - 0.05, ratioDiff + 0.05);
				});
			}
		}
	});

	describe('finds lower bounds within a series of logs', function () {
		for (const numeratorBegin of [0, 1, 2, 3, 4, 5, 6]) {
			const ratioBegin = numeratorBegin / 6;
			for (const numeratorEnd of [0, 1, 2, 3, 4, 5, 6]) {
				const ratioEnd = numeratorEnd / 6;

				specify(`range: ${numeratorBegin}/6 -> ${numeratorEnd}/6`, function () {
					const timestampBegin = Math.floor(START_TIME + TIME_RANGE * ratioBegin);
					const timestampEnd = Math.floor(START_TIME + TIME_RANGE * ratioEnd);
					const bound = new BoundFinder(timestampEnd);
					let count = 0;
					let index = logs.length - 1;
					while (index > 0 && logs[index].timestamp > timestampBegin) {
						index -= 1;
					}
					while (index >= 0) {
						const log = logs[index--];
						count += 1;
						if (bound.reachedLowerBound(log)) {
							break;
						}
					}
					for (let i = index; i >= 0; --i) {
						expect(logs[i].timestamp).to.be.below(timestampEnd);
					}
					const ratioDiff = Math.max(0, ratioBegin - ratioEnd);
					expect(count / logs.length).to.be.within(ratioDiff - 0.05, ratioDiff + 0.05);
				});
			}
		}
	});

	describe('can inherit state from a previous instance', function () {
		const filteredLogs = [];
		let FILTERED_TIME_RANGE;

		before(function () {
			let lastPing;
			for (const log of logs) {
				if (log.event === STARTING_UP && filteredLogs.length) {
					break;
				}
				if (log.event === MASTER_PING) {
					lastPing = log;
				} else {
					filteredLogs.push(log);
				}
			}

			// For the "from lower bound to upper bound" test, we need to ensure
			// we need to ensure the last log is a MASTER_PING.
			const lastTime = filteredLogs[filteredLogs.length - 1].timestamp;
			filteredLogs.push(new FakeLog(lastTime + 1, null, { event: MASTER_PING, workerIds: lastPing.workerIds }));
			FILTERED_TIME_RANGE = lastTime - START_TIME + 2;
		});

		specify('from upper bound to lower bound', function () {
			const timestamp = Math.floor(START_TIME + FILTERED_TIME_RANGE / 2);
			const upperBound = new BoundFinder(timestamp);
			let index = 0;
			for (;;) {
				const log = filteredLogs[index];
				if (upperBound.reachedUpperBound(log)) {
					break;
				} else if (index + 1 < filteredLogs.length) {
					index += 1;
				} else {
					break;
				}
			}
			let count = 0;
			const lowerBound = new BoundFinder(timestamp, upperBound.state);
			for (;;) {
				count += 1;
				const log = filteredLogs[index];
				if (lowerBound.reachedLowerBound(log)) {
					break;
				} else if (index - 1 >= 0) {
					index -= 1;
				} else {
					break;
				}
			}
			expect(count).to.be.below(1000);
		});

		specify('from lower bound to upper bound', function () {
			const timestamp = Math.floor(START_TIME + FILTERED_TIME_RANGE / 2);
			const lowerBound = new BoundFinder(timestamp);
			let index = filteredLogs.length - 1;
			for (;;) {
				const log = filteredLogs[index];
				if (lowerBound.reachedLowerBound(log)) {
					break;
				} else if (index - 1 >= 0) {
					index -= 1;
				} else {
					break;
				}
			}
			let count = 0;
			const upperBound = new BoundFinder(timestamp, lowerBound.state);
			for (;;) {
				count += 1;
				const log = filteredLogs[index];
				if (upperBound.reachedUpperBound(log)) {
					break;
				} else if (index + 1 < filteredLogs.length) {
					index += 1;
				} else {
					break;
				}
			}
			expect(count).to.be.below(1000);
		});
	});
});

class FakeLog {
	constructor(timestamp, workerId, properties = {}) {
		this.timestamp = timestamp;
		this.workerId = workerId;
		for (const [key, value] of Object.entries(properties)) {
			Object.defineProperty(this, key, { value, enumerable: true });
		}
	}

	get nonce() { throw new Error('Unexpected property access'); }
	get level() { throw new Error('Unexpected property access'); }
	get type() { throw new Error('Unexpected property access'); }
	get requestId() { throw new Error('Unexpected property access'); }
	get httpVersionMajor() { throw new Error('Unexpected property access'); }
	get httpVersionMinor() { throw new Error('Unexpected property access'); }
	get ipAddress() { throw new Error('Unexpected property access'); }
	get method() { throw new Error('Unexpected property access'); }
	get url() { throw new Error('Unexpected property access'); }
	get data() { throw new Error('Unexpected property access'); }
	get error() { throw new Error('Unexpected property access'); }
	get statusCode() { throw new Error('Unexpected property access'); }
	get exitCode() { throw new Error('Unexpected property access'); }
	get signal() { throw new Error('Unexpected property access'); }
	get workerIds() { throw new Error('Unexpected property access'); }
	get getRequestId() { throw new Error('Unexpected property access'); }
	get getIpAddress() { throw new Error('Unexpected property access'); }
	get getHttpVersion() { throw new Error('Unexpected property access'); }
	get getHttpMethod() { throw new Error('Unexpected property access'); }
	get getError() { throw new Error('Unexpected property access'); }
	get toJSON() { throw new Error('Unexpected property access'); }
}
