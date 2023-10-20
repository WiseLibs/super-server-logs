'use strict';
const UniqueQueue = require('../src/shared/unique-queue');

describe('UniqueQueue', function () {
	it('allows pushing and shifting values in FIFO order', function () {
		const queue = new UniqueQueue();
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
		this.slow(1000);
		const queue = new UniqueQueue();
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

	it('allows deleting any value in the queue', function () {
		const queue = new UniqueQueue();
		expect(queue.size).to.equal(0);
		queue.push('hello');
		queue.push('world');
		queue.push('foo');
		queue.push('bar');
		queue.push('baz');
		expect(queue.size).to.equal(5);
		expect(queue.delete('foo')).to.be.true;
		expect(queue.delete('foo')).to.be.false;
		expect(queue.delete('baz')).to.be.true;
		expect(queue.shift()).to.equal('hello');
		expect(queue.shift()).to.equal('world');
		expect(queue.shift()).to.equal('bar');
		expect(queue.size).to.equal(0);
		expect(queue.shift()).to.be.undefined;
	});

	it('throws if a dupicate item is added to the queue', function () {
		const queue = new UniqueQueue();
		queue.push('hello');
		queue.push('world');
		queue.push('foo')
		expect(() => queue.push('world')).to.throw(Error);
		expect(() => queue.push('world')).to.throw(Error);
		expect(() => queue.push('hello')).to.throw(Error);
		expect(() => queue.push('foo')).to.throw(Error);
		expect(queue.size).to.equal(3);
		expect(queue.delete('world')).to.be.true;
		queue.push('world');
		expect(queue.size).to.equal(3);
	});
});
