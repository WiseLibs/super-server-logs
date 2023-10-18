'use strict';
const { LogEntry, LogType, LogLevel } = require('..');
const { ESCAPE, SEPARATOR, ESCAPE_CODE_ESCAPE, ESCAPE_CODE_SEPARATOR } = require('../src/shared/common');
const { compress } = require('../src/shared/common');
const { escapeBlock } = require('../src/nodejs/common');
const BlockParser = require('../src/shared/block-parser');
const EventTypes = require('../src/shared/event-types');
const Writer = require('../src/nodejs/writer');

describe('BlockParser', function () {
	describe('parseOne()', function () {
		it('returns the first log entry in the given block', function () {
			const log = BlockParser.parseOne(BLOCK);
			expect(log).to.be.an.instanceof(LogEntry);
			expect(log.timestamp).to.equal(1697612631377);
			expect(log.level).to.equal(LogLevel.INFO);
			expect(log.type).to.equal(LogType.LOG);
			expect(log.workerId).to.equal(32);
			expect(log.requestId).to.deep.equal(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 11, 12, 13, 14, 15, 100]));
			expect(log.data).to.equal('{"foo":"bar"}');
		});

		it('unescapes the data within the block', function () {
			const log = BlockParser.parseOne(BLOCK);
			expect(log).to.be.an.instanceof(LogEntry);
			expect(log.nonce).to.equal(ESCAPE << 8 | SEPARATOR);
		});

		it('decompresses the data within the block, if necessary', function () {
			const log = BlockParser.parseOne(COMPRESSED_BLOCK);
			expect(log).to.be.an.instanceof(LogEntry);
			expect(log.timestamp).to.equal(1697612631377);
			expect(log.nonce).to.equal(ESCAPE << 8 | SEPARATOR);
			expect(log.level).to.equal(LogLevel.INFO);
			expect(log.type).to.equal(LogType.LOG);
			expect(log.workerId).to.equal(32);
			expect(log.requestId).to.deep.equal(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 11, 12, 13, 14, 15, 100]));
			expect(log.data).to.equal('{"foo":"bar"}');
		});
	});

	describe('parseEach()', function () {
		it('returns an iterable iterator', function () {
			const iterator = BlockParser.parseEach(BLOCK);
			expect(iterator).to.be.an('object');
			expect(iterator.next).to.be.a('function');
			expect(iterator.return).to.be.a('function');
			expect(iterator.throw).to.be.a('function');
			expect(iterator[Symbol.iterator]).to.be.a('function');
			expect(iterator[Symbol.iterator]()).to.equal(iterator);
		});

		it('yields each log entry in the given block', function () {
			const logs = [...BlockParser.parseEach(BLOCK)];
			expect(logs).to.have.lengthOf(2);
			expect(logs[0]).to.be.an.instanceof(LogEntry);
			expect(logs[0].timestamp).to.equal(1697612631377);
			expect(logs[0].level).to.equal(LogLevel.INFO);
			expect(logs[0].type).to.equal(LogType.LOG);
			expect(logs[0].workerId).to.equal(32);
			expect(logs[0].requestId).to.deep.equal(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 11, 12, 13, 14, 15, 100]));
			expect(logs[0].data).to.equal('{"foo":"bar"}');
			expect(logs[1]).to.be.an.instanceof(LogEntry);
			expect(logs[1].timestamp).to.equal(1697612771048);
			expect(logs[1].level).to.equal(LogLevel.CRITICAL);
			expect(logs[1].type).to.equal(LogType.LOG);
			expect(logs[1].workerId).to.be.null;
			expect(logs[1].requestId).to.be.null;
			expect(logs[1].data).to.equal('"hello world"');
		});

		it('unescapes the data within the block', function () {
			const logs = [...BlockParser.parseEach(BLOCK)];
			expect(logs[0]).to.be.an.instanceof(LogEntry);
			expect(logs[0].nonce).to.equal(ESCAPE << 8 | SEPARATOR);
			expect(logs[1]).to.be.an.instanceof(LogEntry);
			expect(logs[1].nonce).to.equal(SEPARATOR << 8 | 123);
		});

		it('decompresses the data within the block, if necessary', function () {
			const logs = [...BlockParser.parseEach(COMPRESSED_BLOCK)];
			expect(logs).to.have.lengthOf(2);
			expect(logs[0]).to.be.an.instanceof(LogEntry);
			expect(logs[0].timestamp).to.equal(1697612631377);
			expect(logs[0].nonce).to.equal(ESCAPE << 8 | SEPARATOR);
			expect(logs[0].level).to.equal(LogLevel.INFO);
			expect(logs[0].type).to.equal(LogType.LOG);
			expect(logs[0].workerId).to.equal(32);
			expect(logs[0].requestId).to.deep.equal(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 11, 12, 13, 14, 15, 100]));
			expect(logs[0].data).to.equal('{"foo":"bar"}');
			expect(logs[1]).to.be.an.instanceof(LogEntry);
			expect(logs[1].timestamp).to.equal(1697612771048);
			expect(logs[1].nonce).to.equal(SEPARATOR << 8 | 123);
			expect(logs[1].level).to.equal(LogLevel.CRITICAL);
			expect(logs[1].type).to.equal(LogType.LOG);
			expect(logs[1].workerId).to.be.null;
			expect(logs[1].requestId).to.be.null;
			expect(logs[1].data).to.equal('"hello world"');
		});
	});
});

const BLOCK = new Writer()
	.uint8(EventTypes.REQUEST_LOG_INFO)
	.uint48(1697612631377)
	.bytes(new Uint8Array([ESCAPE, ESCAPE_CODE_ESCAPE, ESCAPE, ESCAPE_CODE_SEPARATOR]))
	.dynamicInteger(32)
	.bytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 11, 12, 13, 14, 15, 100]))
	.json({ foo: 'bar' })
	.uint8(EventTypes.MASTER_LOG_CRITICAL)
	.uint48(1697612771048)
	.bytes(new Uint8Array([ESCAPE, ESCAPE_CODE_SEPARATOR, 123]))
	.json('hello world')
	.uint8(SEPARATOR)
	.done();

const COMPRESSED_BLOCK = (() => {
	const block = Buffer.concat([
		escapeBlock(compress(new Writer()
			.uint8(EventTypes.REQUEST_LOG_INFO)
			.uint48(1697612631377)
			.bytes(new Uint8Array([ESCAPE, SEPARATOR]))
			.dynamicInteger(32)
			.bytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 11, 12, 13, 14, 15, 100]))
			.json({ foo: 'bar' })
			.uint8(EventTypes.MASTER_LOG_CRITICAL)
			.uint48(1697612771048)
			.bytes(new Uint8Array([SEPARATOR, 123]))
			.json('hello world')
			.done())),
		Buffer.from([SEPARATOR]),
	]);

	block[0] = block[0] >> 4 | (block[0] & 0xf) << 4;
	return block;
})();
