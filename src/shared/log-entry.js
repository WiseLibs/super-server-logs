'use strict';
const { stringify: uuidStringify } = require('uuid');
const { Address6 } = require('ip-address');
const { LogType, LogLevel, Lifecycle, HttpMethod } = require('./public-enums');
const ExceptionUtil = require('./exception-util');
const EventTypes = require('./event-types');
const Reader = require('./reader');
const {
	REQUEST,
	REQUEST_META,
	RESPONSE,
	RESPONSE_FINISHED,
	REQUEST_LOG_CRITICAL,
	REQUEST_LOG_ERROR,
	REQUEST_LOG_WARN,
	REQUEST_LOG_INFO,
	WORKER_STARTED,
	WORKER_GOING_ONLINE,
	WORKER_ONLINE,
	WORKER_GOING_OFFLINE,
	WORKER_OFFLINE,
	WORKER_DONE,
	WORKER_UNCAUGHT_EXCEPTION,
	WORKER_PING,
	WORKER_LOG_CRITICAL,
	WORKER_LOG_ERROR,
	WORKER_LOG_WARN,
	WORKER_LOG_INFO,
	STARTING_UP,
	STARTING_UP_COMPLETED,
	SHUTTING_DOWN,
	SHUTTING_DOWN_COMPLETED,
	WORKER_SPAWNED,
	WORKER_EXITED,
	MASTER_UNCAUGHT_EXCEPTION,
	MASTER_PING,
	MASTER_LOG_CRITICAL,
	MASTER_LOG_ERROR,
	MASTER_LOG_WARN,
	MASTER_LOG_INFO,
} = require('./event-types');

/*
	This is the public representation of a log entry. Compared to the compact
	array format that logs are stored in, this representation is more
	user-friendly, as it exposes intuitive property names, provides normalized
	log levels for all logs, and uses a simpler classification for the various
	types of logs.
 */

module.exports = class LogEntry {
	constructor(reader) {
		if (!(reader instanceof Reader)) {
			throw new TypeError('Expected argument to be a Reader');
		}

		const eventType = reader.uint8();
		this.timestamp = reader.uint48();
		this.nonce = reader.uint16();

		switch (eventType) {
			case REQUEST: {
				this.level = LogLevel.INFO;
				this.type = LogType.REQUEST;
				this.workerId = reader.dynamicInteger();
				this.requestId = reader.bytes(16);
				const flagByte = reader.uint8();
				this.httpVersionMajor = flagByte >> 3 & 0b111;
				this.httpVersionMinor = flagByte & 0b111;
				this.ipAddress = flagByte & 0b01000000 ? reader.bytes(16) : reader.uint32();
				this.method = flagByte & 0b10000000 ? reader.string() : reader.uint8();
				this.url = reader.string();
				break;
			}
			case REQUEST_META:
				this.level = LogLevel.INFO;
				this.type = LogType.REQUEST_META;
				this.workerId = reader.dynamicInteger();
				this.requestId = reader.bytes(16);
				this.data = reader.string();
				break;
			case RESPONSE: {
				this.level = LogLevel.INFO;
				this.type = LogType.RESPONSE;
				this.workerId = reader.dynamicInteger();
				this.requestId = reader.bytes(16);
				this.error = reader.string() || null;
				const flagByte = reader.uint8();
				this.statusCode = reader.dynamicInteger();
				const isExpectedError = (flagByte & 1) === 1;
				if (!isExpectedError && this.error) {
					this.level = LogLevel.ERROR;
				}
				break;
			}
			case RESPONSE_FINISHED:
				this.level = LogLevel.INFO;
				this.type = LogType.RESPONSE_FINISHED;
				this.workerId = reader.dynamicInteger();
				this.requestId = reader.bytes(16);
				this.error = reader.string() || null;
				if (this.error) {
					this.level = LogLevel.ERROR;
				}
				break;
			case REQUEST_LOG_CRITICAL:
			case REQUEST_LOG_ERROR:
			case REQUEST_LOG_WARN:
			case REQUEST_LOG_INFO:
				this.level = eventType - 10;
				this.type = LogType.LOG;
				this.workerId = reader.dynamicInteger();
				this.requestId = reader.bytes(16);
				this.data = reader.string();
				break;
			case WORKER_STARTED:
			case WORKER_GOING_ONLINE:
			case WORKER_ONLINE:
			case WORKER_GOING_OFFLINE:
			case WORKER_OFFLINE:
			case WORKER_DONE:
				this.level = LogLevel.INFO;
				this.type = LogType.LIFECYCLE;
				this.workerId = reader.dynamicInteger();
				this.event = EVENT_TO_LIFECYCLE[eventType];
				break;
			case WORKER_UNCAUGHT_EXCEPTION:
				this.level = LogLevel.CRITICAL;
				this.type = LogType.UNCAUGHT_EXCEPTION;
				this.workerId = reader.dynamicInteger();
				this.error = reader.string();
				break;
			case WORKER_PING:
				this.level = LogLevel.INTERNAL;
				this.type = LogType.LIFECYCLE;
				this.workerId = reader.dynamicInteger();
				this.event = EVENT_TO_LIFECYCLE[eventType];
				break;
			case WORKER_LOG_CRITICAL:
			case WORKER_LOG_ERROR:
			case WORKER_LOG_WARN:
			case WORKER_LOG_INFO:
				this.level = eventType - 30;
				this.type = LogType.LOG;
				this.workerId = reader.dynamicInteger();
				this.requestId = null;
				this.data = reader.string();
				break;
			case STARTING_UP:
			case STARTING_UP_COMPLETED:
			case SHUTTING_DOWN:
			case SHUTTING_DOWN_COMPLETED:
				this.level = LogLevel.INFO;
				this.type = LogType.LIFECYCLE;
				this.workerId = null;
				this.event = EVENT_TO_LIFECYCLE[eventType];
				break;
			case WORKER_SPAWNED:
				this.level = LogLevel.INFO;
				this.type = LogType.LIFECYCLE;
				this.workerId = reader.dynamicInteger();
				this.event = EVENT_TO_LIFECYCLE[eventType];
				break;
			case WORKER_EXITED: {
				this.level = LogLevel.INFO;
				this.type = LogType.LIFECYCLE;
				this.workerId = reader.dynamicInteger();
				this.event = EVENT_TO_LIFECYCLE[eventType];
				const flagByte = reader.uint8();
				const hasExitCode = (flagByte & 1) === 1;
				this.exitCode = hasExitCode ? reader.dynamicInteger() : null;
				this.signal = reader.string() || null;
				if (this.exitCode !== 0) {
					this.level = LogLevel.WARN;
				}
				break;
			}
			case MASTER_UNCAUGHT_EXCEPTION:
				this.level = LogLevel.CRITICAL;
				this.type = LogType.UNCAUGHT_EXCEPTION;
				this.workerId = null;
				this.error = reader.string();
				break;
			case MASTER_PING:
				this.level = LogLevel.INTERNAL;
				this.type = LogType.LIFECYCLE;
				this.workerId = null;
				this.event = EVENT_TO_LIFECYCLE[eventType];
				this.workerIds = reader.dynamicIntegerArray();
				break;
			case MASTER_LOG_CRITICAL:
			case MASTER_LOG_ERROR:
			case MASTER_LOG_WARN:
			case MASTER_LOG_INFO:
				this.level = eventType - 50;
				this.type = LogType.LOG;
				this.workerId = null;
				this.requestId = null;
				this.data = reader.string();
				break;
			default:
				throw new Error('Unrecognized log event type');
		}
	}

	getRequestId() {
		if (this.requestId != null) {
			return uuidStringify(this.requestId);
		}
		return this.requestId;
	}

	getIpAddress() {
		if (this.type === LogType.REQUEST) {
			return decodeIpAddress(this.ipAddress);
		}
	}

	getHttpVersion() {
		if (this.type === LogType.REQUEST) {
			return `${this.httpVersionMajor}.${this.httpVersionMinor}`;
		}
	}

	getHttpMethod() {
		if (this.type === LogType.REQUEST) {
			return HTTP_METHOD_TO_JSON[this.method] || this.method;
		}
	}

	getError() {
		if (this.error != null) {
			return ExceptionUtil.decode(JSON.parse(this.error));
		}
		return this.error;
	}

	toJSON() {
		const json = {
			timestamp: this.timestamp,
			nonce: this.nonce,
			level: LOG_LEVEL_TO_JSON[this.level] || '',
			type: LOG_TYPE_TO_JSON[this.type] || '',
			workerId: this.workerId,
		};

		switch (this.type) {
			case LogType.REQUEST:
				json.requestId = uuidStringify(this.requestId);
				json.ipAddress = decodeIpAddress(this.ipAddress);
				json.httpVersion = `${this.httpVersionMajor}.${this.httpVersionMinor}`;
				json.url = this.url;
				json.method = HTTP_METHOD_TO_JSON[this.method] || this.method;
				break;
			case LogType.REQUEST_META:
				json.requestId = uuidStringify(this.requestId);
				json.data = JSON.parse(this.data);
				break;
			case LogType.RESPONSE:
				json.requestId = uuidStringify(this.requestId);
				json.error = this.error && ExceptionUtil.decode(JSON.parse(this.error));
				json.statusCode = this.statusCode;
				break;
			case LogType.RESPONSE_FINISHED:
				json.requestId = uuidStringify(this.requestId);
				json.error = this.error && ExceptionUtil.decode(JSON.parse(this.error));
				break;
			case LogType.LOG:
				json.requestId = this.requestId && uuidStringify(this.requestId);
				json.data = JSON.parse(this.data);
				break;
			case LogType.LIFECYCLE:
				json.event = LIFECYCLE_TO_JSON[this.event] || '';
				if (this.event === Lifecycle.WORKER_EXITED) {
					json.exitCode = this.exitCode;
					json.signal = this.signal;
				}
				break;
			case LogType.UNCAUGHT_EXCEPTION:
				json.error = ExceptionUtil.decode(JSON.parse(this.error));
				break;
		}

		return json;
	}
};

// This maps lifecycle-related events in EventTypes to the Lifecycle enum.
const EVENT_TO_LIFECYCLE = new Array(60).fill(0);
for (const [name, number] of Object.entries(Lifecycle)) {
	const eventType = EventTypes[name];
	if (!Number.isInteger(eventType)) {
		throw new TypeError('Invalid EVENT_TO_LIFECYCLE mapping');
	}
	EVENT_TO_LIFECYCLE[eventType] = number;
}

const LOG_LEVEL_TO_JSON = new Array(10).fill('');
for (const [name, number] of Object.entries(LogLevel)) {
	LOG_LEVEL_TO_JSON[number] = name;
}

const LOG_TYPE_TO_JSON = new Array(10).fill('');
for (const [name, number] of Object.entries(LogType)) {
	LOG_TYPE_TO_JSON[number] = name;
}

const LIFECYCLE_TO_JSON = new Array(20).fill('');
for (const [name, number] of Object.entries(Lifecycle)) {
	LIFECYCLE_TO_JSON[number] = name;
}

const HTTP_METHOD_TO_JSON = new Array(12).fill('');
for (const [name, number] of Object.entries(HttpMethod)) {
	HTTP_METHOD_TO_JSON[number] = name;
}

// If given an integer, an equivalant IPv4 address string is returned.
// If given a Uint8Array, an equivalant IPv6 address string is returned.
function decodeIpAddress(ipAddress) {
	if (Number.isInteger(ipAddress) && ipAddress >= 0 && ipAddress <= 0xffffffff) {
		return `${ipAddress >>> 24 & 0xff}.${ipAddress >>> 16 & 0xff}.${ipAddress >>> 8 & 0xff}.${ipAddress & 0xff}`;
	} else if (ipAddress instanceof Uint8Array && ipAddress.byteLength === 16) {
		return Address6.fromUnsignedByteArray(ipAddress).correctForm();
	} else {
		throw new TypeError('Corrupted logs detected');
	}
}
