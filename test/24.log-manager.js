'use strict';
const fs = require('fs');
const { LogManager, MasterLogger } = require('..');

describe('LogManager', function () {
	let manager;
	let logger;
	let interval;

	afterEach(function () {
		manager?.close();
		logger?.close();
		clearInterval(interval);
	});

	describe('event "rotate"', function () {
		it('is emitted when the latest log file is too big', async function () {
			this.slow(5000);
			manager = new LogManager(util.next(), { logSizeLimit: 1024 * 1024 * 3, granularity: 3, pollInterval: 25 });
			logger = new MasterLogger(manager.filename, { outputDelay: 20, compression: false });
			expect(manager.dirname).to.equal(util.current());
			const originalFilename = manager.filename;
			const event1 = await new Promise((resolve, reject) => {
				manager.once('error', reject);
				manager.once('rotate', resolve);
				const data = 'foobarbaz!'.repeat(1024);
				const write = () => logger.info(data);
				interval = setInterval(write, 5);
			});
			expect(event1).to.be.a('string');
			expect(event1).to.equal(manager.filename);
			expect(event1).to.not.equal(originalFilename);
			clearInterval(interval);
			logger.rotate(manager.filename);
			const event2 = await new Promise((resolve, reject) => {
				manager.once('error', reject);
				manager.once('rotate', resolve);
				const data = 'foobarbaz!'.repeat(1024);
				const write = () => logger.info(data);
				interval = setInterval(write, 5);
			});
			expect(event2).to.be.a('string');
			expect(event2).to.equal(manager.filename);
			expect(event2).to.not.equal(originalFilename);
			expect(event2).to.not.equal(event1);
			expect(manager.dirname).to.equal(util.current());
		});

		it('is emitted when the latest log file is too old', async function () {
			this.slow(5000);
			manager = new LogManager(util.next(), { logAgeLimit: 60000, granularity: 60, pollInterval: 25 });
			logger = new MasterLogger(manager.filename, { outputDelay: 20, compression: false });
			expect(manager.dirname).to.equal(util.current());
			const originalFilename = manager.filename;
			const event1 = await new Promise((resolve, reject) => {
				manager.once('error', reject);
				manager.once('rotate', resolve);
			});
			expect(event1).to.be.a('string');
			expect(event1).to.equal(manager.filename);
			expect(event1).to.not.equal(originalFilename);
			logger.rotate(manager.filename);
			const event2 = await new Promise((resolve, reject) => {
				manager.once('error', reject);
				manager.once('rotate', resolve);
			});
			expect(event2).to.be.a('string');
			expect(event2).to.equal(manager.filename);
			expect(event2).to.not.equal(originalFilename);
			expect(event2).to.not.equal(event1);
			expect(manager.dirname).to.equal(util.current());
		});

		it('causes old files to be deleted', async function () {
			this.slow(5000);
			manager = new LogManager(util.next(), { logSizeLimit: 1024 * 1024 * 3, granularity: 3, pollInterval: 25 });
			logger = new MasterLogger(manager.filename, { outputDelay: 20, compression: false });
			const filenames = [manager.filename];
			for (let i = 0; i < 4; ++i) {
				await new Promise((resolve, reject) => {
					manager.once('error', reject);
					manager.once('rotate', resolve);
					const data = 'foobarbaz!'.repeat(1024 * 2);
					const write = () => logger.info(data);
					interval = setInterval(write, 5);
				});
				filenames.push(manager.filename);
				logger.rotate(manager.filename);
				clearInterval(interval);
			}
			await new Promise(r => setTimeout(r, 200));
			expect(filenames).to.have.lengthOf(5);
			expect(fs.existsSync(filenames[0])).to.be.false;
			expect(fs.existsSync(filenames[1])).to.be.false;
			expect(fs.existsSync(filenames[2])).to.be.true;
			expect(fs.existsSync(filenames[3])).to.be.true;
			expect(fs.existsSync(filenames[4])).to.be.true;
			const totalSize = fs.statSync(filenames[2]).size + fs.statSync(filenames[3]).size + fs.statSync(filenames[4]).size;
			expect(totalSize).to.be.below(1024 * 1024 * 3);
		});
	});

	describe('event "error"', function () {
		it('is emitted if fs.stat() fails', async function () {
			this.slow(5000);
			try {
				manager = new LogManager(util.next(), { pollInterval: 25 });
				fs.writeFileSync(manager.filename, '');
				fs.chmodSync(util.current(), 0o222);
				const event = await new Promise((resolve, reject) => {
					manager.once('error', resolve);
					manager.once('rotate', () => reject(new Error('Unexpected "rotate" event')));
				});
				expect(event).to.be.an.instanceof(Error);
				expect(event.syscall).to.equal('stat');
				expect(event.code).to.equal('EACCES');
			} finally {
				fs.chmodSync(util.current(), 0o777);
			}
		});

		it('is emitted if fs.readdir() fails', async function () {
			this.slow(5000);
			manager = new LogManager(util.next(), { logAgeLimit: 60000, granularity: 60, pollInterval: 25 });
			fs.rmdirSync(util.current());
			const event = await new Promise((resolve) => {
				manager.once('error', resolve);
			});
			expect(event).to.be.an.instanceof(Error);
			expect(event.syscall).to.equal('scandir');
			expect(event.code).to.equal('ENOENT');
		});
	});

	describe('close()', function () {
		it('closes the log manager', async function () {
			manager = new LogManager(util.next());
			expect(manager.closed).to.be.false;
			expect(manager.close()).to.equal(manager);
			expect(manager.closed).to.be.true;
		});
	});

	describe('constructor', function () {
		it('throws if the given dirname is not a string or null', async function () {
			expect(() => new LogManager()).to.throw(TypeError);
			expect(() => new LogManager(123)).to.throw(TypeError);
			expect(() => new LogManager(['foo'])).to.throw(TypeError);
			expect(() => new LogManager({ valueOf: () => util.next() })).to.throw(TypeError);
			expect(() => new LogManager(new String(util.next()))).to.throw(TypeError);
		});

		it('creates the given directory if it does not exist', async function () {
			expect(fs.existsSync(util.next())).to.be.false;
			manager = new LogManager(util.current());
			expect(fs.existsSync(util.current())).to.be.true;
			expect(fs.statSync(util.current()).isDirectory()).to.be.true;
		});

		it('ensures the created directory has unix permissions 0o700', async function () {
			expect(fs.existsSync(util.next())).to.be.false;
			manager = new LogManager(util.current());
			expect(fs.existsSync(util.current())).to.be.true;
			expect(fs.statSync(util.current()).mode & 0o777).to.equal(0o700);
		});

		it('does not modify the permissions of the directory if it already exists', async function () {
			fs.mkdirSync(util.next(), { mode: 0o711 });
			manager = new LogManager(util.current());
			expect(fs.existsSync(util.current())).to.be.true;
			expect(fs.statSync(util.current()).mode & 0o777).to.equal(0o711);
		});

		describe('options.pollInterval', function () {
			it('throws if not a positive integer', async function () {
				expect(() => new LogManager(util.next(), { pollInterval: null })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { pollInterval: '1024' })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { pollInterval: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { pollInterval: BigInt(1024) })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { pollInterval: 1024.5 })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { pollInterval: -1024 })).to.throw(RangeError);
				expect(() => new LogManager(util.next(), { pollInterval: -1 })).to.throw(RangeError);
				expect(() => new LogManager(util.next(), { pollInterval: 0 })).to.throw(RangeError);
			});

			it('throws if greater than 2147483647', async function () {
				expect(() => new LogManager(util.next(), { pollInterval: 2147483648 })).to.throw(RangeError);
			});
		});

		describe('options.logSizeLimit', function () {
			it('throws if not a positive integer', async function () {
				expect(() => new LogManager(util.next(), { logSizeLimit: null })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { logSizeLimit: '1024' })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { logSizeLimit: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { logSizeLimit: BigInt(1024) })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { logSizeLimit: 1024.5 })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { logSizeLimit: -1024 })).to.throw(RangeError);
				expect(() => new LogManager(util.next(), { logSizeLimit: -1 })).to.throw(RangeError);
				expect(() => new LogManager(util.next(), { logSizeLimit: 0 })).to.throw(RangeError);
			});

			it('throws if less than 1048576 (1 MiB)', async function () {
				expect(() => new LogManager(util.next(), { logSizeLimit: 1048575 })).to.throw(RangeError);
			});
		});

		describe('options.logAgeLimit', function () {
			it('throws if not a positive integer', async function () {
				expect(() => new LogManager(util.next(), { logAgeLimit: null })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { logAgeLimit: '1024' })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { logAgeLimit: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { logAgeLimit: BigInt(1024) })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { logAgeLimit: 1024.5 })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { logAgeLimit: -1024 })).to.throw(RangeError);
				expect(() => new LogManager(util.next(), { logAgeLimit: -1 })).to.throw(RangeError);
				expect(() => new LogManager(util.next(), { logAgeLimit: 0 })).to.throw(RangeError);
			});

			it('throws if less than 60000 (1 minute)', async function () {
				expect(() => new LogManager(util.next(), { logAgeLimit: 59999 })).to.throw(RangeError);
			});
		});

		describe('options.granularity', function () {
			it('throws if not a positive integer', async function () {
				expect(() => new LogManager(util.next(), { granularity: null })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { granularity: '1024' })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { granularity: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { granularity: BigInt(1024) })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { granularity: 1024.5 })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { granularity: -1024 })).to.throw(RangeError);
				expect(() => new LogManager(util.next(), { granularity: -1 })).to.throw(RangeError);
				expect(() => new LogManager(util.next(), { granularity: 0 })).to.throw(RangeError);
			});

			it('throws if less than 2', async function () {
				expect(() => new LogManager(util.next(), { granularity: 1.9 })).to.throw(TypeError);
				expect(() => new LogManager(util.next(), { granularity: 1 })).to.throw(RangeError);
			});

			it('throws if logAgeLimit / granularity is less than 1000 (1 second)', async function () {
				expect(() => new LogManager(util.next(), { logAgeLimit: 60000, granularity: 61 })).to.throw(RangeError);
				expect(() => new LogManager(util.next(), { logAgeLimit: 3600000, granularity: 3601 })).to.throw(RangeError);
			});
		});
	});

	describe('disabled logging mode (null dirname)', function () {
		specify('dirname is null', async function () {
			manager = new LogManager(null);
			expect(manager.dirname).to.be.null;
		});

		specify('filename is null', async function () {
			manager = new LogManager(null);
			expect(manager.filename).to.be.null;
		});

		specify('closed is true', async function () {
			manager = new LogManager(null);
			expect(manager.closed).to.be.true;
		});

		specify('no directory is created', async function () {
			manager = new LogManager(null);
			expect(fs.existsSync('null')).to.be.false;
		});

		specify('"rotate" events are not emitted', async function () {
			this.slow(5000);
			manager = new LogManager(null, { logSizeLimit: 1024 * 1024 * 3, granularity: 3, pollInterval: 25 });
			expect(manager.filename).to.be.null;
			await new Promise((resolve, reject) => {
				manager.once('error', reject);
				manager.once('rotate', () => reject(new Error('Unexpected "rotate" event')));
				setTimeout(resolve, 2000);
			});
			expect(manager.filename).to.be.null;
		});
	});
});
