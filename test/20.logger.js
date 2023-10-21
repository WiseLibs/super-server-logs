'use strict';
const fs = require('fs');
const Logger = require('../src/nodejs/logger');
const { decompress, unescapeBlock } = require('../src/shared/common');
const { ESCAPE, SEPARATOR, ESCAPE_CODE_ESCAPE, ESCAPE_CODE_SEPARATOR } = require('../src/shared/common');

describe('Logger', function () {
	let logger;

	afterEach(function () {
		logger?.close();
	});

	describe('log()', function () {
		it('writes raw data to a file, appending a separator', async function () {
			logger = new Logger(util.next(), { outputDelay: 0, compression: false });
			expect(logger.log(new Uint8Array([10, 20, 30, 40]))).to.equal(logger);
			expect(fs.readFileSync(util.current()))
				.to.deep.equal(new Uint8Array([10, 20, 30, 40, SEPARATOR]));
		});

		it('buffers data written in quick succession', async function () {
			this.slow(2000);
			logger = new Logger(util.next(), { compression: false });
			logger.log(new Uint8Array([10, 100]));
			logger.log(new Uint8Array([30, 40]));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 300));
			expect(fs.readFileSync(util.current()))
				.to.deep.equal(new Uint8Array([10, 100, 30, 40, SEPARATOR]));
		});

		it('automatically flushes data when too much data is written', async function () {
			logger = new Logger(util.next(), { compression: false });
			logger.log(new Uint8Array(new Array(1024 * 20).fill(0)));
			logger.log(new Uint8Array(new Array(1024 * 20).fill(1)));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array([
				...new Array(1024 * 20).fill(0),
				...new Array(1024 * 20).fill(1),
				SEPARATOR,
			]));
		});

		it('escapes all data within a flushed block (to not contain a separator)', async function () {
			this.slow(400);
			logger = new Logger(util.next(), { outputDelay: 50, compression: false });
			logger.log(new Uint8Array([10, ESCAPE]));
			logger.log(new Uint8Array([30, SEPARATOR]));
			await new Promise(r => setTimeout(r, 60));
			const result = fs.readFileSync(util.current());
			expect(result).to.deep.equal(new Uint8Array([10, ESCAPE, ESCAPE_CODE_ESCAPE, 30, ESCAPE, ESCAPE_CODE_SEPARATOR, SEPARATOR]));
			expect([...result].slice(0, -1)).to.not.include(SEPARATOR);
		});

		it('ensures that no byte can result in a separator after being escaped', async function () {
			logger = new Logger(util.next(), { outputDelay: 0, compression: false });
			const everyByte = new Array(256).fill(0).map((_, i) => i);
			logger.log(new Uint8Array(everyByte));
			const result = fs.readFileSync(util.current());
			expect(result).to.have.lengthOf(259);
			expect(result[result.length - 1]).to.equal(SEPARATOR);
			expect([...result].slice(0, -1)).to.not.include(SEPARATOR);
		});

		it('compresses data when multiple logs are written to a block', async function () {
			this.slow(400);
			logger = new Logger(util.next(), { outputDelay: 50 });
			logger.log(new Uint8Array([10, 20]));
			logger.log(new Uint8Array([30, 40]));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			const result = fs.readFileSync(util.current());
			expect(result[result.length - 1]).to.equal(SEPARATOR);
			expect(Boolean(result[0] & 0x80)).to.be.true;
			result[0] = result[0] >> 4 | (result[0] & 0xf) << 4; // Restore zlib header
			const decompressed = decompress(result.subarray(0, -1));
			expect(decompressed).to.deep.equal(new Uint8Array([10, 20, 30, 40]));
		});

		it('compresses data when a large log is written to a block', async function () {
			this.slow(400);
			logger = new Logger(util.next(), { outputDelay: 50 });
			logger.log(new Uint8Array(new Array(1024 * 8).fill(10)));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			const result = fs.readFileSync(util.current());
			expect(result.byteLength < 1024 * 8);
			expect(result[result.length - 1]).to.equal(SEPARATOR);
			expect(Boolean(result[0] & 0x80)).to.be.true;
			result[0] = result[0] >> 4 | (result[0] & 0xf) << 4; // Restore zlib header
			const decompressed = decompress(result.subarray(0, -1));
			expect(decompressed).to.deep.equal(new Uint8Array(new Array(1024 * 8).fill(10)));
		});

		it('does not compresses data when only one small log is written to a block', async function () {
			this.slow(400);
			logger = new Logger(util.next(), { outputDelay: 50 });
			logger.log(new Uint8Array([10, ESCAPE]));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			const result = fs.readFileSync(util.current());
			expect(result[result.length - 1]).to.equal(SEPARATOR);
			expect(Boolean(result[0] & 0x80)).to.be.false;
			expect(result).to.deep.equal(new Uint8Array([10, ESCAPE, ESCAPE_CODE_ESCAPE, SEPARATOR]));
		});

		it('escapes the written block even when compressed', async function () {
			this.slow(400);
			logger = new Logger(util.next(), { outputDelay: 50 });
			logger.log(new Uint8Array([108, 181, 227, 194]));
			logger.log(new Uint8Array([237, 204, 197, 247]));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 60));
			const result = fs.readFileSync(util.current());
			expect(result[result.length - 1]).to.equal(SEPARATOR);
			expect([...result.subarray(0, -1)]).to.not.include(SEPARATOR);
			const unescaped = unescapeBlock(result.subarray(0, -1));
			expect([...unescaped.subarray(0, -1)]).to.include(SEPARATOR);
			expect(Boolean(unescaped[0] & 0x80)).to.be.true;
			unescaped[0] = unescaped[0] >> 4 | (unescaped[0] & 0xf) << 4; // Restore zlib header
			const decompressed = decompress(unescaped);
			expect(decompressed).to.deep.equal(new Uint8Array([108, 181, 227, 194, 237, 204, 197, 247]));
		});
	});

	describe('flush()', function () {
		it('flushes all buffered data to the file', async function () {
			logger = new Logger(util.next(), { compression: false });
			logger.log(new Uint8Array([10, 100]));
			logger.log(new Uint8Array([30, 40]));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			expect(logger.flush()).to.equal(logger);
			expect(fs.readFileSync(util.current()))
				.to.deep.equal(new Uint8Array([10, 100, 30, 40, SEPARATOR]));
		});
	});

	describe('rotate()', function () {
		it('changes the logger\'s file', async function () {
			const filename = util.next();
			logger = new Logger(filename, { highWaterMark: 0, compression: false });
			logger.log(new Uint8Array([10, 100]));
			logger.log(new Uint8Array([30, 40]));
			expect(logger.rotate(util.next())).to.equal(logger);
			logger.log(new Uint8Array([50, 70]));
			expect(fs.readFileSync(filename))
				.to.deep.equal(new Uint8Array([10, 100, SEPARATOR, 30, 40, SEPARATOR]));
			expect(fs.readFileSync(util.current()))
				.to.deep.equal(new Uint8Array([50, 70, SEPARATOR]));
		});

		it('flushes all buffered data before changing files', async function () {
			this.slow(2000);
			const filename = util.next();
			logger = new Logger(filename, { compression: false });
			logger.log(new Uint8Array([10, 100]));
			logger.log(new Uint8Array([30, 40]));
			expect(fs.readFileSync(filename)).to.deep.equal(new Uint8Array());
			logger.rotate(util.next());
			logger.log(new Uint8Array([50, 70]));
			expect(fs.readFileSync(filename))
				.to.deep.equal(new Uint8Array([10, 100, 30, 40, SEPARATOR]));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			await new Promise(r => setTimeout(r, 300));
			expect(fs.readFileSync(util.current()))
				.to.deep.equal(new Uint8Array([50, 70, SEPARATOR]));
		});

		it('throws if filename is not a string', async function () {
			logger = new Logger(util.next());
			expect(() => logger.rotate()).to.throw(TypeError);
			expect(() => logger.rotate(null)).to.throw(TypeError);
			expect(() => logger.rotate(123)).to.throw(TypeError);
			expect(() => logger.rotate(['a', 'b', 'c', '.log'])).to.throw(TypeError);
			expect(() => logger.rotate({ valueOf: () => util.next() })).to.throw(TypeError);
			expect(() => logger.rotate(new String(util.next()))).to.throw(TypeError);
		});
	});

	describe('close()', function () {
		it('closes the logger', async function () {
			logger = new Logger(util.next());
			expect(logger.closed).to.be.false;
			expect(logger.close()).to.equal(logger);
			expect(logger.closed).to.be.true;
		});

		it('flushes all buffered data beforing closing', async function () {
			logger = new Logger(util.next(), { compression: false });
			logger.log(new Uint8Array([10, 100]));
			logger.log(new Uint8Array([30, 40]));
			expect(fs.readFileSync(util.current())).to.deep.equal(new Uint8Array());
			logger.close();
			expect(fs.readFileSync(util.current()))
				.to.deep.equal(new Uint8Array([10, 100, 30, 40, SEPARATOR]));
		});
	});

	describe('constructor', function () {
		it('throws if the given filename is not a string or null', async function () {
			expect(() => new Logger()).to.throw(TypeError);
			expect(() => new Logger(123)).to.throw(TypeError);
			expect(() => new Logger(['foo.log'])).to.throw(TypeError);
			expect(() => new Logger({ valueOf: () => util.next() })).to.throw(TypeError);
			expect(() => new Logger(new String(util.next()))).to.throw(TypeError);
		});

		describe('options.highWaterMark', function () {
			it('throws if not a non-negative integer', async function () {
				expect(() => new Logger(util.next(), { highWaterMark: null })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { highWaterMark: '1024' })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { highWaterMark: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { highWaterMark: BigInt(1024) })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { highWaterMark: 1024.5 })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { highWaterMark: -1024 })).to.throw(RangeError);
				expect(() => new Logger(util.next(), { highWaterMark: -1 })).to.throw(RangeError);
			});
		});

		describe('options.outputDelay', function () {
			it('throws if not a non-negative integer', async function () {
				expect(() => new Logger(util.next(), { outputDelay: null })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { outputDelay: '1024' })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { outputDelay: { valueOf: () => 1024 } })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { outputDelay: BigInt(1024) })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { outputDelay: 1024.5 })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { outputDelay: -1024 })).to.throw(RangeError);
				expect(() => new Logger(util.next(), { outputDelay: -1 })).to.throw(RangeError);
			});

			it('throws if greater than 2147483647', async function () {
				expect(() => new Logger(util.next(), { outputDelay: 2147483648 })).to.throw(RangeError);
			});
		});

		describe('options.compression', function () {
			it('throws if not a boolean', async function () {
				expect(() => new Logger(util.next(), { compression: null })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { compression: 'true' })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { compression: { valueOf: () => true } })).to.throw(TypeError);
				expect(() => new Logger(util.next(), { compression: 1 })).to.throw(TypeError);
			});
		});
	});

	describe('disabled logging mode (null filename)', function () {
		specify('log() is a no-op', async function () {
			logger = new Logger(null, { outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.log(new Uint8Array([10, 100]))).to.equal(logger);
			logger.log(new Uint8Array([30, 40]));
		});

		specify('flush() is a no-op', async function () {
			logger = new Logger(null, { outputDelay: 0 });
			expect(logger.closed).to.be.true;
			logger.log(new Uint8Array([10, 100]));
			logger.log(new Uint8Array([30, 40]));
			expect(logger.flush()).to.equal(logger);
			expect(logger.closed).to.be.true;
		});

		specify('rotate() is a no-op', async function () {
			logger = new Logger(null, { outputDelay: 0 });
			expect(logger.closed).to.be.true;
			logger.log(new Uint8Array([10, 100]));
			logger.log(new Uint8Array([30, 40]));
			expect(logger.rotate(util.next())).to.equal(logger);
			expect(logger.closed).to.be.true;
			logger.log(new Uint8Array([10, 100]));
			logger.log(new Uint8Array([30, 40]));
			logger.flush();
			expect(fs.existsSync(util.current())).to.be.false;
		});

		specify('close() is a no-op', async function () {
			logger = new Logger(null, { outputDelay: 0 });
			expect(logger.closed).to.be.true;
			expect(logger.close()).to.equal(logger);
			expect(logger.closed).to.be.true;
		});
	});
});
