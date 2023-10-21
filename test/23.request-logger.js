'use strict';
const fs = require('fs');
const { parse: uuidParse } = require('uuid');
const { WorkerLogger, RequestLogger, LogEntry, LogType, LogLevel, Lifecycle, HttpMethod } = require('..');
const ExceptionUtil = require('../src/shared/exception-util');
const BufferUtil = require('../src/shared/buffer-util');
const Reader = require('../src/shared/reader');

describe('RequestLogger', function () {
	const REQUEST_ID = BufferUtil.from([96, 126, 246, 204, 224, 89, 77, 211, 153, 90, 251, 75, 157, 177, 39, 59]);
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
		specify('REQUEST() logs an event', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50, compression: false });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.REQUEST({
				socket: { remoteAddress: '123.45.67.89' },
				httpVersionMajor: 2,
				httpVersionMinor: 1,
				url: '/some/cool/path',
				method: 'GET',
			})).to.equal(requestLogger);
			expect(requestLogger.REQUEST({
				socket: { remoteAddress: '1234:5678:90::abcd:ef' },
				httpVersionMajor: 1,
				httpVersionMinor: 0,
				url: '/some/other/cool/path?with=query',
				method: 'WEIRD_METHOD',
			})).to.equal(requestLogger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			const reader = new Reader(fs.readFileSync(util.current()));
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.REQUEST,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				httpVersionMajor: 2,
				httpVersionMinor: 1,
				ipAddress: 123 * 0x1000000 | 45 << 16 | 67 << 8 | 89,
				method: HttpMethod.GET,
				url: '/some/cool/path',
			});
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 1,
				level: LogLevel.INFO,
				type: LogType.REQUEST,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				httpVersionMajor: 1,
				httpVersionMinor: 0,
				ipAddress: BufferUtil.from([0x12, 0x34, 0x56, 0x78, 0, 0x90, 0, 0, 0, 0, 0, 0, 0xab, 0xcd, 0, 0xef]),
				method: 'WEIRD_METHOD',
				url: '/some/other/cool/path?with=query',
			});
		});

		specify('REQUEST_META() logs an event', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50, compression: false });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.REQUEST_META({ foo: 'bar' })).to.equal(requestLogger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.REQUEST_META,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				data: '{"foo":"bar"}',
			});
		});

		specify('RESPONSE() logs an event', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50, compression: false });
			const requestLogger = logger.newRequest();
			const err = new Error('lol');
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.RESPONSE(200)).to.equal(requestLogger);
			expect(requestLogger.RESPONSE(400, err)).to.equal(requestLogger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			const reader = new Reader(fs.readFileSync(util.current()));
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.RESPONSE,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				error: null,
				statusCode: 200,
			});
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 1,
				level: LogLevel.ERROR,
				type: LogType.RESPONSE,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				error: JSON.stringify(ExceptionUtil.encode(err)),
				statusCode: 400,
			});
		});

		specify('RESPONSE_FINISHED() logs an event', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50, compression: false });
			const requestLogger = logger.newRequest();
			const err = new Error('lol');
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.RESPONSE_FINISHED()).to.equal(requestLogger);
			expect(requestLogger.RESPONSE_FINISHED(err)).to.equal(requestLogger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			const reader = new Reader(fs.readFileSync(util.current()));
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.RESPONSE_FINISHED,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				error: null,
			});
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 1,
				level: LogLevel.ERROR,
				type: LogType.RESPONSE_FINISHED,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				error: JSON.stringify(ExceptionUtil.encode(err)),
			});
		});

		specify('critical() logs an event', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50, compression: false });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.critical({ foo: 'bar' })).to.equal(requestLogger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.CRITICAL,
				type: LogType.LOG,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				data: '{"foo":"bar"}',
			});
		});

		specify('error() logs an event', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50, compression: false });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.error({ foo: 'bar' })).to.equal(requestLogger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.ERROR,
				type: LogType.LOG,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				data: '{"foo":"bar"}',
			});
		});

		specify('warn() logs an event', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50, compression: false });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.warn({ foo: 'bar' })).to.equal(requestLogger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.WARN,
				type: LogType.LOG,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				data: '{"foo":"bar"}',
			});
		});

		specify('info() logs an event', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50, compression: false });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.info({ foo: 'bar' })).to.equal(requestLogger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.LOG,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				data: '{"foo":"bar"}',
			});
		});

		specify('debug() includes a log within the next errored RESPONSE[_FINISHED]', async function () {
			this.slow(400);
			const err = Object.assign(new Error('lol'), { foo: 'bar' });
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 50, compression: false, debugLogLimit: 2 });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.debug({ lol: 'meh' })).to.equal(requestLogger);
			expect(requestLogger.debug({ foo: 'bar' })).to.equal(requestLogger);
			expect(requestLogger.debug({ baz: 'qux' })).to.equal(requestLogger);
			expect(requestLogger.RESPONSE(500)).to.equal(requestLogger);
			expect(requestLogger.RESPONSE(500, err)).to.equal(requestLogger);
			expect(requestLogger.debug({ foo: 'bar' })).to.equal(requestLogger);
			expect(requestLogger.RESPONSE_FINISHED(err)).to.equal(requestLogger);
			expect(requestLogger.RESPONSE_FINISHED(err)).to.equal(requestLogger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			const reader = new Reader(fs.readFileSync(util.current()));
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.RESPONSE,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				error: null,
				statusCode: 500,
			});
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 1,
				level: LogLevel.ERROR,
				type: LogType.RESPONSE,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				error: JSON.stringify(ExceptionUtil.encode(err, [
					[TIMESTAMP, { lol: 'meh' }],
					[TIMESTAMP, { foo: 'bar' }],
					[TIMESTAMP, { baz: 'qux' }],
				])),
				statusCode: 500,
			});
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 2,
				level: LogLevel.ERROR,
				type: LogType.RESPONSE_FINISHED,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				error: JSON.stringify(ExceptionUtil.encode(err, [
					[TIMESTAMP, { foo: 'bar' }],
				])),
			});
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 3,
				level: LogLevel.ERROR,
				type: LogType.RESPONSE_FINISHED,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				error: JSON.stringify(ExceptionUtil.encode(err)),
			});
		});
	});

	describe('non-existent methods', function () {
		specify('log()', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 0 });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(() => requestLogger.log()).to.throw(TypeError, /\bnot a function\b/);
			expect(() => requestLogger.log({ foo: 'bar' })).to.throw(TypeError, /\bnot a function\b/);
			expect(() => requestLogger.log(new Uint8Array([10, 20]))).to.throw(TypeError, /\bnot a function\b/);
		});

		specify('flush()', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 0 });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(() => requestLogger.flush()).to.throw(TypeError, /\bnot a function\b/);
		});

		specify('rotate()', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 0 });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(() => requestLogger.rotate()).to.throw(TypeError, /\bnot a function\b/);
			expect(() => requestLogger.rotate(util.next())).to.throw(TypeError, /\bnot a function\b/);
		});

		specify('close()', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23, outputDelay: 0 });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(() => requestLogger.close()).to.throw(TypeError, /\bnot a function\b/);
		});
	});

	describe('pings', function () {
		specify('are not written if other logs are being written', async function () {
			this.slow(400);
			logger = new WorkerLogger(util.next(), { workerId: 23, pingDelay: 50, compression: false });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			requestLogger.info('hi');
			await new Promise(r => setTimeout(r, 20));
			requestLogger.info('hi');
			await new Promise(r => setTimeout(r, 20));
			requestLogger.info('hi');
			await new Promise(r => setTimeout(r, 20));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			logger.flush();
			const reader = new Reader(fs.readFileSync(util.current()));
			new LogEntry(reader);
			new LogEntry(reader);
			new LogEntry(reader);
			expect(reader.input.subarray(reader.offset + 1)).to.deep.equal(new Uint8Array());
		});
	});

	describe('state', function () {
		specify('is flushed when the WorkerLogger is flushed', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23, compression: false });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.REQUEST_META({ foo: 'bar' })).to.equal(requestLogger);
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			logger.flush();
			expect(new LogEntry(new Reader(fs.readFileSync(util.current())))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.REQUEST_META,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				data: '{"foo":"bar"}',
			});
		});

		specify('is rotated when the WorkerLogger is rotated', async function () {
			const filename = util.next();
			logger = new WorkerLogger(filename, { workerId: 23, compression: false });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.REQUEST_META({ foo: 'bar' })).to.equal(requestLogger);
			logger.rotate(util.next());
			expect(requestLogger.REQUEST_META({ baz: 'qux' })).to.equal(requestLogger);
			logger.flush();
			expect(new LogEntry(new Reader(fs.readFileSync(filename)))).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 0,
				level: LogLevel.INFO,
				type: LogType.REQUEST_META,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				data: '{"foo":"bar"}',
			});
			const reader = new Reader(fs.readFileSync(util.current()));
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 1,
				level: LogLevel.INTERNAL,
				type: LogType.LIFECYCLE,
				workerId: 23,
				event: Lifecycle.WORKER_PING,
			});
			reader.offset += 1;
			expect(new LogEntry(reader)).to.deep.equal({
				timestamp: TIMESTAMP,
				nonce: 2,
				level: LogLevel.INFO,
				type: LogType.REQUEST_META,
				workerId: 23,
				requestId: BufferUtil.normalize(uuidParse(requestLogger.requestId)),
				data: '{"baz":"qux"}',
			});
		});

		specify('is closed when the WorkerLogger is closed', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23 });
			const requestLogger1 = logger.newRequest();
			const requestLogger2 = logger.newRequest();
			expect(logger.closed).to.be.false;
			expect(requestLogger1.closed).to.be.false;
			expect(requestLogger2.closed).to.be.false;
			logger.close();
			expect(logger.closed).to.be.true;
			expect(requestLogger1.closed).to.be.true;
			expect(requestLogger2.closed).to.be.true;
		});

		specify('exposes a requestId UUIDv4 string', async function () {
			logger = new WorkerLogger(util.next(), { workerId: 23 });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.requestId).to.be.a('string');
			expect(requestLogger.requestId).to.equal('607ef6cc-e059-4dd3-995a-fb4b9db1273b');
		});
	});

	describe('disabled logging mode (null filename)', function () {
		specify('REQUEST() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			const requestLogger = logger.newRequest();
			expect(requestLogger.REQUEST({
				socket: { remoteAddress: '123.45.67.89' },
				httpVersionMajor: 2,
				httpVersionMinor: 1,
				url: '/some/cool/path',
				method: 'GET',
			})).to.equal(requestLogger);
		});

		specify('REQUEST_META() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			const requestLogger = logger.newRequest();
			expect(requestLogger.REQUEST_META({ foo: 'bar' })).to.equal(requestLogger);
		});

		specify('RESPONSE() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			const requestLogger = logger.newRequest();
			expect(requestLogger.RESPONSE(200)).to.equal(requestLogger);
			expect(requestLogger.RESPONSE(500, new Error('lol'))).to.equal(requestLogger);
		});

		specify('RESPONSE_FINISHED() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			const requestLogger = logger.newRequest();
			expect(requestLogger.RESPONSE_FINISHED()).to.equal(requestLogger);
			expect(requestLogger.RESPONSE_FINISHED(new Error('lol'))).to.equal(requestLogger);
		});

		specify('critical() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			const requestLogger = logger.newRequest();
			expect(requestLogger.critical({ foo: 'bar' })).to.equal(requestLogger);
		});

		specify('error() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			const requestLogger = logger.newRequest();
			expect(requestLogger.error({ foo: 'bar' })).to.equal(requestLogger);
		});

		specify('warn() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			const requestLogger = logger.newRequest();
			expect(requestLogger.warn({ foo: 'bar' })).to.equal(requestLogger);
		});

		specify('info() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			const requestLogger = logger.newRequest();
			expect(requestLogger.info({ foo: 'bar' })).to.equal(requestLogger);
		});

		specify('debug() is a no-op', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			expect(logger.closed).to.be.true;
			const requestLogger = logger.newRequest();
			expect(requestLogger.debug({ foo: 'bar' })).to.equal(requestLogger);
		});

		specify('requestId is still available', async function () {
			logger = new WorkerLogger(null, { workerId: 23, outputDelay: 0 });
			const requestLogger = logger.newRequest();
			requestLogger._requestIdBuffer = REQUEST_ID;
			expect(requestLogger.requestId).to.be.a('string');
			expect(requestLogger.requestId).to.equal('607ef6cc-e059-4dd3-995a-fb4b9db1273b');
		});
	});
});
