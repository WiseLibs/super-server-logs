# API for reading logs

- [class `LogReader`](#class-logreader)
	- [`new LogReader(source)`](#new-logreadersource)
	- [`reader.tail([minTimestamp[, options]])`](#readertailmintimestamp-options)
	- [`reader.range(minTimestamp, maxTimestamp)`](#readerrangemintimestamp-maxtimestamp)
	- [`reader.rangeReversed(minTimestamp, maxTimestamp)`](#readerrangereversedmintimestamp-maxtimestamp)
	- [`reader.bulkTail([minTimestamp[, options]])`](#readerbulktailmintimestamp-options)
	- [`reader.bulkRange(minTimestamp, maxTimestamp)`](#readerbulkrangemintimestamp-maxtimestamp)
	- [`reader.bulkRangeReversed(minTimestamp, maxTimestamp)`](#readerbulkrangereversedmintimestamp-maxtimestamp)
- [class `LogEntry`](#class-logentry)
	- [`log.getRequestId()`](#loggetrequestid)
	- [`log.getIpAddress()`](#loggetipaddress)
	- [`log.getHttpVersion()`](#loggethttpversion)
	- [`log.getHttpMethod()`](#loggethttpmethod)
	- [`log.getError()`](#loggeterror)
	- [`log.toJSON()`](#logtojson)
- [namespace `BulkParser`](#class-bulkparser)
	- [`BulkParser.read(chunks)`](#bulkparserreadchunks)
	- [`BulkParser.readReversed(chunks)`](#bulkparserreadreversedchunks)
	- [`BulkParser.parse(block)`](#bulkparserparseblock)
- [class `LogDirectorySource`](#class-logdirectorysource)
	- [`new LogDirectorySource(dirname[, options])`](#new-logdirectorysourcedirname-options)
- [class `Vfs`](#class-vfs)
	- [`new Vfs(options)`](#new-vfsoptions)
- [enum `LogType`](#enum-logtype)
- [enum `LogLevel`](#enum-loglevel)
- [enum `Lifecycle`](#enum-lifecycle)
- [enum `HttpMethod`](#enum-httpmethod)

# *class* LogReader

This class is the primary interface used to read logs. Logs are stored in an efficient binary format, so they can't be read directly by humans.

LogReader supports two main ways of reading logs:

- Reading a **range** of logs, between a minimum and maximum timestamp.
- Reading the **tail** of logs, which means reading the latest logs in real-time, as they are written.

### new LogReader(source)

- `source` [&lt;Vfs&gt;][Vfs] The source from which to read logs. In most cases this will be a [LogDirectorySource][LogDirectorySource], which reads logs from files within a log directory.

```js
const dirname = './logs';
const reader = new LogReader(new LogDirectorySource(dirname));
```

### reader.tail([minTimestamp[, options]])

- `minTimestamp` [&lt;number&gt;][number] The minimum timestamp (inclusive). This indicates where to start reading from. **Default:** `Date.now()`.
- `options` [&lt;Object&gt;][Object]
	- `pollInterval` [&lt;number&gt;][number] The delay, in milliseconds, between each poll to the underlying log source (i.e., the filesystem). This controls how frequently new logs can be detected.
- Returns: [&lt;AsyncIterable][AsyncIterable][&lt;LogEntry&gt;][LogEntry][&gt;][AsyncIterable]

Yields all logs with a timestamp greater than or equal to `minTimestamp`. New logs will be yielded indefinitely, until the returned [AsyncIterable][AsyncIterable] is stopped (i.e., by a `break` statement).

Logs are yielded in ascending order (older logs first).

> Note that logs are only ordered chronologically when compared to logs written by the same process. In other words, logs written by different workers in a [server cluster](https://nodejs.org/api/cluster.html) are not guaranteed to be in exact chronological order.

```js
for await (const log of reader.tail()) {
	console.log(log.timestamp);
}
```

### reader.range(minTimestamp, maxTimestamp)

- `minTimestamp` [&lt;number&gt;][number] The minimum timestamp (inclusive). This indicates where to start reading from.
- `maxTimestamp` [&lt;number&gt;][number] The maximum timestamp (inclusive). This indicates when to stop reading.
- Returns: [&lt;AsyncIterable][AsyncIterable][&lt;LogEntry&gt;][LogEntry][&gt;][AsyncIterable]

Yields all logs with a timestamp greater than or equal to `minTimestamp`, and less than or equal to `maxTimestamp`.

Logs are yielded in ascending order (older logs first).

> Note that logs are only ordered chronologically when compared to logs written by the same process. In other words, logs written by different workers in a [server cluster](https://nodejs.org/api/cluster.html) are not guaranteed to be in exact chronological order.

```js
const DAY = 1000 * 60 * 60 * 24;

for await (const log of reader.range(Date.now() - DAY, Date.now())) {
	console.log(log.timestamp);
}
```

### reader.rangeReversed(minTimestamp, maxTimestamp)

- `minTimestamp` [&lt;number&gt;][number] The minimum timestamp (inclusive). This indicates when to stop reading.
- `maxTimestamp` [&lt;number&gt;][number] The maximum timestamp (inclusive). This indicates where to start reading from.
- Returns: [&lt;AsyncIterable][AsyncIterable][&lt;LogEntry&gt;][LogEntry][&gt;][AsyncIterable]

This is the same as [`reader.range()`](#readerrangemintimestamp-maxtimestamp), except the logs are yielded in the reverse order (newer logs first).

> Note that logs are only ordered chronologically when compared to logs written by the same process. In other words, logs written by different workers in a [server cluster](https://nodejs.org/api/cluster.html) are not guaranteed to be in exact chronological order.

```js
const DAY = 1000 * 60 * 60 * 24;

for await (const log of reader.rangeReversed(Date.now() - DAY, Date.now())) {
	console.log(log.timestamp);
}
```

### reader.bulkTail([minTimestamp[, options]])

- `minTimestamp` [&lt;number&gt;][number] The minimum timestamp (inclusive). This indicates where to start reading from. **Default:** `Date.now()`.
- `options` [&lt;Object&gt;][Object]
	- `pollInterval` [&lt;number&gt;][number] The delay, in milliseconds, between each poll to the underlying log source (i.e., the filesystem). This controls how frequently new logs can be detected. **Default:** `200`.
- Returns: [&lt;AsyncIterable][AsyncIterable][&lt;Buffer&gt;][Buffer][&gt;][AsyncIterable]

Yields chunks of raw binary logs, such that the chunks include all logs with a timestamp greater than or equal to `minTimestamp`. Newly written chunks will be yielded indefinitely, until the returned [AsyncIterable][AsyncIterable] is stopped (i.e., by a `break` statement).

All "bulk" methods (including this one) may include logs outside the specified timestamp bounds. The only guarantee is that no logs *within* bounds will be missing. The bulk methods provide an efficient way of piping logs to an external system (perhaps over a network). On the receiving end, [BulkParser][BulkParser] can be used to parse the raw chunks into [LogEntry][LogEntry]s.

Logs are yielded in ascending order (older logs first).

> Note that logs are only ordered chronologically when compared to logs written by the same process. In other words, logs written by different workers in a [server cluster](https://nodejs.org/api/cluster.html) are not guaranteed to be in exact chronological order.

```js
for await (const chunk of reader.bulkTail()) {
	socket.write(chunk);
}
```

### reader.bulkRange(minTimestamp, maxTimestamp)

- `minTimestamp` [&lt;number&gt;][number] The minimum timestamp (inclusive). This indicates where to start reading from.
- `maxTimestamp` [&lt;number&gt;][number] The maximum timestamp (inclusive). This indicates when to stop reading.
- Returns: [&lt;AsyncIterable][AsyncIterable][&lt;Buffer&gt;][Buffer][&gt;][AsyncIterable]

Yields chunks of raw binary logs, such that the chunks include all logs with a timestamp greater than or equal to `minTimestamp`, and less than or equal to `maxTimestamp`.

All "bulk" methods (including this one) may include logs outside the specified timestamp bounds. The only guarantee is that no logs *within* bounds will be missing. The bulk methods provide an efficient way of piping logs to an external system (perhaps over a network). On the receiving end, [BulkParser][BulkParser] can be used to parse the raw chunks into [LogEntry][LogEntry]s.

Logs are yielded in ascending order (older logs first).

> Note that logs are only ordered chronologically when compared to logs written by the same process. In other words, logs written by different workers in a [server cluster](https://nodejs.org/api/cluster.html) are not guaranteed to be in exact chronological order.

```js
const DAY = 1000 * 60 * 60 * 24;

for await (const chunk of reader.bulkRange(Date.now() - DAY, Date.now())) {
	socket.write(chunk);
}
```

### reader.bulkRangeReversed(minTimestamp, maxTimestamp)

- `minTimestamp` [&lt;number&gt;][number] The minimum timestamp (inclusive). This indicates when to stop reading.
- `maxTimestamp` [&lt;number&gt;][number] The maximum timestamp (inclusive). This indicates where to start reading from.
- Returns: [&lt;AsyncIterable][AsyncIterable][&lt;Buffer&gt;][Buffer][&gt;][AsyncIterable]

This is the same as [`reader.bulkRange()`](#readerbulkrangemintimestamp-maxtimestamp), except the logs are yielded in the reverse order (newer logs first).

> Note that logs are only ordered chronologically when compared to logs written by the same process. In other words, logs written by different workers in a [server cluster](https://nodejs.org/api/cluster.html) are not guaranteed to be in exact chronological order.

```js
const DAY = 1000 * 60 * 60 * 24;

for await (const chunk of reader.bulkRangeReversed(Date.now() - DAY, Date.now())) {
	socket.write(chunk);
}
```

# *class* LogEntry

This class represents individual log entries. Every LogEntry has the following properties:

- `log.timestamp` [&lt;number&gt;][number] A millisecond unix timestamp indicating when the log was written.
- `log.nonce` [&lt;number&gt;][number] An unsigned 16-bit integer. Logs can be uniquely identified by combining their `timestamp`, `nonce`, and `workerId`.
- `log.level` [&lt;number&gt;][number] The log level. Possible values are defined by the [LogLevel](#enum-loglevel) enum.
- `log.type` [&lt;number&gt;][number] The log type. Possible values are defined by the [LogType](#enum-logtype) enum.
- `log.workerId`: [&lt;number&gt;][number] | [&lt;null&gt;][null] The ID of the worker that wrote this log. A value of `null` indicates that it was written by the master process of the [server cluster](https://nodejs.org/api/cluster.html).

Additional properties depend on the log's [type](#enum-logtype):

- `log.type === LogType.REQUEST`:
	- `log.requestId` [&lt;Buffer&gt;][Buffer] A 16-byte [UUIDv4](https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)) used to uniquely identify an HTTP request.
	- `log.httpVersionMajor` [&lt;number&gt;][number] The first integer of the request's HTTP version.
	- `log.httpVersionMinor` [&lt;number&gt;][number] The second integer of the request's HTTP version.
	- `log.ipAddress` [&lt;number&gt;][number] | [&lt;Buffer&gt;][Buffer] Either the [IPv4 address](https://en.wikipedia.org/wiki/Internet_Protocol_version_4) as an unsigned 32-bit integer, or the [IPv6 address](https://en.wikipedia.org/wiki/IPv6) as a 16-byte [&lt;Buffer&gt;][Buffer].
	- `log.method` [&lt;number&gt;][number] | [&lt;string&gt;][string] Either a well-known HTTP method defined by the [HttpMethod](#enum-httpmethod) enum, or an unrecognized HTTP method as a literal string.
	- `log.url` [&lt;string&gt;][string] The URL that was sent in the request's header ([`req.url`](https://nodejs.org/api/http.html#messageurl)).
- `log.type === LogType.REQUEST_META`:
	- `log.requestId` [&lt;Buffer&gt;][Buffer] A 16-byte [UUIDv4](https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)) used to uniquely identify an HTTP request.
	- `log.data` [&lt;string&gt;][string] Application-specific metadata that was associated with a request, stored as stringified JSON.
- `log.type === LogType.RESPONSE`:
	- `log.requestId` [&lt;Buffer&gt;][Buffer] A 16-byte [UUIDv4](https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)) used to uniquely identify an HTTP request.
	- `log.statusCode` [&lt;number&gt;][number] The status code used to respond to the request.
	- `log.error` [&lt;string&gt;][string] | [&lt;null&gt;][null] Details describing an exception that occured while trying to handle the request. To get a human-readable version, use [`log.getError()`](#loggeterror).
- `log.type === LogType.RESPONSE_FINISHED`:
	- `log.requestId` [&lt;Buffer&gt;][Buffer] A 16-byte [UUIDv4](https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)) used to uniquely identify an HTTP request.
	- `log.error` [&lt;string&gt;][string] | [&lt;null&gt;][null] Details describing an exception that occured after responding to a request, but before the response stream was finished. To get a human-readable version, use [`log.getError()`](#loggeterror).
- `log.type === LogType.LOG`:
	- `log.requestId` [&lt;Buffer&gt;][Buffer] | [&lt;null&gt;][null] A 16-byte [UUIDv4](https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)) used to uniquely identify an HTTP request. A value of `null` is used for logs that are not associated with a request.
	- `log.data` [&lt;string&gt;][string] The logged data, stored as stringified JSON.
- `log.type === LogType.LIFECYCLE`:
	- `log.event` [&lt;number&gt;][number] The type of lifecycle event that occured. Possible values are defined by the [Lifecycle](#enum-lifecycle) enum.
	- Additional properties for `log.event === Lifecycle.WORKER_EXITED`:
		- `log.exitCode` [&lt;number&gt;][number] The exit code of the worker process.
		- `log.signal` [&lt;string&gt;][string] | [&lt;null&gt;][null] The POSIX signal that terminated the worker process (if any).
- `log.type === LogType.UNCAUGHT_EXCEPTION`:
	- `log.error` [&lt;string&gt;][string] Details describing an uncaught exception that occured within the process. To get a human-readable version, use [`log.getError()`](#loggeterror).

### log.getRequestId()

- Returns: [&lt;string&gt;][string]

Returns the [UUIDv4](https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)) `log.requestId` converted to a string.

### log.getIpAddress()

- Returns: [&lt;string&gt;][string]

Returns the [IPv4](https://en.wikipedia.org/wiki/Internet_Protocol_version_4) or [IPv6](https://en.wikipedia.org/wiki/IPv6) address `log.ipAddress` converted to a string.

### log.getHttpVersion()

- Returns: [&lt;string&gt;][string]

Returns the HTTP version (`log.httpVersionMajor` and `log.httpVersionMajor`) converted to a string such as `"1.1"` or `"2.0"`.

### log.getHttpMethod()

- Returns: [&lt;string&gt;][string]

Returns the HTTP method `log.method` converted to a string.

### log.getError()

- Returns: [&lt;Object&gt;][Object]
	- `stack` [&lt;string&gt;][string] | [&lt;undefined&gt;][undefined] The stack trace of the thrown exception. If the exception was not an [Error][Error], this will be undefined.
	- `value` [&lt;string&gt;][string] | [&lt;undefined&gt;][undefined] The thrown exception converted to a string. If the exception was an [Error][Error], this will be undefined.
	- `properties` [&lt;Object&gt;][Object] Additional key-value pairs that were found on the thrown exception.
	- `debug` [&lt;Array][Array][&lt;Object&gt;][Object][&gt;][Array] An array of DEBUG logs that were written prior to the exception being thrown.
		- `timestamp` [&lt;number&gt;][number] A millisecond unix timestamp indicating when the DEBUG log was written.
		- `data` [&lt;string&gt;][string] The logged data, stored as stringified JSON.

Returns an object that describes an exception that was thrown. The object will either have a `stack` or `value` property, but never both. If any DEBUG logs were written prior to the exception being thrown, they will be included in the returned object.

### log.toJSON()

- Returns: [&lt;Object&gt;][Object]

Returns a JSON-compatible representation of the LogEntry.

# *namespace* BulkParser

### BulkParser.read(chunks)

- `chunks` [&lt;AsyncIterable][AsyncIterable][&lt;Buffer&gt;][Buffer][&gt;][AsyncIterable] A "bulk" stream of raw binary logs.
- Returns: [&lt;AsyncIterable][AsyncIterable][&lt;Buffer&gt;][Buffer][&gt;][AsyncIterable]

Given an [AsyncIterable][AsyncIterable] containing chunks of raw binary logs (such as one returned by [`reader.bulkTail()`](#readerbulktailmintimestamp-options) or [`reader.bulkRange()`](#readerbulkrangemintimestamp-maxtimestamp)), this returns an [AsyncIterable][AsyncIterable] that yields well-formed "log blocks". These blocks can subsequently be parsed by [`BulkParser.parse(block)`](#bulkparserparseblock) to extract the [LogEntry][LogEntry]s.

```js
for await (const block of BulkParser.read(rawChunks)) {
	for (const log of BulkParser.parse(block)) {
		console.log(log.timestamp);
	}
}
```

### BulkParser.readReversed(chunks)

- `chunks` [&lt;AsyncIterable][AsyncIterable][&lt;Buffer&gt;][Buffer][&gt;][AsyncIterable] A reverse "bulk" stream of raw binary logs.
- Returns: [&lt;AsyncIterable][AsyncIterable][&lt;Buffer&gt;][Buffer][&gt;][AsyncIterable]

Given an [AsyncIterable][AsyncIterable] containing reverse-order chunks of raw binary logs (such as one returned by [`reader.bulkRangeReversed()`](#readerbulktailmintimestamp-options)), this returns an [AsyncIterable][AsyncIterable] that yields well-formed "log blocks". These blocks can subsequently be parsed by [`BulkParser.parse(block)`](#bulkparserparseblock) to extract the [LogEntry][LogEntry]s.

```js
for await (const block of BulkParser.readReversed(rawChunks)) {
	for (const log of BulkParser.parse(block)) {
		console.log(log.timestamp);
	}
}
```

### BulkParser.parse(block)

- `block` [&lt;Buffer&gt;][Buffer] A well-formed "log block".
- Returns: [&lt;Iterable][Iterable][&lt;LogEntry&gt;][LogEntry][&gt;][Iterable]

This is used in conjunction with [`BulkParser.read()`](#bulkparserreadchunks) or [`BulkParser.readReversed()`](#bulkparserreadreversedchunks) to parse a "bulk" log stream.

```js
for await (const block of BulkParser.read(rawChunks)) {
	for (const log of BulkParser.parse(block)) {
		console.log(log.timestamp);
	}
}
```

# *class* LogDirectorySource

Every [LogReader](#class-logreader) needs a source from which to read logs. The most common source is simply the filesystem directory that the logs were written to. LogDirectorySource does exactly that; it allows you to read log files from a directory on the filesystem. This class is not available in the browser.

### new LogDirectorySource(dirname[, options])

- `dirname` [&lt;string&gt;][string] The path of the log directory.
- `options` [&lt;Object&gt;][Object]
	- `cacheSize` [&lt;number&gt;][number] The maximum amount of filesystem data (in bytes) to cache in memory at any given time. **Default:** `16777216` (16 MiB).
	- `pollInterval` [&lt;number&gt;][number] | [&lt;null&gt;][null] The delay, in milliseconds, between each poll to the filesystem. This controls how frequently new logs can be detected. **Default:** `null`.
	- `lazy` [&lt;boolean&gt;][boolean] If `true`, files are only kept open while they are being actively read. **Default:** `false`.
	- `immutable` [&lt;boolean&gt;][boolean] If `true`, some optimizations will be enabled. Only use this if no live server is writing to the logs. **Default:** `false`.

By default, logs are read from a single snapshot in time. To support tailing, the `pollInterval` option must be set, which allows the LogDirectorySource to periodically detect new logs being written.

By default, all log files in the directory are opened eagerly, which prevents the logs from being deleted (e.g., by log rotation) while a read operation is in progress. This might be undesirable if you're tailing the logs for a very long time. In such situations, you can set the `lazy` option to `true`, which causes files to only be opened while they are being actively read. In this mode, attempting to read old logs which have been deleted will cause an exception to be thrown.

By default, the LogDirectorySource assumes that a live server might be actively writing to the logs. Some extra book-keeping is required to maintain correctness in such a situation. If you're sure that no live server is writing to the logs, you can set the `immutable` option to true, which allows the LogDirectorySource to avoid some unnecessary work.

```js
const dirname = './logs';
const reader = new LogReader(new LogDirectorySource(dirname, {
	lazy: true,
	pollInterval: 200,
}));

for await (const log of reader.tail(Date.now())) {
	console.log(log.timestamp);
}
```

# *class* Vfs

Instead of using [LogDirectorySource][LogDirectorySource], you can read logs from any arbitrary source by creating your own implementation of Vfs. For example, this could allow you to read raw binary logs in a browser.

To learn how to implement a Vfs, see the [source code]('../src/shared/vfs.js').

# *enum* LogType

- `LogType.REQUEST`: This log indicates that an HTTP request was received. This log is only concerned with the HTTP request's "head"; the request body may still be pending.
- `LogType.REQUEST_META`: This log contains application-specific metadata that was associated with an HTTP request.
- `LogType.RESPONSE`: This log indicates that an HTTP response was sent. This log is only concerned with the response's "head"; the response body may still be pending.
- `LogType.RESPONSE_FINISHED`: This log indicates that an HTTP response's body is done being sent (sucessfully or not).
- `LogType.LOG`: This is an ad-hoc log with arbitrary data (analogous to `console.log()`).
- `LogType.LIFECYCLE`: This log indicates that a lifecycle event occured within the [server cluster's](https://nodejs.org/api/cluster.html) master process or one of its worker processes.
- `LogType.UNCAUGHT_EXCEPTION`: This log indicates that an uncaught exception was thrown within the [server cluster's](https://nodejs.org/api/cluster.html) master process or one of its worker processes.

# *enum* LogLevel

- `LogType.CRITICAL`: This log represents a critical error that prevented the application from functioning even at a basic level.
- `LogType.ERROR`: This log represents an unexpected error that prevented a user action from being satisfied.
- `LogType.WARN`: This log represents an unexpected condition that doesn't directly impact the user, but may warrant some investigation by the application developer.
- `LogType.INFO`: This log represents normal application behavior that has long-term value (if it didn't have value, it wouldn't be logged).
- `LogType.INTERNAL`: This log is used by the logging system itself (e.g., for maintaining correctness in concurrent situations), but otherwise has no actual value.

Note that there's no DEBUG level. That's because DEBUG logs are only *conditionally* written (retroactively) when an error actually occurs. As such, DEBUG logs are not written as part of the main log stream, but are instead nested within the log that contains the error.

> Currently, there are three log types capable of containing error information (and thus containing DEBUG logs): `RESPONSE`, `RESPONSE_FINISHED`, and `UNCAUGHT_EXCEPTION`.

# *enum* Lifecycle

All logs that have `log.type === LogType.LIFECYCLE` additionally have an `event` property, indicating the lifecycle event that has occured:

- `Lifecycle.STARTING_UP`: The master process is starting up, and will soon start spawning workers.
- `Lifecycle.WORKER_SPAWNED`: The master process has spawned a new worker process.
- `Lifecycle.WORKER_STARTED`: A worker process is about to perform its setup procedure.
- `Lifecycle.WORKER_GOING_ONLINE`: A worker process has finished its setup procedure, and is about to start its HTTP server.
- `Lifecycle.WORKER_ONLINE`: A worker process has sucessfully started its HTTP server.
- `Lifecycle.STARTING_UP_COMPLETED`: The master process has finished starting up, and all workers have started their HTTP servers successfully.
- `Lifecycle.SHUTTING_DOWN`: The master process is shutting down, and will soon instruct all workers to gracefully shut down.
- `Lifecycle.WORKER_GOING_OFFLINE`: A worker process is about to gracefully shut down its HTTP server.
- `Lifecycle.WORKER_OFFLINE`: A worker process has gracefully shut down its HTTP server, and is about to perform its teardown procedure.
- `Lifecycle.WORKER_DONE`: A worker process has finished its teardown procedure.
- `Lifecycle.WORKER_EXITED`: The master process has detected that a worker process exited.
- `Lifecycle.SHUTTING_DOWN_COMPLETED`: The master process has finished shutting down, and all workers have exited.
- `Lifecycle.MASTER_PING`: Used internally.
- `Lifecycle.WORKER_PING`: Used internally.

# *enum* HttpMethod

- `HttpMethod.GET`
- `HttpMethod.HEAD`
- `HttpMethod.POST`
- `HttpMethod.PUT`
- `HttpMethod.PATCH`
- `HttpMethod.DELETE`
- `HttpMethod.OPTIONS`
- `HttpMethod.TRACE`
- `HttpMethod.CONNECT`



[any]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Data_types
[undefined]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#undefined_type
[null]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#null_type
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object
[Function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function
[Error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
[Uint8Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
[Iterable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_iterable_protocol
[AsyncIterable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of
[Buffer]: https://nodejs.org/api/buffer.html#class-buffer
[BulkParser]: #class-bulkparser
[LogEntry]: #class-logentry
[LogDirectorySource]: #class-logdirectorysource
[Vfs]: #class-vfs
