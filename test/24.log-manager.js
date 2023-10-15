'use strict';
const { LogManager } = require('..');

describe('LogManager', function () {
	afterEach(function () {
		this.manager?.close();
	});

	describe('event "rotate"', function () {
		it('is emitted when the latest log file is too big');
		it('is emitted when the latest log file is too old');
		it('is passed a new filename');
	});

	describe('event "error"', function () {
		it('is emitted if fs.stat() fails');
		it('is emitted if fs.readdir() fails');
	});

	describe('close()', function () {
		it('closes the log manager');
	});

	describe('state', function () {
		specify('exposes the given dirname');
		specify('exposes the current filename');
	});

	describe('constructor', function () {
		it('throws if the given dirname is not a string or null');
		it('creates the given directory if it does not exist');
		it('ensures the created directory has unix permissions 0o700');
		it('does not create a new directory if it already exists');
		it('does not modify the permissions of the directory if it already exists');

		describe('options.pollInterval', function () {
			it('controls how often the current log file\'s size is polled');
			it('throws if not a positive integer');
			it('throws if greater than 2147483647');
		});

		describe('options.logSizeLimit', function () {
			it('limits the maximum total size of all logs');
			it('throws if not a positive integer');
			it('throws if less than 1048576 (1 MiB)');
		});

		describe('options.logAgeLimit', function () {
			it('limits the maximum age of each log file');
			it('throws if not a positive integer');
			it('throws if less than 60000 (1 minute)');
		});

		describe('options.granularity', function () {
			it('controls how many divisions the logSizeLimit is broken into');
			it('controls how many divisions the logAgeLimit is broken into');
			it('throws if not a positive integer');
			it('throws if less than 2');
			it('throws if logAgeLimit / granularity is less than 1000 (1 second)');
		});
	});

	describe('disabled logging mode (null dirname)', function () {
		specify('dirname is null');
		specify('filename is null');
		specify('closed is true');
		specify('"rotate" events are not emitted');
		specify('no directory is created');
	});
});
