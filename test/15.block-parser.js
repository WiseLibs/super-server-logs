'use strict';
const BlockParser = require('../src/shared/block-parser');

describe('BlockParser', function () {
	describe('parseOne()', function () {
		it('returns the first log entry in the given block');
		it('unescapes the data within the block');
		it('decompresses the data within the block, only if necessary');
	});

	describe('parseEach()', function () {
		it('returns an iterable iterator');
		it('yields each log entry in the given block');
		it('unescapes the data within the block');
		it('decompresses the data within the block, only if necessary');
	});
});
