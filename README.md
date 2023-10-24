# super-server-logs [![test](https://github.com/WiseLibs/super-server-logs/actions/workflows/test.yml/badge.svg)](https://github.com/WiseLibs/super-server-logs/actions/workflows/test.yml)

This library allows you to read and write server logs. In additional to ad-hoc logging, it provides a standardized way of capturing *request-response pairs* and the lifecycle events of processes within a [server cluster](https://nodejs.org/api/cluster.html).

On the writing side, here are its notable features:

* High throughput, due to batching (batch size and output latency are configurable)
* Time-based and size-based log rotation, with automatic file cleanup (also configurable)
* Built-in compression, resulting in smaller log files (also configurable)
* Capable of flushing logs on process exit/crash (except on `SIGKILL` or power outage)
* Safe to use from multiple threads/processes concurrently
* DEBUG logs are only written when an error occurs
* An efficient binary log format is used, but logs can contain arbitrary JSON data

On the reading side, here are its notable features:

* Quickly identify arbitrary ranges of logs based on timestamp
	* Binary search is used under the hood, making it possible to search billions of logs in milliseconds
* High-throughput "bulk" reading
	* This allows you to select time ranges of logs and efficiently transfer them to external systems
* Browser support for all read-based APIs
* Log entries are represented as user-friendly (parsed) log objects

## Installation

```
npm install super-server-logs
```

> Requires Node.js v18.4.x or later.

# Documentation

- [API documentation for log **writers**](./docs/writers.md)
- [API documentation for log **readers**](./docs/readers.md)

## License

[MIT](./LICENSE)
