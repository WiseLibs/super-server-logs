'use strict';
const { MasterLogger } = require('..');

describe('MasterLogger', function () {
	afterEach(function () {
		this.logger?.close();
	});

	describe('logging methods', function () {
		specify('STARTING_UP() logs and flushes an event');
		specify('STARTING_UP_COMPLETED() logs and flushes an event');
		specify('SHUTTING_DOWN() logs and flushes an event');
		specify('SHUTTING_DOWN_COMPLETED() logs and flushes an event');
		specify('WORKER_SPAWNED() logs and flushes an event');
		specify('WORKER_EXITED() logs and flushes an event');
		specify('UNCAUGHT_EXCEPTION() logs an event');
		specify('critical() logs an event');
		specify('error() logs an event');
		specify('warn() logs an event');
		specify('info() logs an event');
		specify('debug() includes a log within the next UNCAUGHT_EXCEPTION');
	});

	describe('pings', function () {
		specify('are written periodically');
		specify('are written periodically even if other logs are written');
		specify('are written and flushed immediately after rotating to a new file');
		specify('contain a list of the workerIds that currently exist');
		specify('are not written after the logger is closed');
	});

	describe('log()', function () {
		it('always throws');
	});

	describe('flush()', function () {
		it('flushes all buffered data to the file');
	});

	describe('rotate()', function () {
		it('changes the logger\'s file');
		it('flushes all buffered data before changing files');
		it('throws if filename is not a string');
	});

	describe('close()', function () {
		it('closes the logger');
		it('flushes all buffered data beforing closing');
	});

	describe('constructor', function () {
		it('throws if the given filename is not a string or null');

		describe('options.pingDelay', function () {
			it('control how often pings are written');
			it('throws if not a positive integer');
			it('throws if greater than 2147483647');
		});

		describe('options.debugLogLimit', function () {
			it('limits how many debug logs are kept in memory');
			it('throws if not a non-negative integer');
		});
	});

	describe('disabled logging mode (null filename)', function () {
		specify('STARTING_UP() is a no-op');
		specify('STARTING_UP_COMPLETED() is a no-op');
		specify('SHUTTING_DOWN() is a no-op');
		specify('SHUTTING_DOWN_COMPLETED() is a no-op');
		specify('WORKER_SPAWNED() is a no-op');
		specify('WORKER_EXITED() is a no-op');
		specify('UNCAUGHT_EXCEPTION() is a no-op');
		specify('critical() is a no-op');
		specify('error() is a no-op');
		specify('warn() is a no-op');
		specify('info() is a no-op');
		specify('debug() is a no-op');
		specify('flush() is a no-op');
		specify('rotate() is a no-op');
		specify('close() is a no-op');
		specify('pings are not written periodically');
	});
});
