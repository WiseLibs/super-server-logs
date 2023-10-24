# super-server-logs [![test](https://github.com/WiseLibs/super-server-logs/actions/workflows/test.yml/badge.svg)](https://github.com/WiseLibs/super-server-logs/actions/workflows/test.yml)

This library allows you to read and write server logs. In additional to typical ad-hoc logging, it provides a standardized way of capturing **request-response pairs** and **lifecycle events** of processes within a [server cluster](https://nodejs.org/api/cluster.html).

On the writing side, here are its notable features:

* **High throughput**, due to batching (output latency is configurable)
* **Log rotation**, with both size-based and age-based limits, and automatic file cleanup (also configurable)
* **Built-in compression**, resulting in smaller log files (also configurable)
* **Capable of flushing logs** on process exit/crash (except on `SIGKILL` or power outage)
* **Multiple threads/processes** can read and write logs concurrently
* **Retroactive DEBUG logs** are only written when an error occurs
* **Efficient binary log format** is used, but logs can contain arbitrary JSON data

On the reading side, here are its notable features:

* **Built-in binary search**, for quickly searching billions of logs in milliseconds; find logs within a certain time range
* **Built-in log tailing**, for reading/parsing new logs as they are written
* **High-throughput "bulk" reading**, for efficiently piping logs within a certain time range to external systems
* **Browser support** for all read-based APIs

## Installation

```
npm install super-server-logs
```

> Requires Node.js v18.4.x or later.

# Documentation

- [API documentation for log **_writers_**](./docs/writers.md)
- [API documentation for log **_readers_**](./docs/readers.md)

## License

[MIT](./LICENSE)
