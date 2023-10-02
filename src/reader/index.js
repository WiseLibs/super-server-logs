'use strict';
const Vfs = require('./vfs');
const readRange = require('./read-range');
const readTail = require('./read-tail');

module.exports = class LogReader {
	constructor(vfs) {
		if (!(vfs instanceof Vfs)) {
			throw new TypeError('Expected argument to be a Vfs object');
		}
		if (!vfs.closed || vfs.busy) {
			throw new Error('Vfs object is already in use');
		}

		this._vfs = vfs;
	}

	async *range(minTimestamp, maxTimestamp) {
		if (!Number.isInteger(minTimestamp)) {
			throw new TypeError('Expected minTimestamp to be an integer');
		}
		if (!Number.isInteger(maxTimestamp)) {
			throw new TypeError('Expected maxTimestamp to be an integer');
		}
		if (minTimestamp < 0) {
			throw new RangeError('Expected minTimestamp to be non-negative');
		}
		if (maxTimestamp < 0) {
			throw new RangeError('Expected maxTimestamp to be non-negative');
		}
		if (!this._vfs.closed || this._vfs.busy) {
			throw new Error('LogReader is already busy with another operation');
		}
		if (minTimestamp > maxTimestamp) {
			return;
		}

		await this._vfs.setup();
		try {
			for await (const log of readRange(this._vfs, minTimestamp, maxTimestamp)) {
				yield log; // TODO: convert log to a friendly object
			}
		} finally {
			await this._vfs.teardown();
		}
	}

	async *tail(minTimestamp = Date.now(), { pollInterval = 200 } = {}) {
		if (!Number.isInteger(minTimestamp)) {
			throw new TypeError('Expected minTimestamp to be an integer');
		}
		if (!Number.isInteger(pollInterval)) {
			throw new TypeError('Expected options.pollInterval to be an integer');
		}
		if (minTimestamp < 0) {
			throw new RangeError('Expected minTimestamp to be non-negative');
		}
		if (pollInterval < 1) {
			throw new RangeError('Expected options.pollInterval to be at least 1 ms');
		}
		if (pollInterval > 0x7fffffff) {
			throw new RangeError('Expected options.pollInterval to be no greater than 2147483647');
		}
		if (!this._vfs.closed || this._vfs.busy) {
			throw new Error('LogReader is already busy with another operation');
		}

		await this._vfs.setup();
		try {
			for await (const log of readTail(this._vfs, minTimestamp, pollInterval)) {
				yield log; // TODO: convert log to a friendly object
			}
		} finally {
			await this._vfs.teardown();
		}
	}
};
