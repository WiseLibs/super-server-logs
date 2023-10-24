'use strict';
const fs = require('fs/promises');
const path = require('path');
const { LogDirectorySource, MasterLogger, Vfs } = require('..');
const { toLogBasename } = require('../src/nodejs/common');
const { SEPARATOR } = require('../src/shared/common');
const EventTypes = require('../src/shared/event-types');

describe('LogDirectorySource', function () {
	this.slow(500);
	let context;
	let vfs;

	beforeEach(function () {
		context = createContext(util.next());
	});

	afterEach(async function () {
		if (vfs && !vfs.closed) {
			await vfs.teardown();
		}
	});

	describe('read()', function () {
		it('returns data from the log directory', async function () {
			vfs = await createVfs(context);
			const result = await vfs.read(0, 500);
			expect(result).to.be.an.instanceof(Uint8Array);
			expect(result).to.have.lengthOf(500);
			expect(result[0]).to.equal(EventTypes.STARTING_UP);
		});

		it('can return data that spans multiple files', async function () {
			vfs = await createVfs(context);
			expect(context.filenames.length).to.be.above(9);
			const result = await vfs.read(1024 * 200, 1024 * 500);
			expect(result).to.be.an.instanceof(Uint8Array);
			expect(result).to.have.lengthOf(1024 * 500);
			expect(result[0]).to.not.equal(EventTypes.STARTING_UP);
			expect(result.lastIndexOf(SEPARATOR)).to.be.above(1024 * 450);
		});

		util.itUnix('can return data from files that were deleted/unlinked', async function () {
			vfs = await createVfs(context);
			await fs.rm(context.dirname, { recursive: true });
			const result = await vfs.read(1024 * 200, 1024 * 500);
			expect(result).to.be.an.instanceof(Uint8Array);
			expect(result).to.have.lengthOf(1024 * 500);
			expect(result[0]).to.not.equal(EventTypes.STARTING_UP);
			expect(result.lastIndexOf(SEPARATOR)).to.be.above(1024 * 450);
		});

		it('if there\'s not enough data, returns as much data as possible', async function () {
			vfs = await createVfs(context);
			const result = await vfs.read(1024 * 900, 1024 * 200);
			expect(result).to.be.an.instanceof(Uint8Array);
			expect(result).to.have.lengthOf(await vfs.size() - 1024 * 900);
			expect(result[0]).to.not.equal(EventTypes.STARTING_UP);
			expect(result.lastIndexOf(SEPARATOR)).to.be.above(1024 * 100);
		});

		it('does not read new data that has not yet been detected via polling', async function () {
			vfs = await createVfs(context);
			const result1 = await vfs.read(1024 * 900, 1024 * 200);
			expect(result1).to.be.an.instanceof(Uint8Array);
			expect(result1.byteLength).to.be.below(1024 * 200);
			expect(result1[0]).to.not.equal(EventTypes.STARTING_UP);
			expect(result1.lastIndexOf(SEPARATOR)).to.be.above(1024 * 100);
			await writeLogs(context, 500);
			const result2 = await vfs.read(1024 * 900, 1024 * 200);
			expect(result2).to.deep.equal(result1);
		});

		it('does not read data from files that are being rotated to', async function () {
			vfs = await createVfs(context, { pollInterval: 1 });
			await inContext(context, (logger) => {
				const data = 'helloworld'.repeat(50);
				logger.WORKER_SPAWNED(27);
				for (let count = 0; count < 2; ++count) {
					context.rotate(logger);
					for (let i = 0; i < 100; ++i) {
						context.log(logger, data);
						if (i % 2 === 0) {
							context.flush(logger);
						}
					}
				}
			});
			await new Promise(r => setTimeout(r, 2));
			const result1 = await vfs.read(1024 * 900, 1024 * 900);
			expect(result1).to.be.an.instanceof(Uint8Array);
			expect(result1.byteLength).to.be.below(1024 * 200);
			expect(result1[0]).to.not.equal(EventTypes.STARTING_UP);
			expect(result1.lastIndexOf(SEPARATOR)).to.be.above(1024 * 100);
			expect(Buffer.from(result1).includes('helloworld')).to.be.false;
			await inContext(context, (logger) => {
				logger.WORKER_EXITED(27, 0);
			});
			await new Promise(r => setTimeout(r, 2));
			const result2 = await vfs.read(1024 * 900, 1024 * 900);
			expect(result2).to.be.an.instanceof(Uint8Array);
			expect(result2.byteLength).to.be.above(1024 * 200);
			expect(result2[0]).to.not.equal(EventTypes.STARTING_UP);
			expect(result2.lastIndexOf(SEPARATOR)).to.be.above(1024 * 200);
			expect(Buffer.from(result2).includes('helloworld')).to.be.true;
		});

		it('if immutable, does read data from files that are being rotated to', async function () {
			vfs = await createVfs(context, { pollInterval: 1, immutable: true });
			await inContext(context, (logger) => {
				const data = 'helloworld'.repeat(50);
				logger.WORKER_SPAWNED(27);
				for (let count = 0; count < 2; ++count) {
					context.rotate(logger);
					for (let i = 0; i < 100; ++i) {
						context.log(logger, data);
						if (i % 2 === 0) {
							context.flush(logger);
						}
					}
				}
			});
			await new Promise(r => setTimeout(r, 2));
			const result = await vfs.read(1024 * 900, 1024 * 900);
			expect(result).to.be.an.instanceof(Uint8Array);
			expect(result.byteLength).to.be.above(1024 * 200);
			expect(result[0]).to.not.equal(EventTypes.STARTING_UP);
			expect(result.lastIndexOf(SEPARATOR)).to.be.above(1024 * 200);
			expect(Buffer.from(result).includes('helloworld')).to.be.true;
		});

		util.itUnix('if lazy, throws when opening a file that was deleted/unlinked', async function () {
			vfs = await createVfs(context, { lazy: true, cacheSize: 0 });
			await fs.unlink(context.filenames[0]);
			await expectToThrow(vfs.read(0, 500), Error, /\bENOENT\b/);
			await vfs.read(1024 * 200, 1024 * 500);
			await vfs.read(1024 * 900, 500);
			await fs.rm(context.dirname, { recursive: true });
			await expectToThrow(vfs.read(1024 * 200, 1024 * 500), Error, /\bENOENT\b/);
		});

		it('if polling, periodically detects new data within the current log file', async function () {
			vfs = await createVfs(context, { pollInterval: 50 });
			const result1 = await vfs.read(1024 * 900, 1024 * 200);
			expect(result1).to.be.an.instanceof(Uint8Array);
			expect(result1.byteLength).to.be.below(1024 * 200);
			expect(result1[0]).to.not.equal(EventTypes.STARTING_UP);
			expect(result1.lastIndexOf(SEPARATOR)).to.be.above(1024 * 100);
			await writeLogs(context, 500);
			await new Promise(r => setTimeout(r, 51));
			const result2 = await vfs.read(1024 * 900, 1024 * 200);
			expect(result2.byteLength).to.be.above(result1.byteLength + 500 * 50);
		});

		it('if polling, periodically detects new log files', async function () {
			vfs = await createVfs(context, { pollInterval: 50 });
			const result1 = await vfs.read(1024 * 900, 1024 * 200);
			expect(result1).to.be.an.instanceof(Uint8Array);
			expect(result1.byteLength).to.be.below(1024 * 200);
			expect(result1[0]).to.not.equal(EventTypes.STARTING_UP);
			expect(result1.lastIndexOf(SEPARATOR)).to.be.above(1024 * 100);
			await inContext(context, (logger) => {
				const data = 'helloworld'.repeat(50);
				context.rotate(logger);
				for (let i = 0; i < 100; ++i) {
					context.log(logger, data);
					if (i % 2 === 0) {
						context.flush(logger);
					}
				}
			});
			await new Promise(r => setTimeout(r, 51));
			const result2 = await vfs.read(1024 * 900, 1024 * 200);
			expect(result2.byteLength).to.be.above(result1.byteLength + 500 * 100);
			expect(Buffer.from(result2).includes('helloworld')).to.be.true;
		});

		util.itUnix('saves data to cache', async function () {
			vfs = await createVfs(context, { lazy: true });
			await vfs.read(1024 * 200, 1024 * 500);
			await vfs.read(1024 * 900, 500);
			await fs.rm(context.dirname, { recursive: true });
			await vfs.read(1024 * 200, 1024 * 500);
		});
	});

	describe('size()', function () {
		it('returns the total byte size of all logs', async function () {
			vfs = await createVfs(context);
			const result = await vfs.read(0, 9999999);
			expect(result).to.be.an.instanceof(Uint8Array);
			expect(result[0]).to.equal(EventTypes.STARTING_UP);
			expect(await vfs.size()).to.equal(result.byteLength);
		});

		it('does not count new data that has not yet been detected via polling', async function () {
			vfs = await createVfs(context);
			const totalSize = await vfs.size();
			await writeLogs(context, 500);
			expect(await vfs.size()).to.equal(totalSize);
		});

		it('does not count data from files that are being rotated to', async function () {
			vfs = await createVfs(context, { pollInterval: 1 });
			const totalSize = await vfs.size();
			await inContext(context, (logger) => {
				const data = 'helloworld'.repeat(50);
				logger.WORKER_SPAWNED(27);
				for (let count = 0; count < 2; ++count) {
					context.rotate(logger);
					for (let i = 0; i < 100; ++i) {
						context.log(logger, data);
						if (i % 2 === 0) {
							context.flush(logger);
						}
					}
				}
			});
			await new Promise(r => setTimeout(r, 2));
			expect(await vfs.size()).to.be.below(totalSize + 30);
			await inContext(context, (logger) => {
				logger.WORKER_EXITED(27, 0);
			});
			await new Promise(r => setTimeout(r, 2));
			expect(await vfs.size()).to.be.above(totalSize + 500 * 200);
		});

		it('if immutable, does count data from files that are being rotated to', async function () {
			vfs = await createVfs(context, { pollInterval: 1, immutable: true });
			const totalSize = await vfs.size();
			await inContext(context, (logger) => {
				const data = 'helloworld'.repeat(50);
				logger.WORKER_SPAWNED(27);
				for (let count = 0; count < 2; ++count) {
					context.rotate(logger);
					for (let i = 0; i < 100; ++i) {
						context.log(logger, data);
						if (i % 2 === 0) {
							context.flush(logger);
						}
					}
				}
			});
			await new Promise(r => setTimeout(r, 2));
			expect(await vfs.size()).to.be.above(totalSize + 500 * 200);
		});

		it('if polling, periodically detects new data within the current log file', async function () {
			vfs = await createVfs(context, { pollInterval: 50 });
			const totalSize = await vfs.size();
			await writeLogs(context, 500);
			await new Promise(r => setTimeout(r, 51));
			expect(await vfs.size()).to.be.above(totalSize + 500 * 50);
		});

		it('if polling, periodically detects new log files', async function () {
			vfs = await createVfs(context, { pollInterval: 50 });
			const totalSize = await vfs.size();
			await inContext(context, (logger) => {
				const data = 'helloworld'.repeat(50);
				context.rotate(logger);
				for (let i = 0; i < 100; ++i) {
					context.log(logger, data);
					if (i % 2 === 0) {
						context.flush(logger);
					}
				}
			});
			await new Promise(r => setTimeout(r, 51));
			expect(await vfs.size()).to.be.above(totalSize + 500 * 100);
		});
	});

	describe('constructor', function () {
		it('is a subclass of Vfs', async function () {
			expect(LogDirectorySource.prototype).to.be.an.instanceof(Vfs);
			expect(Object.getPrototypeOf(LogDirectorySource)).to.equal(Vfs);
		});

		it('throws if the given dirname is not a string', async function () {
			await fs.mkdir(util.current());
			expect(() => new LogDirectorySource()).to.throw(TypeError);
			expect(() => new LogDirectorySource(null)).to.throw(TypeError);
			expect(() => new LogDirectorySource(123)).to.throw(TypeError);
			expect(() => new LogDirectorySource(['foo'])).to.throw(TypeError);
			expect(() => new LogDirectorySource({ valueOf: () => util.current() })).to.throw(TypeError);
			expect(() => new LogDirectorySource(new String(util.current()))).to.throw(TypeError);
		});

		describe('options.cacheSize', function () {
			it('throws if not a non-negative integer', async function () {
				await fs.mkdir(util.current());
				expect(() => new LogDirectorySource(util.current(), { cacheSize: null })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { cacheSize: '1024' })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { cacheSize: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { cacheSize: BigInt(1024) })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { cacheSize: 1024.5 })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { cacheSize: -1024 })).to.throw(RangeError);
				expect(() => new LogDirectorySource(util.current(), { cacheSize: -1 })).to.throw(RangeError);
			});
		});

		describe('options.pollInterval', function () {
			it('throws if not a positive integer or null', async function () {
				await fs.mkdir(util.current());
				expect(() => new LogDirectorySource(util.current(), { pollInterval: '1024' })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { pollInterval: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { pollInterval: BigInt(1024) })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { pollInterval: 1024.5 })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { pollInterval: -1024 })).to.throw(RangeError);
				expect(() => new LogDirectorySource(util.current(), { pollInterval: -1 })).to.throw(RangeError);
				expect(() => new LogDirectorySource(util.current(), { pollInterval: 0 })).to.throw(RangeError);
			});

			it('throws if greater than 2147483647', async function () {
				await fs.mkdir(util.current());
				expect(() => new LogDirectorySource(util.current(), { pollInterval: 2147483648 })).to.throw(RangeError);
			});
		});

		describe('options.lazy', function () {
			it('throws if not a boolean', async function () {
				await fs.mkdir(util.current());
				expect(() => new LogDirectorySource(util.current(), { lazy: null })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { lazy: 'true' })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { lazy: { valueOf: () => true } })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { lazy: 1 })).to.throw(TypeError);
			});
		});

		describe('options.immutable', function () {
			it('throws if not a boolean', async function () {
				await fs.mkdir(util.current());
				expect(() => new LogDirectorySource(util.current(), { immutable: null })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { immutable: 'true' })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { immutable: { valueOf: () => true } })).to.throw(TypeError);
				expect(() => new LogDirectorySource(util.current(), { immutable: 1 })).to.throw(TypeError);
			});
		});
	});
});

async function createVfs(context, options, logCount) {
	await fs.mkdir(context.dirname);
	await writeLogs(context, logCount);
	const vfs = new LogDirectorySource(context.dirname, options);
	await vfs.setup();
	return vfs;
}

async function writeLogs(context, logCount = 2000) {
	await inContext(context, async (logger) => {
		const data = '1234567890'.repeat(50);
		if (context.isStart) {
			logger.STARTING_UP();
			context.isStart = false;
			context.estimatedSize = 9;
		}
		for (let i = 0; i < logCount; ++i) {
			context.log(logger, data);
			if (i % 2 === 0) {
				context.flush(logger);
			}
			if (i % 50 == 0) {
				await new Promise(r => setTimeout(r, 2)); // MASTER_PING
				context.currentTime += 1;
			}
			if (context.estimatedSize > 1024 * 100) {
				context.rotate(logger);
			}
		}
	});
}

async function inContext(context, fn) {
	let filename;
	if (context.filenames.length) {
		filename = context.filenames[context.filenames.length - 1];
	} else {
		filename = path.join(context.dirname, toLogBasename(context.currentTime));
		context.filenames.push(filename);
	}

	const logger = new MasterLogger(filename, { pingDelay: 1, compression: false });
	const originalNow = Date.now;
	Date.now = () => context.currentTime;
	try {
		await fn(logger);
	} finally {
		Date.now = originalNow;
		logger.close();
	}
}

function createContext(dirname) {
	return {
		dirname,
		filenames: [],
		currentTime: Date.now(),
		isStart: true,
		estimatedSize: 0,
		log(logger, data) {
			logger.info(data);
			this.currentTime += 1;
			this.estimatedSize += data.length + 2 + 3 + 9;
		},
		flush(logger) {
			logger.flush();
			this.estimatedSize += 1;
		},
		rotate(logger) {
			const filename = path.join(this.dirname, toLogBasename(this.currentTime++));
			logger.rotate(filename);
			this.filenames.push(filename);
			this.estimatedSize = 10;
		},
	};
}

async function expectToThrow(promise, ...args) {
	try {
		await promise;
	} catch (err) {
		expect(() => { throw err; }).to.throw(...args);
		return;
	}
	throw new Error('Expected promise to throw');
}
