'use strict';
const { Vfs } = require('..');

describe('Vfs', function () {
	describe('setup()', function () {
		it('calls the configured "setup" function');
		it('sets open to true after returning');
		it('sets busy to true while pending (regardless of outcome)');
		it('throws if already open');
		it('throws if invoked multiple times concurrently');
	});

	describe('teardown()', function () {
		it('calls the configured "teardown" function');
		it('sets open to false after returning');
		it('sets busy to true while pending (regardless of outcome)');
		it('throws if not currently open');
		it('throws if invoked multiple times concurrently');
	});

	describe('read()', function () {
		it('calls the configured "read" function and returns its result');
		it('makes a copy of the data returned by the configured "read" function');
		it('sets busy to true while pending (regardless of outcome)');
		it('throws if not currently open');
		it('throws if invoked multiple times concurrently');
	});

	describe('size()', function () {
		it('calls the configured "size" function and returns its result');
		it('sets busy to true while pending (regardless of outcome)');
		it('throws if not currently open');
		it('throws if invoked multiple times concurrently');
	});

	describe('constructor', function () {
		describe('options.read', function () {
			it('throws if not a function');
			it('throws if omitted');
		});

		describe('options.size', function () {
			it('throws if not a function');
			it('throws if omitted');
		});

		describe('options.setup', function () {
			it('throws if not a function');
		});

		describe('options.teardown', function () {
			it('throws if not a function');
		});

		describe('options.cacheSize', function () {
			it('throws if not a non-negative integer');
		});
	});

	describe('cache', function () {
		it('allows the configured "setup" function to save to cache');
		it('allows the configured "size" function to save to cache');
		it('allows the configured "read" function to save to cache');
		it('automatically deletes old cache when options.cacheSize is exceeded');
		it('does not save incomplete pages to cache');
		it('does not save chunks that are too large relative to options.cacheSize');
		it('copies any data that is saved to cache');
	});
});
