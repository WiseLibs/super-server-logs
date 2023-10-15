'use strict';
const Logger = require('../src/nodejs/logger');

describe('Logger', function () {
	afterEach(function () {
		this.logger?.close();
	});

	describe('log()', function () {
		it('writes raw data to the file');
		it('buffers data written in quick succession');
		it('appends a separator when a block is flushed');
		it('escapes all data within a flushed block (to not contain a separator)');
		it('compresses data within a flushed block');
		it('does not compresses data when a block is too small');
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

		describe('options.highWaterMark', function () {
			it('controls how much data can be buffered before being flushed');
			it('throws if not a non-negative integer');
		});

		describe('options.outputDelay', function () {
			it('controls how long data can be buffered for before being flushed');
			it('throws if not a non-negative integer');
			it('throws if greater than 2147483647');
		});

		describe('options.compression', function () {
			it('allows compression to be disabled');
			it('throws if not a boolean');
		});
	});

	describe('disabled logging mode (null filename)', function () {
		specify('log() is a no-op');
		specify('flush() is a no-op');
		specify('rotate() is a no-op');
		specify('close() is a no-op');
	});
});
