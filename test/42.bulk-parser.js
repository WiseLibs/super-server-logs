'use strict';
const { BulkParser } = require('..');

describe('BulkParser', function () {
	describe('read()', function () {
		it('takes a bulk stream and yields the blocks it contains');
		it('supports bulk streams that end in an incomplete block');
		it('yields nothing for empty bulk streams');
	});

	describe('readReversed()', function () {
		it('takes a reverse bulk stream and yields the blocks it contains');
		it('supports reverse bulk streams that start with an incomplete block');
		it('yields nothing for empty reverse bulk streams');
	});

	describe('parse()', function () {
		it('returns an iterable iterator');
		it('yields each log entry in the given block');
		it('supports escaped blocks');
		it('supports compressed blocks');
		it('supports uncompressed blocks');
	});
});
