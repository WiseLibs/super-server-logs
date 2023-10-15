'use strict';
const LimitQueue = require('../src/nodejs/limit-queue');

describe('LimitQueue', function () {
	it('allows pushing and shifting values in FIFO order');
	it('allows draining all values in FIFO order');
	it('automatically deletes values beyond the maxSize in FIFO order');
});
