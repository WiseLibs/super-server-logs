'use strict';
const BufferUtil = require('../src/shared/buffer-util');

describe('BufferUtil', function () {
	describe('indexOf()', function () {
		it('searches forward for a sequence of bytes within a Uint8Array');
		it('accepts an initialIndex to search from (inclusive)');
		it('treats a negative initialIndex as an initialIndex of 0');
	});

	describe('lastIndexOf()', function () {
		it('searches backward for a sequence of bytes within a Uint8Array');
		it('accepts an initialIndex to search from (inclusive)');
		it('always returns -1 when given a negative initialIndex');
	});

	describe('concat()', function () {
		it('concatenates zero or more Uint8Arrays');
		it('always copies data into a new ArrayBuffer');
	});

	describe('extractSize()', function () {
		it('extracts and concatenates data from an array of Uint8Arrays');
		it('throws if there\'s not enough data');
		it('omits copying when possible');
	});
});
