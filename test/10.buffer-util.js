'use strict';
const BufferUtil = require('../src/shared/buffer-util');

describe('BufferUtil', function () {
	describe('indexOf()', function () {
		it('searches forward for a specific byte within a Uint8Array', function () {
			const buffer = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
			expect(BufferUtil.indexOf(buffer, 10)).to.equal(0);
			expect(BufferUtil.indexOf(buffer, 80)).to.equal(7);
			expect(BufferUtil.indexOf(buffer, 30)).to.equal(2);
			expect(BufferUtil.indexOf(buffer, 31)).to.equal(-1);
		});

		it('accepts an initialIndex to search from (inclusive)', function () {
			const buffer = new Uint8Array([10, 20, 30, 40, 10, 50]);
			expect(BufferUtil.indexOf(buffer, 10, 0)).to.equal(0);
			expect(BufferUtil.indexOf(buffer, 10, 1)).to.equal(4);
			expect(BufferUtil.indexOf(buffer, 10, 4)).to.equal(4);
			expect(BufferUtil.indexOf(buffer, 10, 5)).to.equal(-1);
			expect(BufferUtil.indexOf(buffer, 30, 2)).to.equal(2);
			expect(BufferUtil.indexOf(buffer, 30, 3)).to.equal(-1);
			expect(BufferUtil.indexOf(buffer, 30, 500)).to.equal(-1);
			expect(BufferUtil.indexOf(buffer, 50, 5)).to.equal(5);
			expect(BufferUtil.indexOf(buffer, 50, 6)).to.equal(-1);
		});

		it('treats a negative initialIndex as an initialIndex of 0', function () {
			const buffer = new Uint8Array([10, 20, 30, 40, 10, 50]);
			expect(BufferUtil.indexOf(buffer, 10, -1)).to.equal(0);
			expect(BufferUtil.indexOf(buffer, 30, -1)).to.equal(2);
			expect(BufferUtil.indexOf(buffer, 50, -50)).to.equal(5);
		});
	});

	describe('lastIndexOf()', function () {
		it('searches backward for a specific byte within a Uint8Array', function () {
			const buffer = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
			expect(BufferUtil.lastIndexOf(buffer, 10)).to.equal(0);
			expect(BufferUtil.lastIndexOf(buffer, 80)).to.equal(7);
			expect(BufferUtil.lastIndexOf(buffer, 30)).to.equal(2);
			expect(BufferUtil.lastIndexOf(buffer, 31)).to.equal(-1);
		});

		it('accepts an initialIndex to search from (inclusive)', function () {
			const buffer = new Uint8Array([10, 20, 30, 40, 10, 50]);
			expect(BufferUtil.lastIndexOf(buffer, 10, 0)).to.equal(0);
			expect(BufferUtil.lastIndexOf(buffer, 10, 1)).to.equal(0);
			expect(BufferUtil.lastIndexOf(buffer, 10, 4)).to.equal(4);
			expect(BufferUtil.lastIndexOf(buffer, 10, 5)).to.equal(4);
			expect(BufferUtil.lastIndexOf(buffer, 30, 1)).to.equal(-1);
			expect(BufferUtil.lastIndexOf(buffer, 30, 2)).to.equal(2);
			expect(BufferUtil.lastIndexOf(buffer, 30, 3)).to.equal(2);
			expect(BufferUtil.lastIndexOf(buffer, 30, 500)).to.equal(2);
			expect(BufferUtil.lastIndexOf(buffer, 50, 4)).to.equal(-1);
			expect(BufferUtil.lastIndexOf(buffer, 50, 5)).to.equal(5);
			expect(BufferUtil.lastIndexOf(buffer, 50, 6)).to.equal(5);
		});

		it('always returns -1 when given a negative initialIndex', function () {
			const buffer = new Uint8Array([10, 20, 30, 40, 10, 50]);
			expect(BufferUtil.lastIndexOf(buffer, 10, -1)).to.equal(-1);
			expect(BufferUtil.lastIndexOf(buffer, 30, -1)).to.equal(-1);
			expect(BufferUtil.lastIndexOf(buffer, 50, -1)).to.equal(-1);
			expect(BufferUtil.lastIndexOf(buffer, 50, -50)).to.equal(-1);
		});
	});

	describe('concat()', function () {
		it('concatenates zero or more Uint8Arrays', function () {
			expect(BufferUtil.concat([])).to.be.an.instanceof(Uint8Array);
			expect(BufferUtil.concat([])).to.deep.equal(new Uint8Array([]));
			expect(BufferUtil.concat([
				new Uint8Array([10, 20, 30]),
			])).to.deep.equal(new Uint8Array([10, 20, 30]));
			expect(BufferUtil.concat([
				new Uint8Array([10, 20, 30]),
				new Uint8Array([7]),
			])).to.deep.equal(new Uint8Array([10, 20, 30, 7]));
			expect(BufferUtil.concat([
				new Uint8Array([10, 20, 30]),
				new Uint8Array([0, 50, 150]),
				new Uint8Array([7]),
			])).to.deep.equal(new Uint8Array([10, 20, 30, 0, 50, 150, 7]));
		});

		it('always copies data into a new Uint8Array', function () {
			const input = new Uint8Array([10, 20, 30, 40]);
			const output = BufferUtil.concat([input]);
			expect(input).to.deep.equal(output);
			expect(input).to.not.equal(output);
			expect(input.buffer).to.not.equal(output.buffer);
		});
	});

	describe('extractSize()', function () {
		it('extracts and concatenates data from an array of Uint8Arrays', function () {
			const source = [
				new Uint8Array([10, 20, 30]),
				new Uint8Array([0, 50, 150]),
				new Uint8Array([7]),
			];
			expect(BufferUtil.extractSize(source, 2)).to.deep.equal(new Uint8Array([10, 20]));
			expect(source).to.deep.equal([
				new Uint8Array([30]),
				new Uint8Array([0, 50, 150]),
				new Uint8Array([7]),
			]);
			expect(BufferUtil.extractSize(source, 4)).to.deep.equal(new Uint8Array([30, 0, 50, 150]));
			expect(source).to.deep.equal([new Uint8Array([7])]);
			source.push(...[
				new Uint8Array([11, 22]),
				new Uint8Array([90, 100, 250]),
			]);
			expect(BufferUtil.extractSize(source, 6)).to.deep.equal(new Uint8Array([7, 11, 22, 90, 100, 250]));
			expect(source).to.deep.equal([]);
		});

		it('throws if there\'s not enough data', function () {
			const source = [
				new Uint8Array([10, 20, 30]),
				new Uint8Array([0, 50, 150]),
				new Uint8Array([7]),
			];
			expect(() => BufferUtil.extractSize(source, 8)).to.throw(RangeError);
			source.pop();
			source.pop();
			expect(() => BufferUtil.extractSize(source, 4)).to.throw(RangeError);
		});

		it('omits copying when possible', function () {
			const buffer1 = new Uint8Array([10, 20, 30]);
			const buffer2 = new Uint8Array([0, 50, 150]);
			const source = [buffer1, buffer2];
			const result1 = BufferUtil.extractSize(source, 3);
			expect(result1).to.equal(buffer1);
			const result2 = BufferUtil.extractSize(source, 2);
			expect(result2).to.deep.equal(new Uint8Array([0, 50]));
			expect(result2.buffer).to.equal(buffer2.buffer);
			expect(result2.byteOffset).to.equal(buffer2.byteOffset);
			expect(source[0]).to.deep.equal(new Uint8Array([150]));
			expect(source[0].buffer).to.equal(buffer2.buffer);
			expect(source[0].byteOffset).to.equal(buffer2.byteOffset + 2);
		});
	});

	describe('isFastAllocation()', function () {
		it('returns true for small numbers', function () {
			expect(BufferUtil.isFastAllocation(0)).to.be.true;
			expect(BufferUtil.isFastAllocation(1)).to.be.true;
			expect(BufferUtil.isFastAllocation(257)).to.be.true;
			expect(BufferUtil.isFastAllocation(1024)).to.be.true;
		});

		it('returns false for large numbers', function () {
			expect(BufferUtil.isFastAllocation(1024 * 1024)).to.be.false;
			expect(BufferUtil.isFastAllocation(0x7fffffff + 1)).to.be.false;
			expect(BufferUtil.isFastAllocation(0xffffffff + 1)).to.be.false;
		});
	});

	describe('alloc()', function () {
		it('returns a new Uint8Array of the specified size', function () {
			expect(BufferUtil.alloc(0)).to.be.an.instanceof(Uint8Array).with.lengthOf(0);
			expect(BufferUtil.alloc(1)).to.be.an.instanceof(Uint8Array).with.lengthOf(1);
			expect(BufferUtil.alloc(257)).to.be.an.instanceof(Uint8Array).with.lengthOf(257);
			expect(BufferUtil.alloc(1024 * 1024)).to.be.an.instanceof(Uint8Array).with.lengthOf(1024 * 1024);
		});

		it('re-uses the same ArrayBuffer if isFastAllocation() returned true', function () {
			const bool = BufferUtil.isFastAllocation(16);
			expect(bool).to.be.true;
			const result1 = BufferUtil.alloc(16);
			const result2 = BufferUtil.alloc(16);
			expect(result1).to.not.equal(result2);
			expect(result1.buffer === result2.buffer).to.equal(bool);
		});

		it('uses a new ArrayBuffer if isFastAllocation() returned false', function () {
			const bool = BufferUtil.isFastAllocation(1024 * 1024);
			expect(bool).to.be.false;
			const result1 = BufferUtil.alloc(1024 * 1024);
			const result2 = BufferUtil.alloc(1024 * 1024);
			expect(result1).to.not.equal(result2);
			expect(result1.buffer === result2.buffer).to.equal(bool);
		});
	});

	describe('from()', function () {
		it('returns a new Uint8Array containing the given array of values', function () {
			expect(BufferUtil.from([])).to.deep.equal(new Uint8Array([]));
			expect(BufferUtil.from([10, 20, 30])).to.deep.equal(new Uint8Array([10, 20, 30]));
		});
	});

	describe('normalize()', function () {
		it('returns the same Buffer that is given', function () {
			const buffer = Buffer.from([10, 20, 30]);
			expect(BufferUtil.normalize(buffer)).to.equal(buffer);;
		});

		it('converts a given Uint8Array to a Buffer, if the environment is Node.js', function () {
			const buffer = new Uint8Array([10, 20, 30]);
			expect(Buffer.isBuffer(BufferUtil.normalize(buffer))).to.equal(typeof window === 'undefined');
			expect(BufferUtil.normalize(buffer)).to.deep.equal(buffer);
		});
	});

	describe('copy()', function () {
		it('copies part of a Uint8Array to another Uint8Array', function () {
			const input = BufferUtil.from([10, 20, 30, 40, 50, 60, 70, 80]);
			const output = BufferUtil.from([1, 2, 3, 4, 5, 6, 7, 8]);
			BufferUtil.copy(input, output, 2, 4, 7);
			expect(output).to.deep.equal(new Uint8Array([1, 2, 50, 60, 70, 6, 7, 8]));
		});
	});

	describe('toString()', function () {
		it('converts part of a Uint8Array containing UTF-8 to a string', function () {
			const input = BufferUtil.from([10, 20, 104, 101, 108, 108, 111, 195, 184, 33, 30]);
			expect(BufferUtil.toString(input, 2, 10)).to.equal('hello\xf8!');
			expect(BufferUtil.toString(input, 2, 2)).to.equal('');
			expect(BufferUtil.toString(input, 2, 1)).to.equal('');
			expect(BufferUtil.toString(input, 9, 30)).to.equal('!\x1e');
		});
	});
});
