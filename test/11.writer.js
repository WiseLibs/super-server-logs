'use strict';
const Writer = require('../src/nodejs/writer');

describe('Writer', function () {
	describe('uint8()', function () {
		it('writes an unsigned 8-bit integer', function () {
			expect(new Writer().uint8(15).done())
				.to.deep.equal(new Uint8Array([15]));
			expect(new Writer().uint8(0).uint8(150).done())
				.to.deep.equal(new Uint8Array([0, 150]));
		});

		it('wraps the input integer if out of bounds', function () {
			expect(new Writer().uint8(300).uint8(-20).done())
				.to.deep.equal(new Uint8Array([44, 236]));
		});
	});

	describe('uint16()', function () {
		it('writes an unsigned 16-bit integer', function () {
			expect(new Writer().uint16(15).done())
				.to.deep.equal(new Uint8Array([0, 15]));
			expect(new Writer().uint16(0).uint16(700).done())
				.to.deep.equal(new Uint8Array([0, 0, 2, 188]));
		});

		it('wraps the input integer if out of bounds', function () {
			expect(new Writer().uint16(2039583).uint16(-20).done())
				.to.deep.equal(new Uint8Array([31, 7967, 255, 236]));
		});
	});

	describe('uint32()', function () {
		it('writes an unsigned 32-bit integer', function () {
			expect(new Writer().uint32(15).done())
				.to.deep.equal(new Uint8Array([0, 0, 0, 15]));
			expect(new Writer().uint32(0).uint32(1245165).done())
				.to.deep.equal(new Uint8Array([0, 0, 0, 0, 0, 18, 255, 237]));
		});

		it('wraps the input integer if out of bounds', function () {
			expect(new Writer().uint32(4297861037).uint32(-20).done())
				.to.deep.equal(new Uint8Array([0, 44, 39, 173, 255, 255, 255, 236]));
		});

		it('works for integers that use all 32 bits', function () {
			expect(new Writer().uint32(0xffffffff).done())
				.to.deep.equal(new Uint8Array([255, 255, 255, 255]));
		});
	});

	describe('uint48()', function () {
		it('writes an unsigned 48-bit integer', function () {
			expect(new Writer().uint48(15).done())
				.to.deep.equal(new Uint8Array([0, 0, 0, 0, 0, 15]));
			expect(new Writer().uint48(0).uint48(4298814828).done())
				.to.deep.equal(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1, 0, 58, 181, 108]));
		});

		it('wraps the input integer if out of bounds', function () {
			expect(new Writer().uint48(288817600127354).uint48(-20).done())
				.to.deep.equal(new Uint8Array([6, 173, 150, 117, 225, 122, 0, 0, 0, 0, 255, 236]));
		});

		it('works for integers that use all 48 bits', function () {
			expect(new Writer().uint48(0xffffffffffff).done())
				.to.deep.equal(new Uint8Array([255, 255, 255, 255, 255, 255]));
		});
	});

	describe('dynamicInteger()', function () {
		it('writes a dynamic unsigned integer in 1 byte if value <= 253', function () {
			expect(new Writer().dynamicInteger(15).done())
				.to.deep.equal(new Uint8Array([15]));
			expect(new Writer().dynamicInteger(0).dynamicInteger(253).done())
				.to.deep.equal(new Uint8Array([0, 253]));
		});

		it('writes a dynamic unsigned integer in 3 bytes if value <= 65535', function () {
			expect(new Writer().dynamicInteger(254).dynamicInteger(65535).done())
				.to.deep.equal(new Uint8Array([0xfe, 0, 254, 0xfe, 0xff, 0xff]));
		});

		it('writes a dynamic unsigned integer in 5 bytes if value <= 4294967295', function () {
			expect(new Writer().dynamicInteger(65536).dynamicInteger(4294967295).done())
				.to.deep.equal(new Uint8Array([0xff, 0, 1, 0, 0, 0xff, 0xff, 0xff, 0xff, 0xff]));
		});

		it('wraps the input integer if out of bounds', function () {
			expect(new Writer().dynamicInteger(4297861037).dynamicInteger(-20).done())
				.to.deep.equal(new Uint8Array([0xff, 0, 44, 39, 173, 0xff, 255, 255, 255, 236]));
		});

		it('works for integers that use all 32 bits', function () {
			expect(new Writer().dynamicInteger(0xffffffff).done())
				.to.deep.equal(new Uint8Array([0xff, 255, 255, 255, 255]));
		});
	});

	describe('bytes()', function () {
		it('writes an arbitrary number of raw bytes', function () {
			expect(new Writer().bytes(new Uint8Array([15, 30])).done())
				.to.deep.equal(new Uint8Array([15, 30]));
			expect(new Writer().bytes(new Uint8Array()).bytes(new Uint8Array([15, 30])).bytes(new Uint8Array([45])).done())
				.to.deep.equal(new Uint8Array([15, 30, 45]));
		});
	});

	describe('string()', function () {
		it('writes a UTF-8 string after its byte length as a dynamic integer', function () {
			expect(new Writer().string('hello\xf8!').done())
				.to.deep.equal(new Uint8Array([8, 104, 101, 108, 108, 111, 195, 184, 33]));
			expect(new Writer().string('').string('a'.repeat(254)).done())
				.to.deep.equal(new Uint8Array([0, 0xfe, 0, 254, ...new Array(254).fill(97)]));
		});
	});

	describe('json()', function () {
		it('writes a string containing serialized JSON', function () {
			expect(new Writer().json('').done())
				.to.deep.equal(new Uint8Array([2, 34, 34]));
			expect(new Writer().json(null).done())
				.to.deep.equal(new Uint8Array([4, 110, 117, 108, 108]));
			expect(new Writer().json({ foo: 123 }).done())
				.to.deep.equal(new Uint8Array([11, 123, 34, 102, 111, 111, 34, 58, 49, 50, 51, 125]));
			expect(new Writer().json('').json('a'.repeat(252)).done())
				.to.deep.equal(new Uint8Array([2, 34, 34, 0xfe, 0, 254, 34, ...new Array(252).fill(97), 34]));
		});

		it('throws if no JSON can be serialized', function () {
			expect(() => new Writer().json().done()).to.throw(TypeError);
			expect(() => new Writer().json(Symbol()).done()).to.throw(TypeError);
			expect(() => new Writer().json(() => {}).done()).to.throw(TypeError);
		});

		it('does not serialize any Buffer, ArrayBuffer, or ArrayBuffer view', function () {
			expect(() => new Writer().json(Buffer.from('hello')).done()).to.throw(TypeError);
			expect(() => new Writer().json(new ArrayBuffer(5)).done()).to.throw(TypeError);
			expect(() => new Writer().json(new Uint8Array([1, 2, 3])).done()).to.throw(TypeError);
			expect(new Writer().json({ a: 0, foo: Buffer.from('hello') }).done())
				.to.deep.equal(new Uint8Array([7, 123, 34, 97, 34, 58, 48, 125]));
			expect(new Writer().json({ a: 0, foo: new ArrayBuffer(5) }).done())
				.to.deep.equal(new Uint8Array([7, 123, 34, 97, 34, 58, 48, 125]));
			expect(new Writer().json({ a: 0, foo: new Uint8Array([1, 2, 3]) }).done())
				.to.deep.equal(new Uint8Array([7, 123, 34, 97, 34, 58, 48, 125]));
		});
	});

	describe('dynamicIntegerArray()', function () {
		it('writes an array length as a dynamic integer, then N dynamic integers', function () {
			expect(new Writer().dynamicIntegerArray([253]).dynamicIntegerArray([254, 15]).done())
				.to.deep.equal(new Uint8Array([1, 253, 2, 0xfe, 0, 254, 15]));
			expect(new Writer().dynamicIntegerArray(new Array(300).fill(300)).done())
				.to.deep.equal(new Uint8Array(new Array(301).fill(0).flatMap(() => [0xfe, 1, 44])));
		});

		it('wraps the input integers if out of bounds', function () {
			expect(new Writer().dynamicIntegerArray([4297861037, -20]).done())
				.to.deep.equal(new Uint8Array([2, 0xff, 0, 44, 39, 173, 0xff, 255, 255, 255, 236]));
		});
	});
});
