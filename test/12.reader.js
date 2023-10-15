'use strict';
const Reader = require('../src/shared/reader');

describe('Reader', function () {
	describe('uint8()', function () {
		it('reads an unsigned 8-bit integer');
		it('advances the offset by 1 byte');
	});

	describe('uint16()', function () {
		it('reads an unsigned 16-bit integer');
		it('advances the offset by 2 bytes');
	});

	describe('uint32()', function () {
		it('reads an unsigned 32-bit integer');
		it('advances the offset by 4 bytes');
		it('works for integers that use all 32 bits');
	});

	describe('uint48()', function () {
		it('reads an unsigned 48-bit integer');
		it('advances the offset by 6 bytes');
		it('works for integers that use all 48 bits');
	});

	describe('dynamicInteger()', function () {
		it('reads a dynamic unsigned integer');
		it('advances the offset by 1 byte if value <= 253');
		it('advances the offset by 3 bytes if value <= 65535');
		it('advances the offset by 5 bytes if value <= 4294967295');
		it('works for integers that use all 32 bits');
	});

	describe('bytes()', function () {
		it('reads an arbitrary number of raw bytes');
		it('advances the offset by the number of bytes read');
		it('always copy the data to a different ArrayBuffer');
	});

	describe('string()', function () {
		it('reads a UTF-8 string following its byte length as a dynamic integer');
		it('advances the offset by the number of bytes read');
	});

	describe('dynamicIntegerArray()', function () {
		it('reads an array length as a dynamic integer, then N dynamic integers');
		it('advances the offset by the number of bytes read');
	});
});
