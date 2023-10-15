'use strict';
const { LogDirectorySource } = require('..');

describe('LogDirectorySource', function () {
	describe('read()', function () {
		it('returns data from the log directory');
		it('can return data that spans two files');
		it('can return data that spans more than two files');
		it('can return data from files that were deleted/unlinked');
		it('if there\'s not enough, returns as much data as possible');
		it('does not read new data that has not yet been detected via polling');
		it('does not read data from files that are being rotated to');
		it('if immutable, does read data from files that are being rotated to');
		it('if lazy, throws when opening a file that was deleted/unlinked');
		it('if polling, periodically detects new data within the current log file');
		it('if polling, periodically detects new log files');
		it('saves data to cache');
	});

	describe('size()', function () {
		it('returns the total byte size of all logs');
		it('does not count new data that has not yet been detected via polling');
		it('does not count data from files that are being rotated to');
		it('if immutable, does count data from files that are being rotated to');
		it('if polling, periodically detects new data within the current log file');
		it('if polling, periodically detects new log files');
	});

	describe('constructor', function () {
		it('throws if the given dirname is not a string');

		describe('options.cacheSize', function () {
			it('throws if not a non-negative integer');
		});

		describe('options.pollInterval', function () {
			it('throws if not a non-negative integer');
			it('throws if greater than 2147483647');
		});

		describe('options.lazy', function () {
			it('throws if not a boolean');
		});

		describe('options.immutable', function () {
			it('throws if not a boolean');
		});
	});
});
