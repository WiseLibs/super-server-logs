'use strict';
const LimitQueue = require('../src/nodejs/limit-queue');

describe('LimitQueue', function () {
	it('allows pushing and shifting values in FIFO order', function () {
		const queue = new LimitQueue(10);
		expect(queue.size).to.equal(0);
		queue.push('hello');
		queue.push('world');
		queue.push('foo');
		queue.push('bar');
		queue.push('baz');
		expect(queue.size).to.equal(5);
		expect(queue.shift()).to.equal('hello');
		expect(queue.shift()).to.equal('world');
		expect(queue.shift()).to.equal('foo');
		expect(queue.shift()).to.equal('bar');
		expect(queue.shift()).to.equal('baz');
		expect(queue.size).to.equal(0);
		expect(queue.shift()).to.be.undefined;
	});

	it('supports an arbitrary number of elements', function () {
		const queue = new LimitQueue(80000);
		queue.push(123);
		queue.push(456);
		expect(queue.shift()).to.equal(123);
		expect(queue.shift()).to.equal(456);
		for (let i = 0; i < 70000; ++i) queue.push(i);
		for (let i = 0; i < 70000; ++i) expect(queue.shift()).to.equal(i);
		expect(queue.shift()).to.be.undefined;
		queue.push(789);
		expect(queue.shift()).to.equal(789);
		expect(queue.size).to.equal(0);
	});

	it('allows draining all values in FIFO order', function () {
		const queue = new LimitQueue(10);
		expect(queue.size).to.equal(0);
		queue.push('hello');
		queue.push('world');
		queue.push('foo');
		queue.push('bar');
		queue.push('baz');
		expect(queue.size).to.equal(5);
		expect(queue.shift()).to.equal('hello');
		expect(queue.drain()).to.deep.equal(['world', 'foo', 'bar', 'baz']);
		expect(queue.size).to.equal(0);
	});

	it('automatically deletes values beyond the maxSize in FIFO order', function () {
		const queue = new LimitQueue(4);
		expect(queue.size).to.equal(0);
		queue.push('hello');
		queue.push('world');
		queue.push('foo');
		queue.push('bar');
		expect(queue.size).to.equal(4);
		queue.push('baz');
		expect(queue.size).to.equal(4);
		queue.push('qux');
		expect(queue.size).to.equal(4);
		expect(queue.shift()).to.equal('foo');
		expect(queue.size).to.equal(3);
		expect(queue.drain()).to.deep.equal(['bar', 'baz', 'qux']);
		expect(queue.size).to.equal(0);
	});
});
