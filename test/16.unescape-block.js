'use strict';
const { ESCAPE, SEPARATOR, ESCAPE_CODE_ESCAPE, ESCAPE_CODE_SEPARATOR, ESCAPE_CODE_SLICEMARKER } = require('../src/shared/common');
const { escapeBlock, unescapeBlock } = require('../src/shared/common');

describe('unescapeBlock()', function () {
	it('unescapes all escape characters', function () {
		expect(unescapeBlock(new Uint8Array([10, 20, ESCAPE, ESCAPE_CODE_ESCAPE, 30, ESCAPE, ESCAPE_CODE_ESCAPE, ESCAPE, ESCAPE_CODE_ESCAPE])))
			.to.deep.equal(new Uint8Array([10, 20, ESCAPE, 30, ESCAPE, ESCAPE]));
	});

	it('unescapes all separator characters', function () {
		expect(unescapeBlock(new Uint8Array([10, 20, ESCAPE, ESCAPE_CODE_SEPARATOR, 30, ESCAPE, ESCAPE_CODE_SEPARATOR, ESCAPE, ESCAPE_CODE_SEPARATOR])))
			.to.deep.equal(new Uint8Array([10, 20, SEPARATOR, 30, SEPARATOR, SEPARATOR]));
	});

	it('unescapes mixes of escape characters and separator characters', function () {
		expect(unescapeBlock(new Uint8Array([10, 20, ESCAPE, ESCAPE_CODE_ESCAPE, 30, ESCAPE, ESCAPE_CODE_SEPARATOR, ESCAPE, ESCAPE_CODE_ESCAPE])))
			.to.deep.equal(new Uint8Array([10, 20, ESCAPE, 30, SEPARATOR, ESCAPE]));
	});

	it('ignores leading slice markers', function () {
		expect(unescapeBlock(new Uint8Array([ESCAPE, ESCAPE_CODE_SLICEMARKER, 10, 20, ESCAPE, ESCAPE_CODE_ESCAPE, 30, ESCAPE, ESCAPE_CODE_SEPARATOR, ESCAPE, ESCAPE_CODE_ESCAPE])))
			.to.deep.equal(new Uint8Array([10, 20, ESCAPE, 30, SEPARATOR, ESCAPE]));
	});

	it('ignores any data before a slice marker', function () {
		expect(unescapeBlock(new Uint8Array([10, 20, ESCAPE, ESCAPE_CODE_ESCAPE, ESCAPE, ESCAPE_CODE_SLICEMARKER, 30, ESCAPE, ESCAPE_CODE_SEPARATOR, ESCAPE, ESCAPE_CODE_ESCAPE])))
			.to.deep.equal(new Uint8Array([30, SEPARATOR, ESCAPE]));
	});

	it('ignores any data before the final slice marker', function () {
		expect(unescapeBlock(new Uint8Array([10, 20, ESCAPE, ESCAPE_CODE_ESCAPE, ESCAPE, ESCAPE_CODE_SLICEMARKER, 30, ESCAPE, ESCAPE_CODE_SEPARATOR, ESCAPE, ESCAPE_CODE_SLICEMARKER, ESCAPE, ESCAPE_CODE_ESCAPE])))
			.to.deep.equal(new Uint8Array([ESCAPE]));
	});

	it('undoes the effect of escapeBlock()', function () {
		const everyByte = new Array(256).fill(0).map((_, i) => i);
		expect(unescapeBlock(escapeBlock(new Uint8Array(everyByte))))
			.to.deep.equal(new Uint8Array(everyByte));
	});
});
