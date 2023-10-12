import { EventEmitter } from 'events';

declare namespace SuperServerLogs {
	export class Vfs {
		constructor(options: VfsOptions);
		setup(): Promise<void>;
		teardown(): Promise<void>;
		read(byteOffset: number, byteLength: number): Promise<Uint8Array>;
		size(): Promise<number>;
		get busy(): boolean;
		get closed(): boolean;
		static get PAGE_SIZE(): number;
	}

	export class LogDirectorySource extends Vfs {
		constructor(dirname: string, options?: LogDirectorySourceOptions);
	}

	export class LogEntry {
		private constructor();
		readonly timestamp: number;
		readonly nonce: number;
		readonly level: LogLevel;
		readonly type: LogType;
		readonly workerId: number | null;
		readonly requestId?: Uint8Array | null;
		readonly httpVersionMajor?: number;
		readonly httpVersionMinor?: number;
		readonly ipAddress?: number | Uint8Array;
		readonly method?: HttpMethod | string;
		readonly url?: string;
		readonly statusCode?: number;
		readonly exitCode?: number;
		readonly signal?: string | null;
		readonly data?: string;
		readonly error?: string | null;
		readonly event?: Lifecycle;
		readonly workerIds?: ReadonlyArray<number>;
		getRequestId(): string | null | undefined;
		getIpAddress(): string | undefined;
		getHttpVersion(): string | undefined;
		getHttpMethod(): string | undefined;
		getError(): ErrorInfo | null | undefined;
		toJSON(): object;
	}

	export class LogReader {
		constructor(vfs: Vfs);
		tail(minTimestamp?: number, options?: TailOptions): AsyncIterableIterator<LogEntry>;
		range(minTimestamp: number, maxTimestamp: number): AsyncIterableIterator<LogEntry>;
		rangeReversed(minTimestamp: number, maxTimestamp: number): AsyncIterableIterator<LogEntry>;
		bulkTail(minTimestamp?: number, options?: TailOptions): AsyncIterableIterator<Uint8Array>;
		bulkRange(minTimestamp: number, maxTimestamp: number): AsyncIterableIterator<Uint8Array>;
		bulkRangeReversed(minTimestamp: number, maxTimestamp: number): AsyncIterableIterator<Uint8Array>;
	}

	export namespace BulkParser {
		export function read(input: AsyncIterable<Uint8Array>): AsyncIterableIterator<Uint8Array>;
		export function readReversed(input: AsyncIterable<Uint8Array>): AsyncIterableIterator<Uint8Array>;
		export function parse(block: Uint8Array): IterableIterator<LogEntry>;
	}

	export class LogManager extends EventEmitter {
		constructor(dirname: string | null, options?: LogManagerOptions);
		close(): void;
		get closed(): boolean;
		get dirname(): string;
		get filename(): string;

		on(eventName: 'rotate', listener: (filename: string) => void): this;
		once(eventName: 'rotate', listener: (filename: string) => void): this;
		addListener(eventName: 'rotate', listener: (filename: string) => void): this;
		prependListener(eventName: 'rotate', listener: (filename: string) => void): this;
		prependOnceListener(eventName: 'rotate', listener: (filename: string) => void): this;
		on(eventName: 'error', listener: (err: unknown) => void): this;
		once(eventName: 'error', listener: (err: unknown) => void): this;
		addListener(eventName: 'error', listener: (err: unknown) => void): this;
		prependListener(eventName: 'error', listener: (err: unknown) => void): this;
		prependOnceListener(eventName: 'error', listener: (err: unknown) => void): this;
	}

	export class MasterLogger {
		constructor(filename: string | null, options?: MasterLoggerOptions);
		STARTING_UP(): this;
		STARTING_UP_COMPLETED(): this;
		SHUTTING_DOWN(): this;
		SHUTTING_DOWN_COMPLETED(): this;
		WORKER_SPAWNED(workerId: number): this;
		WORKER_EXITED(workerId: number, exitCode: number, signal?: string | null): this;
		UNCAUGHT_EXCEPTION(err: any): this;
		critical(data: any): this;
		error(data: any): this;
		warn(data: any): this;
		info(data: any): this;
		debug(data: any): this;
		flush(): this;
		rotate(filename: string): this;
		close(): this;
		get closed(): boolean;
	}

	export class WorkerLogger {
		constructor(filename: string | null, options?: WorkerLoggerOptions);
		WORKER_STARTED(): this;
		WORKER_GOING_ONLINE(): this;
		WORKER_ONLINE(): this;
		WORKER_GOING_OFFLINE(): this;
		WORKER_OFFLINE(): this;
		WORKER_DONE(): this;
		UNCAUGHT_EXCEPTION(err: any): this;
		critical(data: any): this;
		error(data: any): this;
		warn(data: any): this;
		info(data: any): this;
		debug(data: any): this;
		newRequest(): RequestLogger;
		flush(): this;
		rotate(filename: string): this;
		close(): this;
		get closed(): boolean;
	}

	export class RequestLogger {
		private constructor();
		REQUEST(req: HttpRequest): this;
		REQUEST_META(data: any): this;
		RESPONSE(statusCode: number, err?: any): this;
		RESPONSE_FINISHED(err?: any): this;
		critical(data: any): this;
		error(data: any): this;
		warn(data: any): this;
		info(data: any): this;
		debug(data: any): this;
		get requestId(): string;
	}

	export interface VfsOptions {
		read(byteOffset: number, byteLength: number, saveToCache: SaveToCache): Uint8Array | Promise<Uint8Array>;
		size(saveToCache: SaveToCache): number | Promise<number>;
		setup?(saveToCache: SaveToCache): void | Promise<void>;
		teardown?(): void | Promise<void>;
		cacheSize?: number;
	}

	export interface LogDirectorySourceOptions {
		cacheSize?: number;
		pollInterval?: number | null;
		lazy?: boolean;
		immutable?: boolean;
	}

	export interface LogManagerOptions {
		pollInterval?: number;
		logSizeLimit?: number;
		logAgeLimit?: number;
		granularity?: number;
	}

	export interface MasterLoggerOptions {
		highWaterMark?: number;
		outputDelay?: number;
		pingDelay?: number;
		debugLogLimit?: number;
	}

	export interface WorkerLoggerOptions {
		highWaterMark?: number;
		outputDelay?: number;
		pingDelay?: number;
		debugLogLimit?: number;
		workerId?: number;
	}

	export interface HttpRequest {
		httpVersionMajor: number;
		httpVersionMinor: number;
		url: string;
		method: string;
		socket: HttpSocket;
	}

	export interface HttpSocket {
		remoteAddress: string;
	}

	export interface TailOptions {
		pollInterval?: number;
	}

	export interface ErrorInfo {
		stack?: string;
		value?: string;
		properties: Record<string, unknown>;
		debug: DebugLogEntry[];
	}

	export interface DebugLogEntry {
		timestamp: number;
		data: unknown;
	}

	export interface SaveToCache {
		(byteOffset: number, data: Uint8Array): void;
	}

	export enum LogType {
		REQUEST = 1,
		REQUEST_META = 2,
		RESPONSE = 3,
		RESPONSE_FINISHED = 4,
		LOG = 5,
		LIFECYCLE = 6,
		UNCAUGHT_EXCEPTION = 7,
	}

	export enum LogLevel {
		CRITICAL = 2,
		ERROR = 4,
		WARN = 5,
		INFO = 6,
		INTERNAL = 8,
	}

	export enum Lifecycle {
		WORKER_STARTED = 1,
		WORKER_GOING_ONLINE = 2,
		WORKER_ONLINE = 3,
		WORKER_GOING_OFFLINE = 4,
		WORKER_OFFLINE = 5,
		WORKER_DONE = 6,
		WORKER_PING = 7,
		STARTING_UP = 8,
		STARTING_UP_COMPLETED = 9,
		SHUTTING_DOWN = 10,
		SHUTTING_DOWN_COMPLETED = 11,
		WORKER_SPAWNED = 12,
		WORKER_EXITED = 13,
		MASTER_PING = 14,
	}

	export enum HttpMethod {
		GET = 1,
		HEAD = 2,
		POST = 3,
		PUT = 4,
		PATCH = 5,
		DELETE = 6,
		OPTIONS = 7,
		TRACE = 8,
		CONNECT = 9,
	}
}

export = SuperServerLogs;
