'use strict';

/*
	This is a simple FIFO queue implemented using a circular buffer.
	Additionally, it automatically enforces a maximum size by removing the
	oldest elements in the queue when its maximum size is exceeded.
 */

module.exports = class LimitQueue {
	constructor(maxSize) {
		if (!Number.isInteger(maxSize)) {
			throw new TypeError('Expected maxSize to be an integer');
		}

		this._array = new Array(16); // This must be a power of 2
		this._length = 0;
		this._front = 0;
		this._maxSize = maxSize;
	}

	push(value) {
		const arr = this._array;
		if (arr.length === this._length) {
			arr.length *= 2;
			arrayMove(arr, this._length, this._front);
		}
		arr[(this._front + this._length++) & (arr.length - 1)] = value;
		if (this._length > this._maxSize) {
			this.shift();
		}
	}

	shift() {
		if (this._length === 0) {
			return;
		}
		const arr = this._array;
		const frontIndex = this._front;
		const ret = arr[frontIndex];
		arr[frontIndex] = undefined;
		this._front = (frontIndex + 1) & (arr.length - 1);
		this._length -= 1;
		return ret;
	}

	drain() {
		const values = [];
		while (this._length) {
			values.push(this.shift());
		}
		return values;
	}

	get size() {
		return this._length;
	}
}

function arrayMove(arr, moveBy, len) {
	for (let i = 0; i < len; ++i) {
		arr[i + moveBy] = arr[i];
		arr[i] = undefined;
	}
}
