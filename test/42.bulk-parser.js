'use strict';
const { BulkParser } = require('..');

describe('BulkParser', function () {
	describe('read()', function () {
		it('takes a bulk stream and yields the blocks it contains');
	});

	describe('readReversed()', function () {
		it('takes a reverse bulk stream and yields the blocks it contains');
	});

	describe('parse()', function () {
		it('returns an iterable iterator');
		it('yields each log entry in the given block');
	});
});
