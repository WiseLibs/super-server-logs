# super-server-logs [![test](https://github.com/WiseLibs/super-server-logs/actions/workflows/test.yml/badge.svg)](https://github.com/WiseLibs/super-server-logs/actions/workflows/test.yml)

This library allows you to read and write server logs. In additional to ad-hoc logging, it provides a standardized way of capturing request-response pairs and the lifecycle of worker processes within a [cluster](https://nodejs.org/api/cluster.html).

* High throughput, due to batching
* Supports time-based and size-based log rotation, with automatic file cleanup
* Capable of flushing logs on process exit/crash (except on `SIGKILL` or power outage)
* Configurable output latency and buffer size
* Arbitrary structured data can be included in the logs (JSON + binary data)
* Safe to use from multiple threads/processes concurrently
* Supports log levels, where DEBUG logs are only logged when an error occurs
* Built-in compression for smaller log files

## Installation

```
npm install super-server-logs
```

> Requires Node.js v18.4.x or later.

## Usage

```js
// TODO
```

## License

[MIT](./LICENSE)
