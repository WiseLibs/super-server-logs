'use strict';
const { LogReader } = require('..');

describe('LogReader', function () {
	describe('tail()', function () {
		it('yields all logs written in the future');
		it('can start yielding at a future minimum timestamp bound (inclusive)');
		it('can start yielding at a past minimum timestamp bound (inclusive)');
		it('accepts options.pollInterval to control how often the Vfs is polled');
		it('throws if options.pollInterval is not a positive integer');
		it('throws if options.pollInterval is larger than 2147483647');
		it('throws if the minimum timestamp is not a non-negative integer');
		it('throws if called concurrently');
	});

	describe('range()', function () {
		it('yields all logs (ascending) between two timestamp bounds (inclusive)');
		it('works when the maximum timestamp bound exceeds the last log');
		it('works when the minimum timestamp bound proceeds the first log');
		it('yields nothing when the minimum timestamp is greater than the maximum');
		it('throws if the minimum timestamp is not a non-negative integer');
		it('throws if the maximum timestamp is not a non-negative integer');
		it('throws if called concurrently');
	});

	describe('rangeReversed()', function () {
		it('yields all logs (descending) between two timestamp bounds (inclusive)');
		it('works when the maximum timestamp bound exceeds the last log');
		it('works when the minimum timestamp bound proceeds the first log');
		it('yields nothing when the minimum timestamp is greater than the maximum');
		it('throws if the minimum timestamp is not a non-negative integer');
		it('throws if the maximum timestamp is not a non-negative integer');
		it('throws if called concurrently');
	});

	describe('bulkTail()', function () {
		it('yields a bulk stream of all logs written in the future');
		it('can start yielding at a future minimum timestamp bound (inclusive)');
		it('can start yielding at a past minimum timestamp bound (inclusive)');
		it('accepts options.pollInterval to control how often the Vfs is polled');
		it('throws if options.pollInterval is not a positive integer');
		it('throws if options.pollInterval is larger than 2147483647');
		it('throws if the minimum timestamp is not a non-negative integer');
		it('throws if called concurrently');
	});

	describe('bulkRange()', function () {
		it('yields a bulk stream of all logs between two timestamp bounds');
		it('works when the maximum timestamp bound exceeds the last log');
		it('works when the minimum timestamp bound proceeds the first log');
		it('yields nothing when the minimum timestamp is greater than the maximum');
		it('throws if the minimum timestamp is not a non-negative integer');
		it('throws if the maximum timestamp is not a non-negative integer');
		it('throws if called concurrently');
	});

	describe('bulkRangeReversed()', function () {
		it('yields a reverse bulk stream of all logs between two timestamp bounds');
		it('works when the maximum timestamp bound exceeds the last log');
		it('works when the minimum timestamp bound proceeds the first log');
		it('yields nothing when the minimum timestamp is greater than the maximum');
		it('throws if the minimum timestamp is not a non-negative integer');
		it('throws if the maximum timestamp is not a non-negative integer');
		it('throws if called concurrently');
	});
});
