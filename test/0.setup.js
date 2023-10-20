'use strict';
require('..');
const fs = require('fs');
const path = require('path');
const chai = require('chai');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
let nextId = 0;

global.expect = chai.expect;
global.util = {
	current: () => path.join(TEMP_DIR, `temp-${nextId}`),
	next: () => (++nextId, global.util.current()),
};

before(function () {
	fs.rmSync(TEMP_DIR, { recursive: true, force: true, maxRetries: 10 });
	fs.mkdirSync(TEMP_DIR, { recursive: true });
});

after(function () {
	fs.rmSync(TEMP_DIR, { recursive: true, maxRetries: 10 });
});
