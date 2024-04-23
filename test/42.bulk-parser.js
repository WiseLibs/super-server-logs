'use strict';
const fs = require('fs/promises');
const path = require('path');
const { LogReader, BulkParser, LogDirectorySource, MasterLogger, Lifecycle } = require('..');
const { toLogBasename } = require('../src/nodejs/common');
const { compress, escapeBlock, unescapeBlock } = require('../src/shared/common');
const { SEPARATOR, ESCAPE, ESCAPE_CODE_SEPARATOR, ESCAPE_CODE_SLICEMARKER } = require('../src/shared/common');
const EventTypes = require('../src/shared/event-types');

describe('BulkParser', function () {
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

	describe('read()', function () {
		it('supports bulk streams that end in an incomplete block', async function () {
			const reader = new LogReader(await createVfs(context));
			await fs.appendFile(context.filenames.slice(-1)[0], 'foobarbaz!'.repeat(10));
			let count = 0;
			for await (const block of BulkParser.read(reader.bulkRange(0, context.currentTime * 2))) {
				count += [...BulkParser.parse(block)].length;
			}
			expect(count).to.be.above(1999);
		});
	});

	describe('readReversed()', function () {
		it('supports reverse bulk streams that start with an incomplete block', async function () {
			const reader = new LogReader(await createVfs(context));
			await fs.appendFile(context.filenames.slice(-1)[0], 'foobarbaz!'.repeat(10));
			let count = 0;
			for await (const block of BulkParser.readReversed(reader.bulkRangeReversed(0, context.currentTime * 2))) {
				count += [...BulkParser.parse(block)].length;
			}
			expect(count).to.be.above(1999);
		});
	});

	describe('parse()', function () {
		it('returns an iterable iterator', async function () {
			const iterator = BulkParser.parse(new Uint8Array([40, 0, 0, 0, 0, 0, 0, 0, 0]));
			expect(iterator).to.be.an('object');
			expect(iterator.next).to.be.a('function');
			expect(iterator.return).to.be.a('function');
			expect(iterator.throw).to.be.a('function');
			expect(iterator[Symbol.iterator]).to.be.a('function');
			expect(iterator[Symbol.iterator]()).to.equal(iterator);
		});

		it('yields each log entry in the given block', async function () {
			const logs = [...BulkParser.parse(new Uint8Array([
				EventTypes.STARTING_UP, 0, 0, 0, 0, 0, 0, 0, 0,
				EventTypes.STARTING_UP_COMPLETED, 0, 0, 0, 0, 0, 0, 0, 1,
				SEPARATOR,
			]))];
			expect(logs[0].event).to.equal(Lifecycle.STARTING_UP);
			expect(logs[0].nonce).to.equal(0);
			expect(logs[1].event).to.equal(Lifecycle.STARTING_UP_COMPLETED);
			expect(logs[1].nonce).to.equal(1);
		});

		it('supports escaped blocks', async function () {
			const logs = [...BulkParser.parse(new Uint8Array([
				EventTypes.STARTING_UP, 0, 0, 0, 0, 0, 0, 0, 0,
				EventTypes.STARTING_UP_COMPLETED, 0, 0, 0, 0, 0, ESCAPE, ESCAPE_CODE_SEPARATOR, 0, 1,
				SEPARATOR,
			]))];
			expect(logs[0].event).to.equal(Lifecycle.STARTING_UP);
			expect(logs[0].nonce).to.equal(0);
			expect(logs[1].event).to.equal(Lifecycle.STARTING_UP_COMPLETED);
			expect(logs[1].nonce).to.equal(1);
			expect(logs[1].timestamp).to.equal(SEPARATOR);
		});

		it('supports compressed blocks', async function () {
			const block = compress(new Uint8Array([
				EventTypes.STARTING_UP, 0, 0, 0, 0, 0, 0, 0, 0,
				EventTypes.STARTING_UP_COMPLETED, 0, 0, 0, 0, 0, 0, 0, 1,
			]));
			block[0] = block[0] >> 4 | (block[0] & 0xf) << 4;
			const logs = [...BulkParser.parse(Buffer.from([...block, SEPARATOR]))];
			expect(logs[0].event).to.equal(Lifecycle.STARTING_UP);
			expect(logs[0].nonce).to.equal(0);
			expect(logs[1].event).to.equal(Lifecycle.STARTING_UP_COMPLETED);
			expect(logs[1].nonce).to.equal(1);
		});

		it('supports escaped, compressed blocks', async function () {
			let block = compress(new Uint8Array([
				EventTypes.STARTING_UP, 108, 181, 227, 194, 237, 204, 197, 247,
			]));
			block[0] = block[0] >> 4 | (block[0] & 0xf) << 4;
			block = Buffer.from([...escapeBlock(block), SEPARATOR]);
			expect([...block.subarray(0, -1)]).to.not.include(SEPARATOR);
			const unescaped = unescapeBlock(block.subarray(0, -1));
			expect([...unescaped]).to.include(SEPARATOR);
			expect(Boolean(unescaped[0] & 0x80)).to.be.true;
			const logs = [...BulkParser.parse(block)];
			expect(logs[0].event).to.equal(Lifecycle.STARTING_UP);
			expect(logs[0].nonce).to.equal(50679);
			expect(logs[0].timestamp).to.equal(119528466083276);
		});

		it('supports escaped blocks with slice markers', async function () {
			const logs = [...BulkParser.parse(new Uint8Array([
				EventTypes.WORKER_SPAWNED, 0, 0, 0, 0, 0, 0, 0, 0, 1,
				ESCAPE, ESCAPE_CODE_SLICEMARKER,
				EventTypes.STARTING_UP, 0, 0, 0, 0, 0, 0, 0, 0,
				EventTypes.STARTING_UP_COMPLETED, 0, 0, 0, 0, 0, ESCAPE, ESCAPE_CODE_SEPARATOR, 0, 1,
				SEPARATOR,
			]))];
			expect(logs[0].event).to.equal(Lifecycle.STARTING_UP);
			expect(logs[0].nonce).to.equal(0);
			expect(logs[1].event).to.equal(Lifecycle.STARTING_UP_COMPLETED);
			expect(logs[1].nonce).to.equal(1);
			expect(logs[1].timestamp).to.equal(SEPARATOR);
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
