'use strict';
const fs = require('fs');
const { MasterLogger, LogEntry, LogType, LogLevel, Lifecycle } = require('..');
const ExceptionUtil = require('../src/shared/exception-util');
const Reader = require('../src/shared/reader');
const Logger = require('../src/nodejs/logger');

describe('MasterLogger', function () {
	const TIMESTAMP = 1697791340927;
	const originalNow = Date.now;

	before(function () {
		Date.now = () => TIMESTAMP;
	});

	afterEach(function () {
		this.logger?.close();
	});

	after(function () {
		Date.now = originalNow;
	});

	describe('logging methods', function () {
		specify('STARTING_UP() logs and flushes an event', async function () {
			this.logger = new MasterLogger(util.next());
			expect(this.logger.STARTING_UP()).to.equal(this.logger);
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LIFECYCLE,
				workerId: null,
				event: Lifecycle.STARTING_UP,
			});
		});

		specify('STARTING_UP_COMPLETED() logs and flushes an event', async function () {
			this.logger = new MasterLogger(util.next());
			expect(this.logger.STARTING_UP_COMPLETED()).to.equal(this.logger);
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LIFECYCLE,
				workerId: null,
				event: Lifecycle.STARTING_UP_COMPLETED,
			});
		});

		specify('SHUTTING_DOWN() logs and flushes an event', async function () {
			this.logger = new MasterLogger(util.next());
			expect(this.logger.SHUTTING_DOWN()).to.equal(this.logger);
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LIFECYCLE,
				workerId: null,
				event: Lifecycle.SHUTTING_DOWN,
			});
		});

		specify('SHUTTING_DOWN_COMPLETED() logs and flushes an event', async function () {
			this.logger = new MasterLogger(util.next());
			expect(this.logger.SHUTTING_DOWN_COMPLETED()).to.equal(this.logger);
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LIFECYCLE,
				workerId: null,
				event: Lifecycle.SHUTTING_DOWN_COMPLETED,
			});
		});

		specify('WORKER_SPAWNED() logs and flushes an event', async function () {
			this.logger = new MasterLogger(util.next());
			expect(this.logger.WORKER_SPAWNED(23)).to.equal(this.logger);
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LIFECYCLE,
				workerId: 23,
				event: Lifecycle.WORKER_SPAWNED,
			});
		});

		specify('WORKER_EXITED() logs and flushes an event', async function () {
			this.logger = new MasterLogger(util.next());
			expect(this.logger.WORKER_EXITED(23, 0, null)).to.equal(this.logger);
			expect(this.logger.WORKER_EXITED(24, 47, 'SIGINT')).to.equal(this.logger);
			const reader = new Reader(fs.readFileSync(util.current()));
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LIFECYCLE,
				workerId: 23,
				event: Lifecycle.WORKER_EXITED,
				exitCode: 0,
				signal: null,
			});
			reader.offset += 1;
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 1,
				level: LogLevel.WARN,
				type: LogType.LIFECYCLE,
				workerId: 24,
				event: Lifecycle.WORKER_EXITED,
				exitCode: 47,
				signal: 'SIGINT',
			});
		});

		specify('UNCAUGHT_EXCEPTION() logs an event', async function () {
			this.slow(400);
			const err = Object.assign(new Error('lol'), { foo: 'bar' });
			this.logger = new MasterLogger(util.next(), { outputDelay: 50, compression: false });
			expect(this.logger.UNCAUGHT_EXCEPTION(err)).to.equal(this.logger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.CRITICAL,
				type: LogType.UNCAUGHT_EXCEPTION,
				workerId: null,
				error: JSON.stringify(ExceptionUtil.encode(err)),
			});
		});

		specify('critical() logs an event', async function () {
			this.slow(400);
			this.logger = new MasterLogger(util.next(), { outputDelay: 50 });
			expect(this.logger.critical({ foo: 'bar' })).to.equal(this.logger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.CRITICAL,
				type: LogType.LOG,
				workerId: null,
				requestId: null,
				data: '{"foo":"bar"}',
			});
		});

		specify('error() logs an event', async function () {
			this.slow(400);
			this.logger = new MasterLogger(util.next(), { outputDelay: 50 });
			expect(this.logger.error({ foo: 'bar' })).to.equal(this.logger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.ERROR,
				type: LogType.LOG,
				workerId: null,
				requestId: null,
				data: '{"foo":"bar"}',
			});
		});

		specify('warn() logs an event', async function () {
			this.slow(400);
			this.logger = new MasterLogger(util.next(), { outputDelay: 50 });
			expect(this.logger.warn({ foo: 'bar' })).to.equal(this.logger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.WARN,
				type: LogType.LOG,
				workerId: null,
				requestId: null,
				data: '{"foo":"bar"}',
			});
		});

		specify('info() logs an event', async function () {
			this.slow(400);
			this.logger = new MasterLogger(util.next(), { outputDelay: 50 });
			expect(this.logger.info({ foo: 'bar' })).to.equal(this.logger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LOG,
				workerId: null,
				requestId: null,
				data: '{"foo":"bar"}',
			});
		});

		specify('debug() includes a log within the next UNCAUGHT_EXCEPTION', async function () {
			this.slow(400);
			const err = Object.assign(new Error('lol'), { foo: 'bar' });
			this.logger = new MasterLogger(util.next(), { outputDelay: 50, compression: false, debugLogLimit: 2 });
			expect(this.logger.debug({ lol: 'meh' })).to.equal(this.logger);
			expect(this.logger.debug({ foo: 'bar' })).to.equal(this.logger);
			expect(this.logger.debug({ baz: 'qux' })).to.equal(this.logger);
			expect(this.logger.UNCAUGHT_EXCEPTION(err)).to.equal(this.logger);
			expect(this.logger.UNCAUGHT_EXCEPTION(err)).to.equal(this.logger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			const reader = new Reader(fs.readFileSync(util.current()));
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.CRITICAL,
				type: LogType.UNCAUGHT_EXCEPTION,
				workerId: null,
				error: JSON.stringify(ExceptionUtil.encode(err, [
					[TIMESTAMP, { foo: 'bar' }],
					[TIMESTAMP, { baz: 'qux' }],
				])),
			});
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 1,
				level: LogLevel.CRITICAL,
				type: LogType.UNCAUGHT_EXCEPTION,
				workerId: null,
				error: JSON.stringify(ExceptionUtil.encode(err)),
			});
		});
	});

	describe('pings', function () {
		specify('are written periodically', async function () {
			this.slow(400);
			this.logger = new MasterLogger(util.next(), { pingDelay: 50, compression: false });
			await new Promise(r => setTimeout(r, 130));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			this.logger.flush();
			const reader = new Reader(fs.readFileSync(util.current()));
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INTERNAL,
				type: LogType.LIFECYCLE,
				workerId: null,
				event: Lifecycle.MASTER_PING,
				workerIds: [],
			});
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 1,
				level: LogLevel.INTERNAL,
				type: LogType.LIFECYCLE,
				workerId: null,
				event: Lifecycle.MASTER_PING,
				workerIds: [],
			});
		});

		specify('are written periodically even if other logs are written', async function () {
			this.slow(400);
			this.logger = new MasterLogger(util.next(), { pingDelay: 50, compression: false });
			this.logger.info('hi');
			await new Promise(r => setTimeout(r, 20));
			this.logger.info('hi');
			await new Promise(r => setTimeout(r, 20));
			this.logger.info('hi');
			await new Promise(r => setTimeout(r, 20));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			this.logger.flush();
			const reader = new Reader(fs.readFileSync(util.current()));
			new LogEntry(reader);
			new LogEntry(reader);
			new LogEntry(reader);
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 3,
				level: LogLevel.INTERNAL,
				type: LogType.LIFECYCLE,
				workerId: null,
				event: Lifecycle.MASTER_PING,
				workerIds: [],
			});
		});

		specify('are written and flushed immediately after rotating to a new file', async function () {
			this.logger = new MasterLogger(util.next());
			this.logger.rotate(util.next());
			const reader = new Reader(fs.readFileSync(util.current()));
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INTERNAL,
				type: LogType.LIFECYCLE,
				workerId: null,
				event: Lifecycle.MASTER_PING,
				workerIds: [],
			});
		});

		specify('contain a list of the workerIds that currently exist', async function () {
			this.slow(400);
			this.logger = new MasterLogger(util.next(), { pingDelay: 50 });
			this.logger.WORKER_SPAWNED(23);
			this.logger.WORKER_SPAWNED(95);
			this.logger.WORKER_SPAWNED(400);
			this.logger.WORKER_EXITED(95, 0);
			await new Promise(r => setTimeout(r, 60));
			this.logger.flush();
			let reader = new Reader(fs.readFileSync(util.current()));
			new LogEntry(reader); reader.offset += 1;
			new LogEntry(reader); reader.offset += 1;
			new LogEntry(reader); reader.offset += 1;
			new LogEntry(reader); reader.offset += 1;
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 4,
				level: LogLevel.INTERNAL,
				type: LogType.LIFECYCLE,
				workerId: null,
				event: Lifecycle.MASTER_PING,
				workerIds: [23, 400],
			});
			const offset = reader.offset + 1;
			this.logger.STARTING_UP();
			await new Promise(r => setTimeout(r, 60));
			this.logger.flush();
			reader = new Reader(fs.readFileSync(util.current()));
			reader.offset = offset;
			new LogEntry(reader); reader.offset += 1;
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 6,
				level: LogLevel.INTERNAL,
				type: LogType.LIFECYCLE,
				workerId: null,
				event: Lifecycle.MASTER_PING,
				workerIds: [],
			});
		});

		specify('are not written after the logger is closed', async function () {
			this.slow(400);
			this.logger = new MasterLogger(util.next(), { pingDelay: 50, compression: false });
			this.logger.close();
			await new Promise(r => setTimeout(r, 130));
			this.logger.flush();
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
		});
	});

	describe('log()', function () {
		it('always throws', async function () {
			this.logger = new MasterLogger(util.next());
			expect(() => this.logger.log()).to.throw(TypeError, 'Private method');
			expect(() => this.logger.log({ foo: 'bar' })).to.throw(TypeError, 'Private method');
			expect(() => this.logger.log(new Uint8Array([10, 20]))).to.throw(TypeError, 'Private method');
		});
	});

	describe('constructor', function () {
		it('is a subclass of Logger', async function () {
			expect(MasterLogger.prototype).to.be.an.instanceof(Logger);
			expect(Object.getPrototypeOf(MasterLogger)).to.equal(Logger);
		});

		describe('options.pingDelay', function () {
			it('throws if not a positive integer', async function () {
				expect(() => new MasterLogger(util.next(), { pingDelay: null })).to.throw(TypeError);
				expect(() => new MasterLogger(util.next(), { pingDelay: '1024' })).to.throw(TypeError);
				expect(() => new MasterLogger(util.next(), { pingDelay: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new MasterLogger(util.next(), { pingDelay: BigInt(1024) })).to.throw(TypeError);
				expect(() => new MasterLogger(util.next(), { pingDelay: 1024.5 })).to.throw(TypeError);
				expect(() => new MasterLogger(util.next(), { pingDelay: -1024 })).to.throw(RangeError);
				expect(() => new MasterLogger(util.next(), { pingDelay: -1 })).to.throw(RangeError);
				expect(() => new MasterLogger(util.next(), { pingDelay: 0 })).to.throw(RangeError);
			});

			it('throws if greater than 2147483647', async function () {
				expect(() => new MasterLogger(util.next(), { pingDelay: 2147483648 })).to.throw(RangeError);
			});
		});

		describe('options.debugLogLimit', function () {
			it('throws if not a non-negative integer', async function () {
				expect(() => new MasterLogger(util.next(), { debugLogLimit: null })).to.throw(TypeError);
				expect(() => new MasterLogger(util.next(), { debugLogLimit: '1024' })).to.throw(TypeError);
				expect(() => new MasterLogger(util.next(), { debugLogLimit: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new MasterLogger(util.next(), { debugLogLimit: BigInt(1024) })).to.throw(TypeError);
				expect(() => new MasterLogger(util.next(), { debugLogLimit: 1024.5 })).to.throw(TypeError);
				expect(() => new MasterLogger(util.next(), { debugLogLimit: -1024 })).to.throw(RangeError);
				expect(() => new MasterLogger(util.next(), { debugLogLimit: -1 })).to.throw(RangeError);
			});
		});
	});

	describe('disabled logging mode (null filename)', function () {
		specify('STARTING_UP() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.STARTING_UP()).to.equal(this.logger);
		});

		specify('STARTING_UP_COMPLETED() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.STARTING_UP_COMPLETED()).to.equal(this.logger);
		});

		specify('SHUTTING_DOWN() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.SHUTTING_DOWN()).to.equal(this.logger);
		});

		specify('SHUTTING_DOWN_COMPLETED() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.SHUTTING_DOWN_COMPLETED()).to.equal(this.logger);
		});

		specify('WORKER_SPAWNED() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.WORKER_SPAWNED(23)).to.equal(this.logger);
		});

		specify('WORKER_EXITED() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.WORKER_EXITED(23, 0)).to.equal(this.logger);
		});

		specify('UNCAUGHT_EXCEPTION() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.UNCAUGHT_EXCEPTION(new Error('lol'))).to.equal(this.logger);
		});

		specify('critical() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.critical({ foo: 'bar' })).to.equal(this.logger);
		});

		specify('error() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.error({ foo: 'bar' })).to.equal(this.logger);
		});

		specify('warn() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.warn({ foo: 'bar' })).to.equal(this.logger);
		});

		specify('info() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.info({ foo: 'bar' })).to.equal(this.logger);
		});

		specify('debug() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.debug({ foo: 'bar' })).to.equal(this.logger);
		});

		specify('flush() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			this.logger.info({ foo: 'bar' });
			this.logger.info({ baz: 'qux' });
			expect(this.logger.flush()).to.equal(this.logger);
			expect(this.logger.closed).to.be.true;
		});

		specify('rotate() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			this.logger.info({ foo: 'bar' });
			this.logger.info({ baz: 'qux' });
			expect(this.logger.rotate(util.next())).to.equal(this.logger);
			expect(this.logger.closed).to.be.true;
			this.logger.info({ foo: 'bar' });
			this.logger.info({ baz: 'qux' });
			this.logger.flush();
			expect(fs.existsSync(util.current())).to.be.false;
		});

		specify('close() is a no-op', async function () {
			this.logger = new MasterLogger(null, { outputDelay: 0 });
			expect(this.logger.closed).to.be.true;
			expect(this.logger.close()).to.equal(this.logger);
			expect(this.logger.closed).to.be.true;
		});

		specify('pings are not written periodically', async function () {
			this.slow(400);
			this.logger = new MasterLogger(null, { outputDelay: 0, pingDelay: 50 });
			expect(this.logger.closed).to.be.true;
			await new Promise(r => setTimeout(r, 130));
			this.logger.flush();
			expect(this.logger._pingTimer).to.be.null;
		});
	});
});
