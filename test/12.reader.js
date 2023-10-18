'use strict';
const Writer = require('../src/nodejs/writer');
const Reader = require('../src/shared/reader');

describe('Reader', function () {
	describe('uint8()', function () {
		it('reads an unsigned 8-bit integer', function () {
			const reader = new Reader(new Writer().uint8(0).uint8(15).done());
			expect(reader.uint8()).to.equal(0);
			expect(reader.uint8()).to.equal(15);
		});

		it('advances the offset by 1 byte', function () {
			const reader = new Reader(new Writer().uint8(250).done());
			expect(reader.offset).to.equal(0);
			expect(reader.uint8()).to.equal(250);
			expect(reader.offset).to.equal(1);
		});

		it('throws when reading out of bounds', function () {
			const reader = new Reader(new Writer().uint8(15).done());
			expect(reader.uint8()).to.equal(15);
			expect(() => reader.uint8()).to.throw(RangeError);
			expect(() => reader.uint8()).to.throw(RangeError);
		});
	});

	describe('uint16()', function () {
		it('reads an unsigned 16-bit integer', function () {
			const reader = new Reader(new Writer().uint16(15).uint16(700).done());
			expect(reader.uint16()).to.equal(15);
			expect(reader.uint16()).to.equal(700);
		});

		it('advances the offset by 2 bytes', function () {
			const reader = new Reader(new Writer().uint16(15).done());
			expect(reader.offset).to.equal(0);
			expect(reader.uint16()).to.equal(15);
			expect(reader.offset).to.equal(2);
		});

		it('throws when reading out of bounds', function () {
			const reader = new Reader(new Writer().uint16(15).uint8(30).done());
			expect(reader.uint16()).to.equal(15);
			expect(() => reader.uint16()).to.throw(RangeError);
			expect(() => reader.uint16()).to.throw(RangeError);
			expect(reader.uint8()).to.equal(30);
		});
	});

	describe('uint32()', function () {
		it('reads an unsigned 32-bit integer', function () {
			const reader = new Reader(new Writer().uint32(15).uint32(1245165).done());
			expect(reader.uint32()).to.equal(15);
			expect(reader.uint32()).to.equal(1245165);
		});

		it('advances the offset by 4 bytes', function () {
			const reader = new Reader(new Writer().uint32(15).done());
			expect(reader.offset).to.equal(0);
			expect(reader.uint32()).to.equal(15);
			expect(reader.offset).to.equal(4);
		});

		it('throws when reading out of bounds', function () {
			const reader = new Reader(new Writer().uint32(15).uint8(30).uint16(45).done());
			expect(reader.uint32()).to.equal(15);
			expect(() => reader.uint32()).to.throw(RangeError);
			expect(() => reader.uint32()).to.throw(RangeError);
			expect(reader.uint8()).to.equal(30);
			expect(reader.uint16()).to.equal(45);
		});

		it('works for integers that use all 32 bits', function () {
			const reader = new Reader(new Writer().uint32(0xffffffff).done());
			expect(reader.uint32()).to.equal(0xffffffff);
		});
	});

	describe('uint48()', function () {
		it('reads an unsigned 48-bit integer', function () {
			const reader = new Reader(new Writer().uint48(15).uint48(4298814828).done());
			expect(reader.uint48()).to.equal(15);
			expect(reader.uint48()).to.equal(4298814828);
		});

		it('advances the offset by 6 bytes', function () {
			const reader = new Reader(new Writer().uint48(15).done());
			expect(reader.offset).to.equal(0);
			expect(reader.uint48()).to.equal(15);
			expect(reader.offset).to.equal(6);
		});

		it('throws when reading out of bounds', function () {
			const reader = new Reader(new Writer().uint48(15).uint8(30).uint32(45).done());
			expect(reader.uint48()).to.equal(15);
			expect(() => reader.uint48()).to.throw(RangeError);
			expect(() => reader.uint48()).to.throw(RangeError);
			expect(reader.uint8()).to.equal(30);
			expect(reader.uint32()).to.equal(45);
		});

		it('works for integers that use all 48 bits', function () {
			const reader = new Reader(new Writer().uint48(0xffffffffffff).done());
			expect(reader.uint48()).to.equal(0xffffffffffff);
		});
	});

	describe('dynamicInteger()', function () {
		it('reads a dynamic unsigned integer', function () {
			const reader = new Reader(new Writer().dynamicInteger(15).dynamicInteger(254).done());
			expect(reader.dynamicInteger()).to.equal(15);
			expect(reader.dynamicInteger()).to.equal(254);
		});

		it('advances the offset by 1 byte if value <= 253', function () {
			const reader = new Reader(new Writer().dynamicInteger(0).dynamicInteger(253).done());
			expect(reader.offset).to.equal(0);
			expect(reader.dynamicInteger()).to.equal(0);
			expect(reader.offset).to.equal(1);
			expect(reader.dynamicInteger()).to.equal(253);
			expect(reader.offset).to.equal(2);
		});

		it('advances the offset by 3 bytes if value <= 65535', function () {
			const reader = new Reader(new Writer().dynamicInteger(254).dynamicInteger(65535).done());
			expect(reader.offset).to.equal(0);
			expect(reader.dynamicInteger()).to.equal(254);
			expect(reader.offset).to.equal(3);
			expect(reader.dynamicInteger()).to.equal(65535);
			expect(reader.offset).to.equal(6);
		});

		it('advances the offset by 5 bytes if value <= 4294967295', function () {
			const reader = new Reader(new Writer().dynamicInteger(65536).dynamicInteger(4294967295).done());
			expect(reader.offset).to.equal(0);
			expect(reader.dynamicInteger()).to.equal(65536);
			expect(reader.offset).to.equal(5);
			expect(reader.dynamicInteger()).to.equal(4294967295);
			expect(reader.offset).to.equal(10);
		});

		it('throws when reading out of bounds', function () {
			let reader = new Reader(new Writer().dynamicInteger(15).uint8(254).uint8(30).done());
			expect(reader.dynamicInteger()).to.equal(15);
			expect(() => reader.dynamicInteger()).to.throw(RangeError);
			reader = new Reader(new Writer().uint8(255).uint16(15).uint8(30).done());
			expect(() => reader.dynamicInteger()).to.throw(RangeError);
		});

		it('works for integers that use all 32 bits', function () {
			const reader = new Reader(new Writer().dynamicInteger(0xffffffff).done());
			expect(reader.dynamicInteger()).to.equal(0xffffffff);
		});
	});

	describe('bytes()', function () {
		it('reads an arbitrary number of raw bytes', function () {
			const reader = new Reader(new Uint8Array([10, 20, 30, 40, 50]));
			expect(reader.bytes(2)).to.deep.equal(new Uint8Array([10, 20]));
			expect(reader.bytes(3)).to.deep.equal(new Uint8Array([30, 40, 50]));
		});

		it('advances the offset by the number of bytes read', function () {
			const reader = new Reader(new Uint8Array([10, 20, 30, 40, 50]));
			expect(reader.offset).to.equal(0);
			expect(reader.bytes(3)).to.deep.equal(new Uint8Array([10, 20, 30]));
			expect(reader.offset).to.equal(3);
		});

		it('throws when reading out of bounds', function () {
			const reader = new Reader(new Uint8Array([10, 20, 30, 40, 50]));
			expect(reader.bytes(3)).to.deep.equal(new Uint8Array([10, 20, 30]));
			expect(() => reader.bytes(3)).to.throw(RangeError);
			expect(() => reader.bytes(3)).to.throw(RangeError);
			expect(reader.bytes(2)).to.deep.equal(new Uint8Array([40, 50]));
		});

		it('always copies the data to a different Uint8Array', function () {
			const reader = new Reader(new Uint8Array([10, 20, 30, 40, 50]));
			const input = reader.input;
			const output = reader.bytes(5);
			expect(output).to.deep.equal(new Uint8Array([10, 20, 30, 40, 50]));
			expect(output).to.not.equal(input);
			expect(output.buffer).to.not.equal(input.buffer);
		});
	});

	describe('string()', function () {
		it('reads a UTF-8 string after its byte length as a dynamic integer', function () {
			const reader = new Reader(new Writer().string('').string('hello\xf8!').string('a'.repeat(254)).done());
			expect(reader.string()).to.equal('');
			expect(reader.string()).to.equal('hello\xf8!');
			expect(reader.string()).to.equal('a'.repeat(254));
		});

		it('advances the offset by the number of bytes read', function () {
			const reader = new Reader(new Writer().string('').string('hello\xf8!').string('a'.repeat(254)).done());
			expect(reader.offset).to.equal(0);
			expect(reader.string()).to.equal('');
			expect(reader.offset).to.equal(1);
			expect(reader.string()).to.equal('hello\xf8!');
			expect(reader.offset).to.equal(10);
			expect(reader.string()).to.equal('a'.repeat(254));
			expect(reader.offset).to.equal(267);
		});

		it('throws when reading out of bounds', function () {
			const reader = new Reader(new Writer().dynamicInteger(2).uint8(40).done());
			expect(() => reader.string()).to.throw(RangeError);
		});
	});

	describe('dynamicIntegerArray()', function () {
		it('reads an array length as a dynamic integer, then N dynamic integers', function () {
			let reader = new Reader(new Writer().dynamicIntegerArray([1, 254, 65536]).done());
			expect(reader.dynamicIntegerArray()).to.deep.equal([1, 254, 65536]);
			reader = new Reader(new Writer().dynamicIntegerArray(new Array(300).fill(300)).done());
			expect(reader.dynamicIntegerArray()).to.deep.equal(new Array(300).fill(300));
		});

		it('advances the offset by the number of bytes read', function () {
			const reader = new Reader(new Writer().dynamicIntegerArray([1, 254, 65536]).done());
			expect(reader.offset).to.equal(0);
			expect(reader.dynamicIntegerArray()).to.deep.equal([1, 254, 65536]);
			expect(reader.offset).to.equal(10);
		});

		it('throws when reading out of bounds', function () {
			let reader = new Reader(new Writer().dynamicInteger(2).uint8(40).done());
			expect(() => reader.dynamicIntegerArray()).to.throw(RangeError);
			reader = new Reader(new Writer().dynamicInteger(2).uint8(40).uint8(254).done());
			expect(() => reader.dynamicIntegerArray()).to.throw(RangeError);
			reader = new Reader(new Writer().dynamicInteger(1).uint8(254).uint8(15).done());
			expect(() => reader.dynamicIntegerArray()).to.throw(RangeError);
		});
	});
});
