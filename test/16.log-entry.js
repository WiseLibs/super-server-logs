'use strict';
const { LogEntry } = require('..');

describe('LogEntry', function () {
	describe('getRequestId()', function () {
		it('returns a string UUIDv4 if this.requestId is present');
		it('returns null if this.requestId is null');
		it('returns undefined if this.requestId is undefined');
	});

	describe('getIpAddress()', function () {
		it('returns a string IPv4 address if this.ipAddress is an integer');
		it('returns a string IPv6 address if this.ipAddress is a Uint8Array');
		it('throws if this.ipAddress is an integer but not 32-bit unsigned');
		it('throws if this.ipAddress is a Uint8Array but not 16 bytes');
		it('throws if this.ipAddress is not an integer or Uint8Array');
		it('returns undefined if this.type is not LogType.REQUEST');
	});

	describe('getHttpVersion()', function () {
		it('returns a string HTTP version');
		it('returns undefined if this.type is not LogType.REQUEST');
	});

	describe('getHttpMethod()', function () {
		it('returns a string HTTP method if this.method is an enum value');
		it('returns a string HTTP method if this.method is a string');
		it('returns undefined if this.type is not LogType.REQUEST');
	});

	describe('getError()', function () {
		it('returns an object of error info if this.error is present');
		it('returns null if this.error is null');
		it('returns undefined if this.error is undefined');
	});

	describe('toJSON()', function () {
		it('returns a JSON-compatible object of the REQUEST-type log');
		it('returns a JSON-compatible object of the REQUEST_META-type log');
		it('returns a JSON-compatible object of the RESPONSE-type log');
		it('returns a JSON-compatible object of the RESPONSE_FINISHED-type log');
		it('returns a JSON-compatible object of the LOG-type log');
		it('returns a JSON-compatible object of the LIFECYCLE-type log');
		it('returns a JSON-compatible object of the UNCAUGHT_EXCEPTION-type log');
	});
});
