'use strict';

/*
	This is a simple FIFO queue implemented using a doubly-linked list.
	Additionally, it uses a hash map to assist in efficient O(1) deletion of any
	value in the queue. All values in the queue must be unique; attempting to
	push a value that already exists results in a thrown exception.
 */

module.exports = class UniqueQueue {
	constructor() {
		this._first = null;
		this._last = null;
		this._nodes = new Map();
	}

	push(value) {
		if (this._nodes.has(value)) {
			throw new Error('Value already exists in queue');
		}

		const oldLast = this._last;
		const node = { value, next: null, prev: oldLast };

		if (oldLast) {
			oldLast.next = node;
		} else {
			this._first = node;
		}

		this._last = node;
		this._nodes.set(value, node);
	}

	shift() {
		if (!this._first) {
			return;
		}

		const node = this._first;
		const newFirst = node.next;

		if (newFirst) {
			newFirst.prev = null;
		} else {
			this._last = null;
		}

		this._first = newFirst;
		this._nodes.delete(node.value);
		return node.value;
	}

	delete(value) {
		const node = this._nodes.get(value);
		if (!node) {
			return false;
		}

		const prevNode = node.prev;
		const nextNode = node.next;

		if (nextNode) {
			nextNode.prev = prevNode;
		} else {
			this._last = prevNode;
		}

		if (prevNode) {
			prevNode.next = nextNode;
		} else {
			this._first = nextNode;
		}

		this._nodes.delete(value);
		return true;
	}

	get size() {
		return this._nodes.size;
	}
};
