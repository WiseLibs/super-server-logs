'use strict';
const Writer = require('../src/nodejs/writer');

describe('Writer', function () {
	describe('uint8()', function () {
		it('writes an unsigned 8-bit integer');
		it('wraps the input integer if out of bounds');
	});

	describe('uint16()', function () {
		it('writes an unsigned 16-bit integer');
		it('wraps the input integer if out of bounds');
	});

	describe('uint32()', function () {
		it('writes an unsigned 32-bit integer');
		it('wraps the input integer if out of bounds');
	});

	describe('uint48()', function () {
		it('writes an unsigned 48-bit integer');
		it('wraps the input integer if out of bounds');
	});

	describe('dynamicInteger()', function () {
		it('writes a dynamic unsigned integer in 1 byte if value <= 253');
		it('writes a dynamic unsigned integer in 3 bytes if value <= 65535');
		it('writes a dynamic unsigned integer in 5 bytes if value <= 4294967295');
		it('wraps the input integer if out of bounds');
	});

	describe('bytes()', function () {
		it('writes an arbitrary number of raw bytes');
	});

	describe('string()', function () {
		it('writes a UTF-8 string following its byte length as a dynamic integer');
	});

	describe('json()', function () {
		it('writes a string containing serialized JSON');
		it('throws if no JSON can be serialized');
		it('does not serialize any Buffer, ArrayBuffer, or ArrayBuffer view');
	});

	describe('dynamicIntegerArray()', function () {
		it('writes an array length as a dynamic integer, then N dynamic integers');
		it('wraps the input integers if out of bounds');
	});
});
