'use strict';
const fs = require('fs');
const { WorkerLogger, RequestLogger, LogEntry, LogType, LogLevel, Lifecycle } = require('..');
const ExceptionUtil = require('../src/shared/exception-util');
const Reader = require('../src/shared/reader');
const Logger = require('../src/nodejs/logger');

describe('WorkerLogger', function () {
	const TIMESTAMP = 1697791340927;
	const originalNow = Date.now;
	let logger;

	before(function () {
		Date.now = () => TIMESTAMP;
	});

	afterEach(function () {
		logger?.close();
	});

	after(function () {
		Date.now = originalNow;
	});

	describe('logging methods', function () {
		specify('WORKER_STARTED() logs and flushes an event', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23 });
			expect(logger.WORKER_STARTED()).to.equal(logger);
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LIFECYCLE,
				workerId: 23,
				event: Lifecycle.WORKER_STARTED,
			});
		});

		specify('WORKER_GOING_ONLINE() logs and flushes an event', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23 });
			expect(logger.WORKER_GOING_ONLINE()).to.equal(logger);
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LIFECYCLE,
				workerId: 23,
				event: Lifecycle.WORKER_GOING_ONLINE,
			});
		});

		specify('WORKER_ONLINE() logs and flushes an event', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23 });
			expect(logger.WORKER_ONLINE()).to.equal(logger);
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LIFECYCLE,
				workerId: 23,
				event: Lifecycle.WORKER_ONLINE,
			});
		});

		specify('WORKER_GOING_OFFLINE() logs and flushes an event', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23 });
			expect(logger.WORKER_GOING_OFFLINE()).to.equal(logger);
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LIFECYCLE,
				workerId: 23,
				event: Lifecycle.WORKER_GOING_OFFLINE,
			});
		});

		specify('WORKER_OFFLINE() logs and flushes an event', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23 });
			expect(logger.WORKER_OFFLINE()).to.equal(logger);
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LIFECYCLE,
				workerId: 23,
				event: Lifecycle.WORKER_OFFLINE,
			});
		});

		specify('WORKER_DONE() logs and flushes an event', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23 });
			expect(logger.WORKER_STARTED()).to.equal(logger);
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LIFECYCLE,
				workerId: 23,
				event: Lifecycle.WORKER_STARTED,
			});
		});

		specify('UNCAUGHT_EXCEPTION() logs an event', async function () {
			this.slow(400);
			const err = Object.assign(new Error('lol'), { foo: 'bar' });
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50, compression: false });
			expect(logger.UNCAUGHT_EXCEPTION(err)).to.equal(logger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.CRITICAL,
				type: LogType.UNCAUGHT_EXCEPTION,
				workerId: 23,
				error: JSON.stringify(ExceptionUtil.encode(err)),
			});
		});

		specify('critical() logs an event', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50 });
			expect(logger.critical({ foo: 'bar' })).to.equal(logger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.CRITICAL,
				type: LogType.LOG,
				workerId: 23,
				requestId: null,
				data: '{"foo":"bar"}',
			});
		});

		specify('error() logs an event', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50 });
			expect(logger.error({ foo: 'bar' })).to.equal(logger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.ERROR,
				type: LogType.LOG,
				workerId: 23,
				requestId: null,
				data: '{"foo":"bar"}',
			});
		});

		specify('warn() logs an event', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50 });
			expect(logger.warn({ foo: 'bar' })).to.equal(logger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.WARN,
				type: LogType.LOG,
				workerId: 23,
				requestId: null,
				data: '{"foo":"bar"}',
			});
		});

		specify('info() logs an event', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50 });
			expect(logger.info({ foo: 'bar' })).to.equal(logger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LOG,
				workerId: 23,
				requestId: null,
				data: '{"foo":"bar"}',
			});
		});

		specify('debug() includes a log within the next UNCAUGHT_EXCEPTION', async function () {
			this.slow(400);
			const err = Object.assign(new Error('lol'), { foo: 'bar' });
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50, compression: false, debugLogLimit: 2 });
			expect(logger.debug({ lol: 'meh' })).to.equal(logger);
			expect(logger.debug({ foo: 'bar' })).to.equal(logger);
			expect(logger.debug({ baz: 'qux' })).to.equal(logger);
			expect(logger.UNCAUGHT_EXCEPTION(err)).to.equal(logger);
			expect(logger.UNCAUGHT_EXCEPTION(err)).to.equal(logger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			const reader = new Reader(fs.readFileSync(util.current()));
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.CRITICAL,
				type: LogType.UNCAUGHT_EXCEPTION,
				workerId: 23,
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
				workerId: 23,
				error: JSON.stringify(ExceptionUtil.encode(err)),
			});
		});
	});

	describe('pings', function () {
		specify('are written periodically', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, pingDelay: 50, compression: false });
			await new Promise(r => setTimeout(r, 130));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			logger.flush();
			const reader = new Reader(fs.readFileSync(util.current()));
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INTERNAL,
				type: LogType.LIFECYCLE,
				workerId: 23,
				event: Lifecycle.WORKER_PING,
			});
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 1,
				level: LogLevel.INTERNAL,
				type: LogType.LIFECYCLE,
				workerId: 23,
				event: Lifecycle.WORKER_PING,
			});
		});

		specify('are not written if other logs are being written', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, pingDelay: 50, compression: false });
			logger.info('hi');
			await new Promise(r => setTimeout(r, 20));
			logger.info('hi');
			await new Promise(r => setTimeout(r, 20));
			logger.info('hi');
			await new Promise(r => setTimeout(r, 20));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			logger.flush();
			const reader = new Reader(fs.readFileSync(util.current()));
			new LogEntry(reader);
			new LogEntry(reader);
			new LogEntry(reader);
			expect(reader.input.subarray(reader.offset + 1)).to.deep.equal(new Uint8Array());
		});

		specify('are written and flushed immediately after rotating to a new file', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23 });
			logger.rotate(util.next());
			const reader = new Reader(fs.readFileSync(util.current()));
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INTERNAL,
				type: LogType.LIFECYCLE,
				workerId: 23,
				event: Lifecycle.WORKER_PING,
			});
		});

		specify('are not written after the logger is closed', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, pingDelay: 50, compression: false });
			logger.close();
			await new Promise(r => setTimeout(r, 130));
			logger.flush();
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
		});
	});

	describe('log()', function () {
		it('always throws', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23 });
			expect(() => logger.log()).to.throw(TypeError, 'Private method');
			expect(() => logger.log({ foo: 'bar' })).to.throw(TypeError, 'Private method');
			expect(() => logger.log(new Uint8Array([10, 20]))).to.throw(TypeError, 'Private method');
		});
	});

	describe('newRequest()', function () {
		it('returns a new RequestLogger', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23 });
			const requestLogge1 = logger.newRequest();
			expect(requestLogge1).to.be.an.instanceof(RequestLogger);
			expect(requestLogge1.closed).to.be.false;
			expect(requestLogge1.requestId).to.be.a('string');
			const requestLogge2 = logger.newRequest();
			expect(requestLogge2).to.be.an.instanceof(RequestLogger);
			expect(requestLogge2.closed).to.be.false;
			expect(requestLogge2.requestId).to.be.a('string');
			expect(requestLogge1).to.not.equal(requestLogge2);
			expect(requestLogge1.requestId).to.not.equal(requestLogge2.requestId);
		});
	});

	describe('constructor', function () {
		it('is a subclass of Logger', async function () {
			expect(WorkerLogger.prototype).to.be.an.instanceof(Logger);
			expect(Object.getPrototypeOf(WorkerLogger)).to.equal(Logger);
		});

		describe('options.pingDelay', function () {
			it('throws if not a positive integer', async function () {
				expect(() => new WorkerLogger(util.next(), { workerId: 23, pingDelay: null })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, pingDelay: '1024' })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, pingDelay: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, pingDelay: BigInt(1024) })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, pingDelay: 1024.5 })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, pingDelay: -1024 })).to.throw(RangeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, pingDelay: -1 })).to.throw(RangeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, pingDelay: 0 })).to.throw(RangeError);
			});

			it('throws if greater than 2147483647', async function () {
				expect(() => new WorkerLogger(util.next(), { workerId: 23, pingDelay: 2147483648 })).to.throw(RangeError);
			});
		});

		describe('options.debugLogLimit', function () {
			it('throws if not a non-negative integer', async function () {
				expect(() => new WorkerLogger(util.next(), { workerId: 23, debugLogLimit: null })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, debugLogLimit: '1024' })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, debugLogLimit: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, debugLogLimit: BigInt(1024) })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, debugLogLimit: 1024.5 })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, debugLogLimit: -1024 })).to.throw(RangeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 23, debugLogLimit: -1 })).to.throw(RangeError);
			});
		});

		describe('options.workerId', function () {
			it('throws if not a positive integer', async function () {
				expect(() => new WorkerLogger(util.next(), { workerId: null })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: '1024' })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: BigInt(1024) })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 1024.5 })).to.throw(TypeError);
				expect(() => new WorkerLogger(util.next(), { workerId: -1024 })).to.throw(RangeError);
				expect(() => new WorkerLogger(util.next(), { workerId: -1 })).to.throw(RangeError);
				expect(() => new WorkerLogger(util.next(), { workerId: 0 })).to.throw(RangeError);
			});
		});
	});

	describe('disabled logging mode (null filename)', function () {
		specify('WORKER_STARTED() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.WORKER_STARTED()).to.equal(logger);
		});

		specify('WORKER_GOING_ONLINE() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.WORKER_GOING_ONLINE()).to.equal(logger);
		});

		specify('WORKER_ONLINE() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.WORKER_ONLINE()).to.equal(logger);
		});

		specify('WORKER_GOING_OFFLINE() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.WORKER_GOING_OFFLINE()).to.equal(logger);
		});

		specify('WORKER_OFFLINE() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.WORKER_OFFLINE()).to.equal(logger);
		});

		specify('WORKER_DONE() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.WORKER_DONE()).to.equal(logger);
		});

		specify('UNCAUGHT_EXCEPTION() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.UNCAUGHT_EXCEPTION(new Error('lol'))).to.equal(logger);
		});

		specify('critical() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.critical({ foo: 'bar' })).to.equal(logger);
		});

		specify('error() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.error({ foo: 'bar' })).to.equal(logger);
		});

		specify('warn() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.warn({ foo: 'bar' })).to.equal(logger);
		});

		specify('info() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.info({ foo: 'bar' })).to.equal(logger);
		});

		specify('debug() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.debug({ foo: 'bar' })).to.equal(logger);
		});

		specify('flush() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			logger.info({ foo: 'bar' });
			logger.info({ baz: 'qux' });
			expect(logger.flush()).to.equal(logger);
			expect(logger.closed).to.be.true;
		});

		specify('rotate() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			logger.info({ foo: 'bar' });
			logger.info({ baz: 'qux' });
			expect(logger.rotate(util.next())).to.equal(logger);
			expect(logger.closed).to.be.true;
			logger.info({ foo: 'bar' });
			logger.info({ baz: 'qux' });
			logger.flush();
			expect(fs.existsSync(util.current())).to.be.false;
		});

		specify('close() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.close()).to.equal(logger);
			expect(logger.closed).to.be.true;
		});

		specify('pings are not written periodically', async function () {
			this.slow(400);
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0, pingDelay: 50 });
			expect(logger.closed).to.be.true;
			await new Promise(r => setTimeout(r, 130));
			logger.flush();
			expect(logger._pingTimer).to.be.null;
		});
	});
});
