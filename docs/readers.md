# API for reading logs

- [class `LogReader`](#class-logreader)
	- [`new LogReader(source)`](#new-logreadersource)
	- [`reader.tail(minTimestamp[, options])`](#readertailmintimestamp-options)
	- [`reader.range(minTimestamp, maxTimestamp)`](#readerrangemintimestamp-maxtimestamp)
	- [`reader.rangeReversed(minTimestamp, maxTimestamp)`](#readerrangereversedmintimestamp-maxtimestamp)
	- [`reader.bulkTail(minTimestamp[, options])`](#readerbulktailmintimestamp-options)
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
- [enum `LogType`](#class-logtype)
- [enum `LogLevel`](#class-loglevel)
- [enum `Lifecycle`](#class-lifecycle)
- [enum `HttpMethod`](#class-httpmethod)

# class *LogReader*

### new LogReader(source)

### reader.tail(minTimestamp[, options])

### reader.range(minTimestamp, maxTimestamp)

### reader.rangeReversed(minTimestamp, maxTimestamp)

### reader.bulkTail(minTimestamp[, options])

### reader.bulkRange(minTimestamp, maxTimestamp)

### reader.bulkRangeReversed(minTimestamp, maxTimestamp)

# class *LogEntry*

### log.getRequestId()

### log.getIpAddress()

### log.getHttpVersion()

### log.getHttpMethod()

### log.getError()

### log.toJSON()

# namespace *BulkParser*

### BulkParser.read(chunks)

### BulkParser.readReversed(chunks)

### BulkParser.parse(block)

# class *LogDirectorySource*

### new LogDirectorySource(dirname[, options])

# class *Vfs*

### new Vfs(options)

# enum *LogType*

- `LogType.REQUEST`
- `LogType.REQUEST_META`
- `LogType.RESPONSE`
- `LogType.RESPONSE_FINISHED`
- `LogType.LOG`
- `LogType.LIFECYCLE`
- `LogType.UNCAUGHT_EXCEPTION`

# enum *LogLevel*

- `LogType.CRITICAL`
- `LogType.ERROR`
- `LogType.WARN`
- `LogType.INFO`
- `LogType.INTERNAL`

# enum *Lifecycle*

- `Lifecycle.WORKER_STARTED`
- `Lifecycle.WORKER_GOING_ONLINE`
- `Lifecycle.WORKER_ONLINE`
- `Lifecycle.WORKER_GOING_OFFLINE`
- `Lifecycle.WORKER_OFFLINE`
- `Lifecycle.WORKER_DONE`
- `Lifecycle.WORKER_PING`
- `Lifecycle.STARTING_UP`
- `Lifecycle.STARTING_UP_COMPLETED`
- `Lifecycle.SHUTTING_DOWN`
- `Lifecycle.SHUTTING_DOWN_COMPLETED`
- `Lifecycle.WORKER_SPAWNED`
- `Lifecycle.WORKER_EXITED`
- `Lifecycle.MASTER_PING`

# enum *HttpMethod*

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
