'use strict';
require('..');
const os = require('os');
const fs = require('fs');
const path = require('path');
const chai = require('chai');

const isWindows = os.platform().startsWith('win');
const TEMP_DIR = path.join(__dirname, '..', 'temp');
let nextId = 0;

global.expect = chai.expect;
global.util = {
	current: () => path.join(TEMP_DIR, `temp-${nextId}`),
	next: () => (++nextId, global.util.current()),
	itUnix: isWindows ? it.skip : it,
};

before(function () {
	fs.rmSync(TEMP_DIR, { recursive: true, force: true, maxRetries: 10 });
	fs.mkdirSync(TEMP_DIR, { recursive: true });
});

after(function () {
	fs.rmSync(TEMP_DIR, { recursive: true, maxRetries: 10 });
});
