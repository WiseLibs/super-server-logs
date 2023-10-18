'use strict';
const { ESCAPE, SEPARATOR, ESCAPE_CODE_ESCAPE, ESCAPE_CODE_SEPARATOR } = require('../src/shared/common');
const { escapeBlock } = require('../src/nodejs/common');

describe('escapeBlock()', function () {
	it('escapes all escape characters', function () {
		expect(escapeBlock(new Uint8Array([10, 20, ESCAPE, 30, ESCAPE, ESCAPE])))
			.to.deep.equal(new Uint8Array([10, 20, ESCAPE, ESCAPE_CODE_ESCAPE, 30, ESCAPE, ESCAPE_CODE_ESCAPE, ESCAPE, ESCAPE_CODE_ESCAPE]));
	});

	it('escapes all separator characters', function () {
		expect(escapeBlock(new Uint8Array([10, 20, SEPARATOR, 30, SEPARATOR, SEPARATOR])))
			.to.deep.equal(new Uint8Array([10, 20, ESCAPE, ESCAPE_CODE_SEPARATOR, 30, ESCAPE, ESCAPE_CODE_SEPARATOR, ESCAPE, ESCAPE_CODE_SEPARATOR]));
	});

	it('escapes mixes of escape characters and separator characters', function () {
		expect(escapeBlock(new Uint8Array([10, 20, ESCAPE, 30, SEPARATOR, ESCAPE])))
			.to.deep.equal(new Uint8Array([10, 20, ESCAPE, ESCAPE_CODE_ESCAPE, 30, ESCAPE, ESCAPE_CODE_SEPARATOR, ESCAPE, ESCAPE_CODE_ESCAPE]));
	});

	it('should result in a block that does not contain separators', function () {
		expect([...escapeBlock(new Uint8Array([10, 20, ESCAPE, 30, SEPARATOR, ESCAPE]))])
			.to.not.include(SEPARATOR);
	});
});
