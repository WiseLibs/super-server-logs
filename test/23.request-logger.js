'use strict';
const { RequestLogger } = require('..');

describe('RequestLogger', function () {
	afterEach(function () {
		this.logger?.close();
	});

	describe('logging methods', function () {
		specify('REQUEST() logs an event');
		specify('REQUEST_META() logs an event');
		specify('RESPONSE() logs an event');
		specify('RESPONSE_FINISHED() logs an event');
		specify('critical() logs an event');
		specify('error() logs an event');
		specify('warn() logs an event');
		specify('info() logs an event');
		specify('debug() includes a log within the next errored RESPONSE[_FINISHED]');
	});

	describe('non-existent methods', function () {
		specify('log()');
		specify('flush()');
		specify('rotate()');
		specify('close()');
	});

	describe('pings', function () {
		specify('are written periodically by the WorkerLogger');
		specify('are not written if other logs are being written');
	});

	describe('state', function () {
		specify('is flushed when the WorkerLogger is flushed');
		specify('is rotated when the WorkerLogger is rotated');
		specify('is closed when the WorkerLogger is closed');
		specify('exposes a requestId UUIDv4 string');
	});

	describe('disabled logging mode (null filename)', function () {
		specify('REQUEST() is a no-op');
		specify('REQUEST_META() is a no-op');
		specify('RESPONSE() is a no-op');
		specify('RESPONSE_FINISHED() is a no-op');
		specify('critical() is a no-op');
		specify('error() is a no-op');
		specify('warn() is a no-op');
		specify('info() is a no-op');
		specify('debug() is a no-op');
		specify('requestId is still available');
	});
});
