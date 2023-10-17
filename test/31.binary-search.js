'use strict';
const binarySearch = require('../src/shared/binary-search');

describe('binarySearch()', function () {
	it('returns the approximate byte offset of the given log timestamp');
	it('returns a reasonable byte offset if the timestamp does not exist');
	it('supports pages that have no separators');
	it('supports pages that only have one separator');
	it('supports pages whose only block starts many pages ago');
});
