# API for writing logs

- [class `LogManager`](#class-logmanager)
	- [`new LogManager(dirname[, options])`](#new-logmanagerdirname-options)
	- [event `'rotate'`](#event-rotate)
	- [event `'error'`](#event-error)
	- [`manager.close()`](#managerclose)
	- [`manager.closed`](#managerclosed)
	- [`manager.dirname`](#managerdirname)
	- [`manager.filename`](#managerfilename)
- [class `MasterLogger`](#class-masterlogger)
	- [`new MasterLogger(filename[, options])`](#new-masterloggerfilename-options)
	- [Master logging methods](#master-logging-methods)
	- [`masterLogger.flush()`](#masterloggerflush)
	- [`masterLogger.rotate(filename)`](#masterloggerrotatefilename)
	- [`masterLogger.close()`](#masterloggerclose)
	- [`masterLogger.closed`](#masterloggerclosed)
- [class `WorkerLogger`](#class-workerlogger)
	- [`new WorkerLogger(filename[, options])`](#new-masterloggerfilename-options)
	- [Worker logging methods](#worker-logging-methods)
	- [`workerLogger.newRequest()`](#workerloggernewrequest)
	- [`workerLogger.flush()`](#workerloggerflush)
	- [`workerLogger.rotate(filename)`](#workerloggerrotatefilename)
	- [`workerLogger.close()`](#workerloggerclose)
	- [`workerLogger.closed`](#workerloggerclosed)
- [class `RequestLogger`](#class-requestlogger)
	- [Request logging methods](#request-logging-methods)
	- [`requestLogger.closed`](#requestloggerclosed)
	- [`requestLogger.requestId`](#requestloggerrequestid)

# *class* LogManager

This class faciliates log rotation. It should be used within the master process of your [server cluster](https://nodejs.org/api/cluster.html). It keeps track of log files within a directory, detects when the log files get too big or too old, and deletes the oldest files when necessary. It also provides the filenames that your loggers should write to.

LogManager is a subclass of [EventEmitter][EventEmitter].

### new LogManager(dirname[, options])

- `dirname` [&lt;string&gt;][string] The path of the log directory.
- `options` [&lt;Object&gt;][Object]
	- `pollInterval` [&lt;number&gt;][number] The delay, in milliseconds, between each poll to the filesystem. This controls how frequently it tries to detect oversized or outdated log files. **Default:** `5000`.
	- `logSizeLimit` [&lt;number&gt;][number] The total maximum size (in bytes) of all logs in the directory. The oldest logs in the directory will be automatically deleted to keep the log size below this limit. **Default:** `2147483648` (2 GiB).
	- `logAgeLimit` [&lt;number&gt;][number] The maximum age, in milliseconds, that logs are allowed to have. Logs that are too old will be automatically deleted. **Default:** `31536000000` (1 year).
	- `granularity` [&lt;number&gt;][number] The granularity that is used to enforce `logSizeLimit` and `logAgeLimit` (see below for details). **Default:** `20`.

If the given `dirname` does not yet exist, it is created.

LogManager is able to enforce `logSizeLimit` and `logAgeLimit` by simply unlinking files on the filesystem, without needing to actually move any data around. This is possible because all loggers are periodically instructed to switch to new log files, thus splitting the logs into many small-ish files.

The `granularity` option controls how much splitting occurs. For example, if `logAgeLimit` is 10 months and `granularity` is 10, then each log file would span no more than 1 month. Increasing the granularity increases the number of log files that will created, but also improves the precision of the `logSizeLimit` and `logAgeLimit` options. These limits are expected to have an error of approximately `±1 / granularity`. For example, with the default granularity of `20`, the expected error is `±5%`. Thus, with a `logSizeLimit` of 2 GiB, you should expect the logs to grow to 2.1 GiB, and possibly more depending on how many logs can be written before the `pollInterval` detects them.

### *event* `'rotate'`

- `filename` [&lt;string&gt;][string] The path of the new log file that should be used by all loggers.

This event is emitted when the LogManager wants you to change the file that all loggers are writing to. You should first call [`.rotate(filename)`](#masterloggerrotatefilename) on the [MasterLogger](#class-masterlogger), *and then* call [`.rotate(filename)`](#workerloggerrotatefilename) on each [WorkerLogger](#class-workerlogger). You'll need to utilize [IPC](https://nodejs.org/api/cluster.html#workersendmessage-sendhandle-options-callback) to send this instruction from the master process to each worker process.

### *event* `'error'`

- `error` [&lt;Error&gt;][Error]

This event indicates that an error occurred during some filesystem operation. Despite this, the LogManager will continue trying to function until explicitly [closed](#managerclose).

### manager.close()

Closes the LogManager. All operations are stopped and no more events will be emitted.

### manager.closed

- [&lt;boolean&gt;][boolean]

Indicates whether or not the LogManager is closed.

### manager.dirname

- [&lt;string&gt;][string]

The file path of the log directory being managed.

### manager.filename

The file path of the current log file that all loggers should be writing to.

# *class* MasterLogger

This is the logger used by the [server cluster's](https://nodejs.org/api/cluster.html) master process. It internally maintains state that is necessary for writing well-formed logs, so only one instance should be used for the entire lifespan of the master process.

### new MasterLogger(filename[, options])

- `filename` [&lt;string&gt;][string] The path of the log file.
- `options` [&lt;Object&gt;][Object]
	- `highWaterMark` [&lt;number&gt;][number] The maximum amount of data (in bytes) that can be buffered before being flushed. **Default:** `32768` (32 KiB).
	- `outputDelay` [&lt;number&gt;][number] The maximum amount of time (in milliseconds) that data can be buffered for, before being flushed. **Default:** `200`.
	- `compression` [&lt;boolean&gt;][boolean] Whether or not to compress logs. Compressing saves disk space but lowers the throughput of reading logs. **Default:** `true`.
	- `pingDelay` [&lt;number&gt;][number] How often an internal "ping" should be written to the logs (see below). **Default:** `60000`.
	- `debugLogLimit` [&lt;number&gt;][number] The maixmum number of DEBUG logs to keep in memory before discarding the oldest ones. DEBUG logs are kept in memory so they can be conditionally logged if/when an error occurs. **Default:** `100`.

If the given `filename` does not yet exist, it is created.

The `highWaterMark` and `outputDelay` options control how logs are batched. If either of these options are set to `0`, batching will be disabled, which drastically reduces the performance of logging.

Most applications shouldn't have to worry about the `pingDelay` option. Internally, "pings" are emitted by loggers periodically to record the current state of the server cluster. When reading logs, this information is used internally to prove timestamp bounds without needing to read every single log. By default, these pings amount to a few bytes being written every 60 seconds, which should be negligible to most applications. Increasing the `pingDelay` can save a little disk space, but will likely negatively impact the performance of reading logs. By contrast, decreasing the `pingDelay` results in more disk space being used, but may improve the performance of reading logs, particularly if your application writes many logs per second.

### Master logging methods

- `masterLogger.STARTING_UP()`: This MUST be the first thing logged whenever a master process first starts up.
- `masterLogger.STARTING_UP_COMPLETED()`: This SHOULD be logged after all workers have been spawned, and their HTTP servers have all been started.
- `masterLogger.SHUTTING_DOWN()`: This SHOULD be logged when the master process wants to initiate a graceful shutdown procedure, but before any workers have been instructed to shut down.
- `masterLogger.SHUTTING_DOWN_COMPLETED()`: This SHOULD be logged after the master process finishes shutting down, and all workers have exited (regardless of whether the shutdown was actually graceful).
- `masterLogger.WORKER_SPAWNED(workerId)`: This MUST be logged whenever the master process spawns a new worker process.
- `masterLogger.WORKER_EXITED(workerId, exitCode[, signal])`: This MUST be logged whenever the master process detects that a worker process has exited.
- `masterLogger.UNCAUGHT_EXCEPTION(error)`: This SHOULD be logged whenever an uncaught exception is detected within the master process.
- `masterLogger.critical(data)`: This writes a CRITICAL-level log.
- `masterLogger.error(data)`: This writes an ERROR-level log.
- `masterLogger.warn(data)`: This writes a WARN-level log.
- `masterLogger.info(data)`: This writes an INFO-level log.
- `masterLogger.debug(data)`: This buffers a DEBUG-level log, which will be written if/when the next UNCAUGHT_EXCEPTION log is written.

### masterLogger.flush()

Flushes the logger's internal buffer, writing the logs to the filesystem. This happens synchronously, so it can be used within [`process.on('exit')`](https://nodejs.org/api/process.html#event-exit).

### masterLogger.rotate(filename)

Changes the logger's file to the new `filename`. This happens synchronously.

### masterLogger.close()

Closes the logger, flushing any remaining logs to the filesystem. This happens synchronously, so it can be used within [`process.on('exit')`](https://nodejs.org/api/process.html#event-exit).

### masterLogger.closed

- [&lt;boolean&gt;][boolean]

Indicates whether or not the logger is closed.

# *class* WorkerLogger

This is the logger used by each worker process within a [server cluster](https://nodejs.org/api/cluster.html). Each worker process should only have one WorkerLogger.

### new WorkerLogger(filename[, options])

- `filename` [&lt;string&gt;][string] The path of the log file.
- `options` [&lt;Object&gt;][Object]
	- `highWaterMark` [&lt;number&gt;][number] The maximum amount of data (in bytes) that can be buffered before being flushed. **Default:** `32768` (32 KiB).
	- `outputDelay` [&lt;number&gt;][number] The maximum amount of time (in milliseconds) that data can be buffered for, before being flushed. **Default:** `200`.
	- `compression` [&lt;boolean&gt;][boolean] Whether or not to compress logs. Compressing saves disk space but lowers the throughput of reading logs. **Default:** `true`.
	- `debugLogLimit` [&lt;number&gt;][number] The maixmum number of DEBUG logs to keep in memory before discarding the oldest ones. DEBUG logs are kept in memory so they can be conditionally logged if/when an error occurs. **Default:** `100`.

If the given `filename` does not yet exist, it is created.

The `highWaterMark` and `outputDelay` options control how logs are batched. If either of these options are set to `0`, batching will be disabled, which drastically reduces the performance of logging.

### Worker logging methods

- `workerLogger.WORKER_STARTED()`: This SHOULD be logged when the worker process starts, before starting its HTTP server or performing its setup procedure (if any).
- `workerLogger.WORKER_GOING_ONLINE()`: This SHOULD be logged after the worker process completes its setup procedure (if any), but before starting its HTTP server.
- `workerLogger.WORKER_ONLINE()`: This SHOULD be logged when the worker process successfully starts its HTTP server.
- `workerLogger.WORKER_GOING_OFFLINE()`: This SHOULD be logged when the worker process wants to initiate a graceful shutdown procedure.
- `workerLogger.WORKER_OFFLINE()`: This SHOULD be logged when the worker process has successfully shut down its HTTP server (regardless of whether the shutdown was actually graceful) and all connections/requests have ended, but before performing its teardown procedure (if any).
- `workerLogger.WORKER_DONE()`: This SHOULD be logged after the worker process completes its teardown procedure (if any).
- `workerLogger.UNCAUGHT_EXCEPTION(error)`: This SHOULD be logged whenever an uncaught exception is detected within the worker process.
- `workerLogger.critical(data)`: This writes a CRITICAL-level log.
- `workerLogger.error(data)`: This writes an ERROR-level log.
- `workerLogger.warn(data)`: This writes a WARN-level log.
- `workerLogger.info(data)`: This writes an INFO-level log.
- `workerLogger.debug(data)`: This buffers a DEBUG-level log, which will be written if/when the next UNCAUGHT_EXCEPTION log is written.

### workerLogger.newRequest()

- Returns: [&lt;RequestLogger&gt;][RequestLogger]

Creates a new [RequestLogger][RequestLogger]. Each RequestLogger is assigned a unique `requestId` which can be used to uniquely identify the request.

### workerLogger.flush()

Flushes the logger's internal buffer, writing the logs to the filesystem. This happens synchronously, so it can be used within [`process.on('exit')`](https://nodejs.org/api/process.html#event-exit).

### workerLogger.rotate(filename)

Changes the logger's file to the new `filename`. This happens synchronously.

### workerLogger.close()

Closes the logger, flushing any remaining logs to the filesystem. This happens synchronously, so it can be used within [`process.on('exit')`](https://nodejs.org/api/process.html#event-exit).

### workerLogger.closed

- [&lt;boolean&gt;][boolean]

Indicates whether or not the logger is closed.

# *class* RequestLogger

Whenever a worker process receives an HTTP request, you should use the [WorkerLogger][WorkerLogger] to spawn a new RequestLogger, and then use that RequestLogger for all request-related activity. Each HTTP request should have its own RequestLogger.

### Request logging methods

- `requestLogger.REQUEST(req)`: This SHOULD be logged when the associated HTTP request is first received by the server. Only the request's "head" needs to be received; the request body may still be pending.
- `requestLogger.REQUEST_META(data)`: This can be logged to associate arbitrary application-specific metadata to the request.
- `requestLogger.RESPONSE(statusCode[, error])`: This SHOULD be logged when a response is sent for the associated HTTP request. Only the response's "head" needs to be sent; the response body may still be pending. Passing an `error` indicates that an unexpected error occurred while trying to handle the request.
- `requestLogger.RESPONSE_FINISHED([error])`: This SHOULD be logged when the response body is done being sent (even if the response body was empty). Passing an `error` indicates that an unexpected error occurred while trying to send the response body, but after the response's "head" was already sent.
- `requestLogger.critical(data)`: This writes a CRITICAL-level log.
- `requestLogger.error(data)`: This writes an ERROR-level log.
- `requestLogger.warn(data)`: This writes a WARN-level log.
- `requestLogger.info(data)`: This writes an INFO-level log.
- `requestLogger.debug(data)`: This buffers a DEBUG-level log, which will be written if/when the next RESPONSE or RESPONSE_FINISHED log is written with an `error` passed to it.

### requestLogger.closed

- [&lt;boolean&gt;][boolean]

Indicates whether or not the logger is closed. This value will always be equal to that of the associated [WorkerLogger][WorkerLogger].

### requestLogger.requestId

- [&lt;string&gt;][string]

A [UUIDv4](https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)) that can be used to uniquely identify the associated HTTP request.



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
[EventEmitter]: https://nodejs.org/api/events.html#class-eventemitter
[WorkerLogger]: #class-workerlogger
[RequestLogger]: #class-requestlogger
