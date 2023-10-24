# API for writing logs

- [class `LogManager`](#class-logmanager)
	- [`new LogManager(dirname[, options])`](#new-logmanagerdirname-options)
	- [event `"rotate"`](#eventrotate)
	- [event `"error"`](#eventerror)
	- [`manager.close()`](#managerclose)
	- [`manager.closed`](#managerclosed)
	- [`manager.dirname`](#managerdirname)
	- [`manager.filename`](#managerfilename)
- [class `MasterLogger`](#class-masterlogger)
	- [`new MasterLogger(filename[, options])`](#new-masterloggerfilename-options)
	- [`masterLogger.STARTING_UP()`](#masterloggerstarting_up)
	- [`masterLogger.STARTING_UP_COMPLETED()`](#masterloggerstarting_up_completed)
	- [`masterLogger.SHUTTING_DOWN()`](#masterloggershutting_down)
	- [`masterLogger.SHUTTING_DOWN_COMPLETED()`](#masterloggershutting_down_completed)
	- [`masterLogger.WORKER_SPAWNED(workerId)`](#masterloggerworker_spawnedworkerid)
	- [`masterLogger.WORKER_EXITED(workerId, exitCode[, signal])`](#masterloggerworker_exitedworkerid-exitcode-signal)
	- [`masterLogger.UNCAUGHT_EXCEPTION(error)`](#masterloggeruncaught_exceptionerror)
	- [`masterLogger.critical(data)`](#masterloggercriticaldata)
	- [`masterLogger.error(data)`](#masterloggererrordata)
	- [`masterLogger.warn(data)`](#masterloggerwarndata)
	- [`masterLogger.info(data)`](#masterloggerinfodata)
	- [`masterLogger.debug(data)`](#masterloggerdebugdata)
	- [`masterLogger.flush()`](#masterloggerflush)
	- [`masterLogger.rotate(filename)`](#masterloggerrotatefilename)
	- [`masterLogger.close()`](#masterloggerclose)
	- [`masterLogger.closed`](#masterloggerclosed)
- [class `WorkerLogger`](#class-workerlogger)
	- [`new WorkerLogger(filename[, options])`](#new-masterloggerfilename-options)
	- [`workerLogger.WORKER_STARTED()`](#workerloggerworker_started)
	- [`workerLogger.WORKER_GOING_ONLINE()`](#workerloggerworker_going_online)
	- [`workerLogger.WORKER_ONLINE()`](#workerloggerworker_online)
	- [`workerLogger.WORKER_GOING_OFFLINE()`](#workerloggerworker_going_offline)
	- [`workerLogger.WORKER_OFFLINE()`](#workerloggerworker_offline)
	- [`workerLogger.WORKER_DONE()`](#workerloggerworker_done)
	- [`workerLogger.UNCAUGHT_EXCEPTION(error)`](#workerloggeruncaught_exceptionerror)
	- [`workerLogger.newRequest()`](#workerloggernewrequest)
	- [`workerLogger.critical(data)`](#workerloggercriticaldata)
	- [`workerLogger.error(data)`](#workerloggererrordata)
	- [`workerLogger.warn(data)`](#workerloggerwarndata)
	- [`workerLogger.info(data)`](#workerloggerinfodata)
	- [`workerLogger.debug(data)`](#workerloggerdebugdata)
	- [`workerLogger.flush()`](#workerloggerflush)
	- [`workerLogger.rotate(filename)`](#workerloggerrotatefilename)
	- [`workerLogger.close()`](#workerloggerclose)
	- [`workerLogger.closed`](#workerloggerclosed)
- [class `RequestLogger`](#class-requestlogger)
	- [`requestLogger.REQUEST(req)`](#requestloggerrequestreq)
	- [`requestLogger.REQUEST_META(data)`](#requestloggerrequest_metadata)
	- [`requestLogger.RESPONSE(statusCode[, error])`](#requestloggerresponsestatuscode-error)
	- [`requestLogger.RESPONSE_FINISHED([error])`](#requestloggerresponse_finishederror)
	- [`requestLogger.critical(data)`](#requestloggercriticaldata)
	- [`requestLogger.error(data)`](#requestloggererrordata)
	- [`requestLogger.warn(data)`](#requestloggerwarndata)
	- [`requestLogger.info(data)`](#requestloggerinfodata)
	- [`requestLogger.debug(data)`](#requestloggerdebugdata)
	- [`requestLogger.closed`](#requestloggerclosed)
	- [`requestLogger.requestId`](#requestloggerrequestid)

# class *LogManager*

### new LogManager(dirname[, options])

### event `"rotate"`

### event `"error"`

### manager.close()

### manager.closed

### manager.dirname

### manager.filename

# class *MasterLogger*

### new MasterLogger(filename[, options])

### masterLogger.STARTING_UP()

### masterLogger.STARTING_UP_COMPLETED()

### masterLogger.SHUTTING_DOWN()

### masterLogger.SHUTTING_DOWN_COMPLETED()

### masterLogger.WORKER_SPAWNED(workerId)

### masterLogger.WORKER_EXITED(workerId, exitCode[, signal])

### masterLogger.UNCAUGHT_EXCEPTION(error)

### masterLogger.critical(data)

### masterLogger.error(data)

### masterLogger.warn(data)

### masterLogger.info(data)

### masterLogger.debug(data)

### masterLogger.flush()

### masterLogger.rotate(filename)

### masterLogger.close()

### masterLogger.closed

# class *WorkerLogger*

### new WorkerLogger(filename[, options])

### workerLogger.WORKER_STARTED()

### workerLogger.WORKER_GOING_ONLINE()

### workerLogger.WORKER_ONLINE()

### workerLogger.WORKER_GOING_OFFLINE()

### workerLogger.WORKER_OFFLINE()

### workerLogger.WORKER_DONE()

### workerLogger.UNCAUGHT_EXCEPTION(error)

### workerLogger.newRequest()

### workerLogger.critical(data)

### workerLogger.error(data)

### workerLogger.warn(data)

### workerLogger.info(data)

### workerLogger.debug(data)

### workerLogger.flush()

### workerLogger.rotate(filename)

### workerLogger.close()

### workerLogger.closed

# class *RequestLogger*

### requestLogger.REQUEST(req)

### requestLogger.REQUEST_META(data)

### requestLogger.RESPONSE(statusCode[, error])

### requestLogger.RESPONSE_FINISHED([error])

### requestLogger.critical(data)

### requestLogger.error(data)

### requestLogger.warn(data)

### requestLogger.info(data)

### requestLogger.debug(data)

### requestLogger.closed

### requestLogger.requestId

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
