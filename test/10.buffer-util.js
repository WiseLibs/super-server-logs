'use strict';
const BufferUtil = require('../src/shared/buffer-util');

describe('BufferUtil', function () {
	describe('indexOf()', function () {
		it('searches forward for a specific byte within a Uint8Array');
		it('accepts an initialIndex to search from (inclusive)');
		it('treats a negative initialIndex as an initialIndex of 0');
	});

	describe('lastIndexOf()', function () {
		it('searches backward for a specific byte within a Uint8Array');
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

	describe('isFastAllocation()', function () {
		it('returns true for small numbers');
		it('returns false for large numbers');
	});

	describe('alloc()', function () {
		it('returns a new Uint8Array of the specified size');
		it('re-uses the same ArrayBuffer if isFastAllocation() returned true');
		it('uses a new ArrayBuffer if isFastAllocation() returned false');
	});

	describe('from()', function () {
		it('returns a new Uint8Array containing the given array of values');
	});

	describe('normalize()', function () {
		it('returns the same Buffer that is given');
		it('converts a given Uint8Array to a Buffer, if the environment is Node.js');
	});

	describe('copy()', function () {
		it('copies part of a Uint8Array to another Uint8Array');
	});

	describe('toString()', function () {
		it('converts part of a Uint8Array containing UTF-8 to a string');
	});
});
