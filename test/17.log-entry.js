'use strict';
const { LogEntry, LogType, LogLevel, Lifecycle, HttpMethod } = require('..');
const ExceptionUtil = require('../src/shared/exception-util');

describe('LogEntry', function () {
	describe('getRequestId()', function () {
		it('returns a string UUIDv4 if this.requestId is present', function () {
			const log = Object.create(LogEntry.prototype);
			log.requestId = new Uint8Array([96, 126, 246, 204, 224, 89, 77, 211, 153, 90, 251, 75, 157, 177, 39, 59]);
			expect(log.getRequestId()).to.equal('607ef6cc-e059-4dd3-995a-fb4b9db1273b');
		});

		it('returns null if this.requestId is null', function () {
			const log = Object.create(LogEntry.prototype);
			log.requestId = null;
			expect(log.getRequestId()).to.be.null;
		});

		it('returns undefined if this.requestId is undefined', function () {
			const log = Object.create(LogEntry.prototype);
			expect(log.getRequestId()).to.be.undefined;
			log.requestId = undefined;
			expect(log.getRequestId()).to.be.undefined;
		});
	});

	describe('getIpAddress()', function () {
		it('returns a string IPv4 address if this.ipAddress is an integer', function () {
			const log = Object.create(LogEntry.prototype);
			log.type = LogType.REQUEST;
			log.ipAddress = 0x12345678;
			expect(log.getIpAddress()).to.equal('18.52.86.120');
		});

		it('returns a string IPv6 address if this.ipAddress is a Uint8Array', function () {
			const log = Object.create(LogEntry.prototype);
			log.type = LogType.REQUEST;
			log.ipAddress = new Uint8Array([10, 20, 30, 40, 50, 0, 0, 0, 0, 0, 0, 120, 130, 140, 150, 160]);
			expect(log.getIpAddress()).to.equal('a14:1e28:3200::78:828c:96a0');
		});

		it('throws if this.ipAddress is an integer but not 32-bit unsigned', function () {
			const log = Object.create(LogEntry.prototype);
			log.type = LogType.REQUEST;
			log.ipAddress = -1;
			expect(() => log.getIpAddress()).to.throw(TypeError);
			log.ipAddress = 0xffffffff + 1;
			expect(() => log.getIpAddress()).to.throw(TypeError);
		});

		it('throws if this.ipAddress is a Uint8Array but not 16 bytes', function () {
			const log = Object.create(LogEntry.prototype);
			log.type = LogType.REQUEST;
			log.ipAddress = new Uint8Array();
			expect(() => log.getIpAddress()).to.throw(TypeError);
			log.ipAddress = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
			expect(() => log.getIpAddress()).to.throw(TypeError);
			log.ipAddress = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
			expect(() => log.getIpAddress()).to.throw(TypeError);
		});

		it('throws if this.ipAddress is not an integer or Uint8Array', function () {
			const log = Object.create(LogEntry.prototype);
			log.type = LogType.REQUEST;
			expect(() => log.getIpAddress()).to.throw(TypeError);
			log.ipAddress = '123';
			expect(() => log.getIpAddress()).to.throw(TypeError);
			log.ipAddress = 123.01;
			expect(() => log.getIpAddress()).to.throw(TypeError);
			log.ipAddress = new Uint16Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16]);
			expect(() => log.getIpAddress()).to.throw(TypeError);
			log.ipAddress = new Uint16Array([1, 2, 3, 4, 5, 6, 7, 8]);
			expect(() => log.getIpAddress()).to.throw(TypeError);
			log.ipAddress = null;
			expect(() => log.getIpAddress()).to.throw(TypeError);
			log.ipAddress = undefined;
			expect(() => log.getIpAddress()).to.throw(TypeError);
		});

		it('returns undefined if this.type is not LogType.REQUEST', function () {
			const log = Object.create(LogEntry.prototype);
			log.type = LogType.REQUEST_META;
			log.ipAddress = 0x12345678;
			expect(log.getIpAddress()).to.be.undefined;
			log.ipAddress = new Uint8Array([10, 20, 30, 40, 50, 0, 0, 0, 0, 0, 0, 120, 130, 140, 150, 160]);
			expect(log.getIpAddress()).to.be.undefined;
		});
	});

	describe('getHttpVersion()', function () {
		it('returns a string HTTP version', function () {
			const log = Object.create(LogEntry.prototype);
			log.type = LogType.REQUEST;
			log.httpVersionMajor = 2;
			log.httpVersionMinor = 1;
			expect(log.getHttpVersion()).to.equal('2.1');
		});

		it('returns undefined if this.type is not LogType.REQUEST', function () {
			const log = Object.create(LogEntry.prototype);
			log.type = LogType.REQUEST_META;
			log.httpVersionMajor = 2;
			log.httpVersionMinor = 1;
			expect(log.getHttpVersion()).to.be.undefined;
		});
	});

	describe('getHttpMethod()', function () {
		it('returns a string HTTP method if this.method is an enum value', function () {
			const log = Object.create(LogEntry.prototype);
			log.type = LogType.REQUEST;
			log.method = HttpMethod.GET;
			expect(log.getHttpMethod()).to.equal('GET');
			log.method = HttpMethod.OPTIONS;
			expect(log.getHttpMethod()).to.equal('OPTIONS');
		});

		it('returns a string HTTP method if this.method is a string', function () {
			const log = Object.create(LogEntry.prototype);
			log.type = LogType.REQUEST;
			log.method = 'FOO';
			expect(log.getHttpMethod()).to.equal('FOO');
		});

		it('returns undefined if this.type is not LogType.REQUEST', function () {
			const log = Object.create(LogEntry.prototype);
			log.type = LogType.REQUEST_META;
			log.method = HttpMethod.GET;
			expect(log.getHttpMethod()).to.be.undefined;
			log.method = 'FOO';
			expect(log.getHttpMethod()).to.be.undefined;
		});
	});

	describe('getError()', function () {
		it('returns an object of error information if this.error is present', function () {
			const log = Object.create(LogEntry.prototype);
			let err = Object.assign(new RangeError('This is some error'), { foo: 123 });
			let encodedErr = ExceptionUtil.encode(err, [[123, { bar: 456 }]]);
			log.error = JSON.stringify(encodedErr);
			expect(log.getError()).to.deep.equal({
				stack: err.stack,
				properties: { foo: 123 },
				debug: [{ timestamp: 123, data: { bar: 456 } }],
			});

			err = { foo: 'bar' };
			encodedErr = ExceptionUtil.encode(err, null);
			log.error = JSON.stringify(encodedErr);
			expect(log.getError()).to.deep.equal({
				value: '[object Object]',
				properties: { foo: 'bar' },
				debug: [],
			});
		});

		it('returns null if this.error is null', function () {
			const log = Object.create(LogEntry.prototype);
			log.error = null;
			expect(log.getError()).to.be.null;
		});

		it('returns undefined if this.error is undefined', function () {
			const log = Object.create(LogEntry.prototype);
			log.error = undefined;
			expect(log.getError()).to.be.undefined;
		});
	});

	describe('toJSON()', function () {
		it('returns a JSON-compatible object of the REQUEST-type log', function () {
			const log = Object.assign(Object.create(LogEntry.prototype), {
				timestamp: 1697616816963,
				nonce: 1234,
				level: LogLevel.INFO,
				type: LogType.REQUEST,
				workerId: 8,
				requestId: new Uint8Array([96, 126, 246, 204, 224, 89, 77, 211, 153, 90, 251, 75, 157, 177, 39, 59]),
				httpVersionMajor: 1,
				httpVersionMinor: 0,
				ipAddress: new Uint8Array([10, 20, 30, 40, 50, 0, 0, 0, 0, 0, 0, 120, 130, 140, 150, 160]),
				method: HttpMethod.POST,
				url: '/some-cool-url?with=some&cool=data',
			});
			expect(log.toJSON()).to.deep.equal({
				timestamp: 1697616816963,
				nonce: 1234,
				level: 'INFO',
				type: 'REQUEST',
				workerId: 8,
				requestId: '607ef6cc-e059-4dd3-995a-fb4b9db1273b',
				ipAddress: 'a14:1e28:3200::78:828c:96a0',
				httpVersion: '1.0',
				url: '/some-cool-url?with=some&cool=data',
				method: 'POST',
			});
		});

		it('returns a JSON-compatible object of the REQUEST_META-type log', function () {
			const log = Object.assign(Object.create(LogEntry.prototype), {
				timestamp: 1697616816963,
				nonce: 1234,
				level: LogLevel.INFO,
				type: LogType.REQUEST_META,
				workerId: 8,
				requestId: new Uint8Array([96, 126, 246, 204, 224, 89, 77, 211, 153, 90, 251, 75, 157, 177, 39, 59]),
				data: '{"foo":"bar"}',
			});
			expect(log.toJSON()).to.deep.equal({
				timestamp: 1697616816963,
				nonce: 1234,
				level: 'INFO',
				type: 'REQUEST_META',
				workerId: 8,
				requestId: '607ef6cc-e059-4dd3-995a-fb4b9db1273b',
				data: { foo: 'bar' },
			});
		});

		it('returns a JSON-compatible object of the RESPONSE-type log', function () {
			const log = Object.assign(Object.create(LogEntry.prototype), {
				timestamp: 1697616816963,
				nonce: 1234,
				level: LogLevel.ERROR,
				type: LogType.RESPONSE,
				workerId: 8,
				requestId: new Uint8Array([96, 126, 246, 204, 224, 89, 77, 211, 153, 90, 251, 75, 157, 177, 39, 59]),
				error: JSON.stringify(ExceptionUtil.encode('this is an error message')),
				statusCode: 500,
			});
			expect(log.toJSON()).to.deep.equal({
				timestamp: 1697616816963,
				nonce: 1234,
				level: 'ERROR',
				type: 'RESPONSE',
				workerId: 8,
				requestId: '607ef6cc-e059-4dd3-995a-fb4b9db1273b',
				error: { value: 'this is an error message', properties: {}, debug: [] },
				statusCode: 500,
			});
		});

		it('returns a JSON-compatible object of the RESPONSE_FINISHED-type log', function () {
			const log = Object.assign(Object.create(LogEntry.prototype), {
				timestamp: 1697616816963,
				nonce: 1234,
				level: LogLevel.INFO,
				type: LogType.RESPONSE_FINISHED,
				workerId: 8,
				requestId: new Uint8Array([96, 126, 246, 204, 224, 89, 77, 211, 153, 90, 251, 75, 157, 177, 39, 59]),
				error: null,
			});
			expect(log.toJSON()).to.deep.equal({
				timestamp: 1697616816963,
				nonce: 1234,
				level: 'INFO',
				type: 'RESPONSE_FINISHED',
				workerId: 8,
				requestId: '607ef6cc-e059-4dd3-995a-fb4b9db1273b',
				error: null,
			});
		});

		it('returns a JSON-compatible object of the LOG-type log', function () {
			const log = Object.assign(Object.create(LogEntry.prototype), {
				timestamp: 1697616816963,
				nonce: 1234,
				level: LogLevel.WARN,
				type: LogType.LOG,
				workerId: 8,
				requestId: new Uint8Array([96, 126, 246, 204, 224, 89, 77, 211, 153, 90, 251, 75, 157, 177, 39, 59]),
				data: '{"foo":"bar"}',
			});
			expect(log.toJSON()).to.deep.equal({
				timestamp: 1697616816963,
				nonce: 1234,
				level: 'WARN',
				type: 'LOG',
				workerId: 8,
				requestId: '607ef6cc-e059-4dd3-995a-fb4b9db1273b',
				data: { foo: 'bar' },
			});
		});

		it('returns a JSON-compatible object of the LIFECYCLE-type log', function () {
			let log = Object.assign(Object.create(LogEntry.prototype), {
				timestamp: 1697616816963,
				nonce: 1234,
				level: LogLevel.WARN,
				type: LogType.LIFECYCLE,
				workerId: 8,
				event: Lifecycle.WORKER_EXITED,
				exitCode: 130,
				signal: 'SIGINT',
			});
			expect(log.toJSON()).to.deep.equal({
				timestamp: 1697616816963,
				nonce: 1234,
				level: 'WARN',
				type: 'LIFECYCLE',
				workerId: 8,
				event: 'WORKER_EXITED',
				exitCode: 130,
				signal: 'SIGINT',
			});

			log = Object.assign(Object.create(LogEntry.prototype), {
				timestamp: 1697616816963,
				nonce: 1234,
				level: LogLevel.INTERNAL,
				type: LogType.LIFECYCLE,
				workerId: null,
				event: Lifecycle.MASTER_PING,
			});
			expect(log.toJSON()).to.deep.equal({
				timestamp: 1697616816963,
				nonce: 1234,
				level: 'INTERNAL',
				type: 'LIFECYCLE',
				workerId: null,
				event: 'MASTER_PING',
			});
		});

		it('returns a JSON-compatible object of the UNCAUGHT_EXCEPTION-type log', function () {
			const log = Object.assign(Object.create(LogEntry.prototype), {
				timestamp: 1697616816963,
				nonce: 1234,
				level: LogLevel.CRITICAL,
				type: LogType.UNCAUGHT_EXCEPTION,
				workerId: 8,
				error: JSON.stringify(ExceptionUtil.encode('this is an error message')),
			});
			expect(log.toJSON()).to.deep.equal({
				timestamp: 1697616816963,
				nonce: 1234,
				level: 'CRITICAL',
				type: 'UNCAUGHT_EXCEPTION',
				workerId: 8,
				error: { value: 'this is an error message', properties: {}, debug: [] },
			});
		});
	});
});
