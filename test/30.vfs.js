'use strict';
const { Vfs } = require('..');

describe('Vfs', function () {
	describe('setup()', function () {
		it('calls the configured "setup" function', async function () {
			let count = 0;
			const vfs = new Vfs({
				read() {},
				size() {},
				async setup() {
					await new Promise(r => setTimeout(r, 10));
					count += 1;
				},
			});
			expect(count).to.equal(0);
			await vfs.setup();
			expect(count).to.equal(1);
		});

		it('sets closed to false after returning', async function () {
			const vfs = new Vfs({
				read() {},
				size() {},
			});
			expect(vfs.closed).to.be.true;
			const promise = Promise.resolve().then(() => {
				expect(vfs.closed).to.be.true;
			});
			await vfs.setup();
			expect(vfs.closed).to.be.false;
			await promise;
		});

		it('sets busy to true while pending (regardless of outcome)', async function () {
			let vfs = new Vfs({
				read() {},
				size() {},
			});
			expect(vfs.busy).to.be.false;
			let promise = vfs.setup();
			expect(vfs.busy).to.be.true;
			await promise;
			expect(vfs.busy).to.be.false;
			vfs = new Vfs({
				read() {},
				size() {},
				async setup() { throw new Error('failed'); },
			});
			expect(vfs.busy).to.be.false;
			promise = vfs.setup();
			expect(vfs.busy).to.be.true;
			await expectToThrow(promise, 'failed');
			expect(vfs.busy).to.be.false;
		});

		it('throws if already open', async function () {
			const vfs = new Vfs({
				read() {},
				size() {},
			});
			await vfs.setup();
			await expectToThrow(vfs.setup(), Error);
			expect(vfs.closed).to.be.false;
		});

		it('throws if invoked multiple times concurrently', async function () {
			const vfs = new Vfs({
				read() {},
				size() {},
				setup() { return new Promise(r => setTimeout(r, 10)); },
			});
			const promise1 = vfs.setup();
			const promise2 = vfs.setup();
			await expectToThrow(promise2, Error);
			await promise1;
			expect(vfs.closed).to.be.false;
		});
	});

	describe('teardown()', function () {
		it('calls the configured "teardown" function', async function () {
			let count = 0;
			const vfs = new Vfs({
				read() {},
				size() {},
				async teardown() {
					await new Promise(r => setTimeout(r, 10));
					count += 1;
				},
			});
			await vfs.setup();
			expect(count).to.equal(0);
			await vfs.teardown();
			expect(count).to.equal(1);
		});

		it('sets closed to true after returning', async function () {
			const vfs = new Vfs({
				read() {},
				size() {},
			});
			expect(vfs.closed).to.be.true;
			await vfs.setup();
			expect(vfs.closed).to.be.false;
			await vfs.teardown();
			expect(vfs.closed).to.be.true;
		});

		it('sets busy to true while pending (regardless of outcome)', async function () {
			let vfs = new Vfs({
				read() {},
				size() {},
			});
			await vfs.setup();
			expect(vfs.busy).to.be.false;
			let promise = vfs.teardown();
			expect(vfs.busy).to.be.true;
			await promise;
			expect(vfs.busy).to.be.false;
			vfs = new Vfs({
				read() {},
				size() {},
				async teardown() { throw new Error('failed'); },
			});
			await vfs.setup();
			expect(vfs.busy).to.be.false;
			promise = vfs.teardown();
			expect(vfs.busy).to.be.true;
			await expectToThrow(promise, 'failed');
			expect(vfs.busy).to.be.false;
		});

		it('throws if not currently open', async function () {
			const vfs = new Vfs({
				read() {},
				size() {},
			});
			await expectToThrow(vfs.teardown(), Error);
			await vfs.setup();
			await vfs.teardown();
			await expectToThrow(vfs.teardown(), Error);
			expect(vfs.closed).to.be.true;
		});

		it('throws if invoked multiple times concurrently', async function () {
			const vfs = new Vfs({
				read() {},
				size() {},
				teardown() { return new Promise(r => setTimeout(r, 10)); },
			});
			await vfs.setup();
			const promise1 = vfs.teardown();
			const promise2 = vfs.teardown();
			await expectToThrow(promise2, Error);
			await promise1;
			expect(vfs.closed).to.be.true;
		});
	});

	describe('read()', function () {
		it('calls the configured "read" function and returns its result', async function () {
			const vfs = new Vfs({
				async read(byteOffset, byteLength) {
					await new Promise(r => setTimeout(r, 10));
					expect(byteOffset).to.equal(Math.floor(byteOffset / Vfs.PAGE_SIZE) * Vfs.PAGE_SIZE);
					expect(byteLength).to.equal(Math.ceil(byteOffset / Vfs.PAGE_SIZE) * Vfs.PAGE_SIZE);
					return new Uint8Array(byteLength);
				},
				size() {},
			});
			await vfs.setup();
			const result = await vfs.read(5000, 89);
			expect(result.byteLength).to.equal(89);
		});

		it('trims the returned data if too much data is provided', async function () {
			const vfs = new Vfs({
				async read(byteOffset, byteLength) {
					await new Promise(r => setTimeout(r, 10));
					expect(byteOffset).to.equal(Math.floor(byteOffset / Vfs.PAGE_SIZE) * Vfs.PAGE_SIZE);
					expect(byteLength).to.equal(Math.ceil(byteOffset / Vfs.PAGE_SIZE) * Vfs.PAGE_SIZE);
					return new Uint8Array(byteLength * 2);
				},
				size() {},
			});
			await vfs.setup();
			const result = await vfs.read(10000, Vfs.PAGE_SIZE + 1);
			expect(result.byteLength).to.equal(Vfs.PAGE_SIZE + 1);
		});

		it('makes a copy of the data returned by the configured "read" function', async function () {
			const data = new Uint8Array(Vfs.PAGE_SIZE).fill(123);
			const vfs = new Vfs({
				async read(byteOffset, byteLength) {
					expect(byteOffset).to.equal(0);
					expect(byteLength).to.equal(Vfs.PAGE_SIZE);
					return data;
				},
				size() {},
			});
			await vfs.setup();
			const result = await vfs.read(0, Vfs.PAGE_SIZE);
			expect(result).to.deep.equal(data);
			expect(result).to.not.equal(data);
			expect(result.buffer).to.not.equal(data.buffer);
		});

		it('sets busy to true while pending (regardless of outcome)', async function () {
			let vfs = new Vfs({
				read() { return new Uint8Array(Vfs.PAGE_SIZE) },
				size() {},
			});
			await vfs.setup();
			expect(vfs.busy).to.be.false;
			let promise = vfs.read(0, Vfs.PAGE_SIZE);
			expect(vfs.busy).to.be.true;
			await promise;
			expect(vfs.busy).to.be.false;
			vfs = new Vfs({
				async read() { throw new Error('failed'); },
				size() {},
			});
			await vfs.setup();
			expect(vfs.busy).to.be.false;
			promise = vfs.read(0, Vfs.PAGE_SIZE);
			expect(vfs.busy).to.be.true;
			await expectToThrow(promise, 'failed');
			expect(vfs.closed).to.be.false;
			expect(vfs.busy).to.be.false;
		});

		it('throws if not currently open', async function () {
			const vfs = new Vfs({
				read() { return new Uint8Array(Vfs.PAGE_SIZE) },
				size() {},
			});
			await expectToThrow(vfs.read(0, Vfs.PAGE_SIZE), Error);
			await vfs.setup();
			await vfs.read(0, Vfs.PAGE_SIZE);
			await vfs.teardown();
			await expectToThrow(vfs.read(0, Vfs.PAGE_SIZE), Error);
			expect(vfs.closed).to.be.true;
			expect(vfs.busy).to.be.false;
		});

		it('throws if invoked multiple times concurrently', async function () {
			const vfs = new Vfs({
				async read() {
					await new Promise(r => setTimeout(r, 10));
					return new Uint8Array(Vfs.PAGE_SIZE);
				},
				size() {},
			});
			await vfs.setup();
			const promise1 = vfs.read(0, Vfs.PAGE_SIZE);
			const promise2 = vfs.read(0, Vfs.PAGE_SIZE);
			await expectToThrow(promise2, Error);
			await promise1;
			expect(vfs.closed).to.be.false;
			expect(vfs.busy).to.be.false;
		});
	});

	describe('size()', function () {
		it('calls the configured "size" function and returns its result', async function () {
			const vfs = new Vfs({
				read() {},
				async size() { return 89; },
			});
			await vfs.setup();
			expect(await vfs.size()).to.equal(89);
		});

		it('sets busy to true while pending (regardless of outcome)', async function () {
			let vfs = new Vfs({
				read() {},
				async size() { return 89; },
			});
			await vfs.setup();
			expect(vfs.busy).to.be.false;
			let promise = vfs.size();
			expect(vfs.busy).to.be.true;
			await promise;
			expect(vfs.busy).to.be.false;
			vfs = new Vfs({
				read() {},
				async size() { throw new Error('failed'); },
			});
			await vfs.setup();
			expect(vfs.busy).to.be.false;
			promise = vfs.size();
			expect(vfs.busy).to.be.true;
			await expectToThrow(promise, 'failed');
			expect(vfs.closed).to.be.false;
			expect(vfs.busy).to.be.false;
		});

		it('throws if not currently open', async function () {
			const vfs = new Vfs({
				read() {},
				async size() { return 89; },
			});
			await expectToThrow(vfs.size(), Error);
			await vfs.setup();
			await vfs.size();
			await vfs.teardown();
			await expectToThrow(vfs.size(), Error);
			expect(vfs.closed).to.be.true;
			expect(vfs.busy).to.be.false;
		});

		it('throws if invoked multiple times concurrently', async function () {
			const vfs = new Vfs({
				read() {},
				async size() {
					await new Promise(r => setTimeout(r, 10));
					return 89;
				},
			});
			await vfs.setup();
			const promise1 = vfs.size();
			const promise2 = vfs.size();
			await expectToThrow(promise2, Error);
			await promise1;
			expect(vfs.closed).to.be.false;
			expect(vfs.busy).to.be.false;
		});
	});

	describe('constructor', function () {
		describe('options.read', function () {
			it('throws if not a function', async function () {
				expect(() => new Vfs({ read: null, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ read: false, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ read: true, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ read: {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ read: Object.create(Function.prototype), size() {} })).to.throw(TypeError);
			});

			it('throws if omitted', async function () {
				expect(() => new Vfs({ read: undefined, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ size() {} })).to.throw(TypeError);
			});
		});

		describe('options.size', function () {
			it('throws if not a function', async function () {
				expect(() => new Vfs({ size: null, read() {} })).to.throw(TypeError);
				expect(() => new Vfs({ size: false, read() {} })).to.throw(TypeError);
				expect(() => new Vfs({ size: true, read() {} })).to.throw(TypeError);
				expect(() => new Vfs({ size: {}, read() {} })).to.throw(TypeError);
				expect(() => new Vfs({ size: Object.create(Function.prototype), read() {} })).to.throw(TypeError);
			});

			it('throws if omitted', async function () {
				expect(() => new Vfs({ size: undefined, read() {} })).to.throw(TypeError);
				expect(() => new Vfs({ read() {} })).to.throw(TypeError);
			});
		});

		describe('options.setup', function () {
			it('throws if not a function', async function () {
				expect(() => new Vfs({ setup: null, read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ setup: false, read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ setup: true, read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ setup: {}, read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ setup: Object.create(Function.prototype), read() {}, size() {} })).to.throw(TypeError);
			});
		});

		describe('options.teardown', function () {
			it('throws if not a function', async function () {
				expect(() => new Vfs({ teardown: null, read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ teardown: false, read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ teardown: true, read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ teardown: {}, read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ teardown: Object.create(Function.prototype), read() {}, size() {} })).to.throw(TypeError);
			});
		});

		describe('options.cacheSize', function () {
			it('throws if not a non-negative integer', async function () {
				expect(() => new Vfs({ cacheSize: null, read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ cacheSize: '1024', read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ cacheSize: { valueOf: () => 1024 }, read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ cacheSize: BigInt(1024), read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ cacheSize: 1024.5, read() {}, size() {} })).to.throw(TypeError);
				expect(() => new Vfs({ cacheSize: -1024, read() {}, size() {} })).to.throw(RangeError);
				expect(() => new Vfs({ cacheSize: -1, read() {}, size() {} })).to.throw(RangeError);
				new Vfs({ cacheSize: 0, read() {}, size() {} }); // Does not throw
			});
		});
	});

	describe('cache', function () {
		it('allows the configured "setup" function to save to cache', async function () {
			const data = new Uint8Array([
				...new Array(Vfs.PAGE_SIZE * 1.5).fill(111),
				...new Array(Vfs.PAGE_SIZE * 0.5).fill(222),
			]);
			const vfs = new Vfs({
				read() { throw new Error('Data should have been cached'); },
				size() {},
				setup(saveToCache) { saveToCache(0, data); },
			});
			await vfs.setup();
			const result = await vfs.read(0, Vfs.PAGE_SIZE * 2);
			expect(result).to.deep.equal(data);
			expect(result).to.not.equal(data);
			expect(result.buffer).to.not.equal(data.buffer);
		});

		it('allows the configured "size" function to save to cache', async function () {
			const data = new Uint8Array([
				...new Array(Vfs.PAGE_SIZE * 1.5).fill(111),
				...new Array(Vfs.PAGE_SIZE * 0.5).fill(222),
			]);
			const vfs = new Vfs({
				read() { throw new Error('Data should have been cached'); },
				size(saveToCache) { saveToCache(0, data); return data.byteLength },
			});
			await vfs.setup();
			expect(await vfs.size()).to.equal(data.byteLength);
			const result = await vfs.read(0, Vfs.PAGE_SIZE * 2);
			expect(result).to.deep.equal(data);
			expect(result).to.not.equal(data);
			expect(result.buffer).to.not.equal(data.buffer);
		});

		it('allows the configured "read" function to save to cache', async function () {
			let readCount = 0;
			const data = new Uint8Array([
				...new Array(Vfs.PAGE_SIZE * 1.5).fill(111),
				...new Array(Vfs.PAGE_SIZE * 0.5).fill(222),
			]);
			const vfs = new Vfs({
				read(byteOffset, byteLength, saveToCache) {
					readCount += 1;
					saveToCache(0, data);
					return data.subarray(byteOffset);
				},
				size() {},
			});
			await vfs.setup();
			expect(await vfs.read(0, 123)).to.deep.equal(data.subarray(0, 123));
			expect(readCount).to.equal(1);
			const result = await vfs.read(0, Vfs.PAGE_SIZE * 2);
			expect(readCount).to.equal(1);
			expect(result).to.deep.equal(data);
			expect(result).to.not.equal(data);
			expect(result.buffer).to.not.equal(data.buffer);
		});

		it('copies any data that is saved to cache', async function () {
			const data = new Uint8Array([
				...new Array(Vfs.PAGE_SIZE * 1.5).fill(111),
				...new Array(Vfs.PAGE_SIZE * 0.5).fill(222),
			]);
			const vfs = new Vfs({
				read() { throw new Error('Data should have been cached'); },
				size() {},
				setup(saveToCache) { saveToCache(0, data); },
			});
			await vfs.setup();
			const cachedData = new Uint8Array(data);
			data.fill(0);
			const result = await vfs.read(0, Vfs.PAGE_SIZE * 2);
			expect(result).to.deep.equal(cachedData);
			expect(result).to.not.equal(cachedData);
			expect(result.buffer).to.not.equal(cachedData.buffer);
			expect(result).to.not.equal(data);
			expect(result.buffer).to.not.equal(data.buffer);
		});

		it('does not save incomplete pages to cache', async function () {
			const data = new Uint8Array([
				...new Array(Vfs.PAGE_SIZE).fill(1),
				...new Array(Vfs.PAGE_SIZE).fill(2),
				...new Array(Vfs.PAGE_SIZE).fill(3),
				...new Array(Vfs.PAGE_SIZE).fill(4),
				...new Array(Vfs.PAGE_SIZE).fill(5),
			]);
			const vfs = new Vfs({
				read(byteOffset, byteLength, saveToCache) {
					saveToCache(1, data.subarray(1, -1));
					return new Uint8Array(byteLength);
				},
				size() {},
			});
			await vfs.setup();
			expect(await vfs.read(0, data.byteLength)).to.deep.equal(new Uint8Array(data.byteLength));
			expect(await vfs.read(0, data.byteLength - Vfs.PAGE_SIZE)).to.deep.equal(new Uint8Array([
				...new Array(Vfs.PAGE_SIZE),
				...new Array(Vfs.PAGE_SIZE).fill(2),
				...new Array(Vfs.PAGE_SIZE).fill(3),
				...new Array(Vfs.PAGE_SIZE).fill(4),
			]));
			expect(await vfs.read(Vfs.PAGE_SIZE, data.byteLength - Vfs.PAGE_SIZE)).to.deep.equal(new Uint8Array([
				...new Array(Vfs.PAGE_SIZE).fill(2),
				...new Array(Vfs.PAGE_SIZE).fill(3),
				...new Array(Vfs.PAGE_SIZE).fill(4),
				...new Array(Vfs.PAGE_SIZE),
			]));
		});

		it('does not save chunks that are too large relative to options.cacheSize', async function () {
			const data = new Uint8Array(1024 * 32).fill(1);
			const vfs = new Vfs({
				cacheSize: data.byteLength - 1,
				read(byteOffset, byteLength, saveToCache) {
					saveToCache(0, data);
					return new Uint8Array(byteLength);
				},
				size() {},
			});
			await vfs.setup();
			expect(await vfs.read(0, data.byteLength)).to.deep.equal(new Uint8Array(data.byteLength));
			expect(await vfs.read(0, data.byteLength)).to.deep.equal(new Uint8Array(data.byteLength));
		});

		it('automatically deletes old cache when options.cacheSize is exceeded', async function () {
			let modifyCache = true;
			const pageOf = (val) => new Uint8Array(Vfs.PAGE_SIZE).fill(val);
			const data = new Uint8Array([
				...new Array(Vfs.PAGE_SIZE).fill(1),
				...new Array(Vfs.PAGE_SIZE).fill(2),
				...new Array(Vfs.PAGE_SIZE).fill(3),
				...new Array(Vfs.PAGE_SIZE).fill(4),
				...new Array(Vfs.PAGE_SIZE).fill(5),
			]);
			const vfs = new Vfs({
				cacheSize: Vfs.PAGE_SIZE * 3,
				read(byteOffset, byteLength, saveToCache) {
					if (modifyCache) {
						saveToCache(byteOffset, data.subarray(byteOffset, byteOffset + byteLength));
					}
					return new Uint8Array(byteLength);
				},
				size() {},
			});
			await vfs.setup();
			expect(await vfs.read(Vfs.PAGE_SIZE * 0, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			expect(await vfs.read(Vfs.PAGE_SIZE * 0, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(1));
			expect(await vfs.read(Vfs.PAGE_SIZE * 1, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			expect(await vfs.read(Vfs.PAGE_SIZE * 1, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(2));
			expect(await vfs.read(Vfs.PAGE_SIZE * 2, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			expect(await vfs.read(Vfs.PAGE_SIZE * 2, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(3));
			expect(await vfs.read(Vfs.PAGE_SIZE * 3, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			expect(await vfs.read(Vfs.PAGE_SIZE * 3, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(4));
			expect(await vfs.read(Vfs.PAGE_SIZE * 4, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			expect(await vfs.read(Vfs.PAGE_SIZE * 4, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(5));
			modifyCache = false;
			expect(await vfs.read(Vfs.PAGE_SIZE * 0, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			expect(await vfs.read(Vfs.PAGE_SIZE * 1, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			expect(await vfs.read(Vfs.PAGE_SIZE * 2, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(3));
			expect(await vfs.read(Vfs.PAGE_SIZE * 3, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(4));
			expect(await vfs.read(Vfs.PAGE_SIZE * 4, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(5));
			modifyCache = true;
			expect(await vfs.read(Vfs.PAGE_SIZE * 0, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			expect(await vfs.read(Vfs.PAGE_SIZE * 2, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			modifyCache = false;
			expect(await vfs.read(Vfs.PAGE_SIZE * 0, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(1));
			expect(await vfs.read(Vfs.PAGE_SIZE * 1, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			expect(await vfs.read(Vfs.PAGE_SIZE * 2, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(3));
			expect(await vfs.read(Vfs.PAGE_SIZE * 3, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			expect(await vfs.read(Vfs.PAGE_SIZE * 4, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(5));
			modifyCache = true;
			expect(await vfs.read(Vfs.PAGE_SIZE * 0, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(1));
			expect(await vfs.read(Vfs.PAGE_SIZE * 3, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			expect(await vfs.read(Vfs.PAGE_SIZE * 1, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			modifyCache = false;
			expect(await vfs.read(Vfs.PAGE_SIZE * 0, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(1));
			expect(await vfs.read(Vfs.PAGE_SIZE * 1, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(2));
			expect(await vfs.read(Vfs.PAGE_SIZE * 2, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
			expect(await vfs.read(Vfs.PAGE_SIZE * 3, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(4));
			expect(await vfs.read(Vfs.PAGE_SIZE * 4, Vfs.PAGE_SIZE)).to.deep.equal(pageOf(0));
		});
	});
});

async function expectToThrow(promise, ...args) {
	try {
		await promise;
	} catch (err) {
		expect(() => { throw err; }).to.throw(...args);
		return;
	}
	throw new Error('Expected promise to throw');
}
