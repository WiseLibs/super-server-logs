'use strict';
const Scanner = require('../src/shared/scanner');

describe('Scanner', function () {
	it('can scan forward from the beginning (offset === 0)');
	it('can scan forward from the end (offset === totalSize)');
	it('can scan backward from the end (offset === totalSize)');
	it('can scan backward from the beginning (offset === 0)');
	it('can jump to a given byte offset and scan forward');
	it('can jump to a given byte offset and scan backward');
	it('can reverse the scan direction at any time');
	it('can reverse the scan direction at the beginning');
	it('can reverse the scan direction at the end (with a complete block)');
	it('can reverse the scan direction at the end (with an incomplete block)');
	it('can reverse the scan direction multiple times within a block');
	it('can reverse the scan direction while the position is in a forward tail');
	it('can reverse the scan direction while the position is in a backward tail');
	it('can jump to the middle of the last block, scan forward, then backward');
	it('can update the Vfs size when not on the last page');
	it('can update the Vfs size after scanning to the last page');
});
