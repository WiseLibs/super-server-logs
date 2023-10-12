'use strict';
const { Lifecycle: { STARTING_UP, WORKER_SPAWNED, WORKER_EXITED, MASTER_PING } } = require('./public-enums');

/*
	Given a timestamp and a series of logs, BoundFinder detects when all future
	logs are guaranteed to exceed the given timestamp. It does this by reading
	the logs to understand how many worker processes there are, and then waiting
	until it has detected a log that exceeds the timestamp from every worker,
	plus the master process. This works because each worker/master process is
	expected to regularly emit "ping" logs, creating a reasonable upper limit on
	how many logs need to be scanned before a bound can be guaranteed.

	Each BoundFinder instance must only be used to find an upper OR lower bound,
	but not both. Also, as soon as a bound is detected, the instance must not be
	used anymore.
 */

module.exports = class BoundFinder {
	constructor(timestampBound, state = null) {
		if (!Number.isInteger(timestampBound)) {
			throw new TypeError('Expected timestampBound to be an integer');
		}
		if (!(state instanceof Set) && state !== null) {
			throw new TypeError('Expected state to be a Set or null');
		}
		if (timestampBound < 0) {
			throw new RangeError('Expected timestampBound to be non-negative');
		}

		this._timestampBound = timestampBound;

		if (state !== null) {
			this._pendingWorkers = new Set(state);
			this._allWorkers = new Set(state);
		} else {
			this._pendingWorkers = null;
			this._allWorkers = null;
		}
	}

	get state() {
		return this._allWorkers;
	}

	reachedUpperBound(log) {
		const pendingWorkers = this._pendingWorkers;
		if (log.workerId != null && !(log.event >= STARTING_UP)) {
			if (pendingWorkers && log.timestamp > this._timestampBound) {
				pendingWorkers.delete(log.workerId);
				if (!pendingWorkers.size) {
					return true;
				}
			}
		} else if (log.event === STARTING_UP) {
			this._allWorkers = new Set([-1]);
			if (log.timestamp > this._timestampBound) {
				return true;
			} else {
				this._pendingWorkers = new Set([-1]);
			}
		} else {
			if (!pendingWorkers) {
				if (log.event === MASTER_PING) {
					this._allWorkers = new Set([-1, ...log.workerIds]);
					if (log.timestamp > this._timestampBound) {
						if (!log.workerIds.length) {
							return true;
						} else {
							this._pendingWorkers = new Set(log.workerIds);
						}
					} else {
						this._pendingWorkers = new Set(this._allWorkers);
					}
				}
			} else {
				if (log.event === WORKER_SPAWNED) {
					this._allWorkers.add(log.workerId);
					if (log.timestamp > this._timestampBound) {
						pendingWorkers.delete(-1);
						if (!pendingWorkers.size) {
							return true;
						}
					} else {
						pendingWorkers.add(log.workerId);
					}
				} else if (log.event === WORKER_EXITED) {
					this._allWorkers.delete(log.workerId);
					pendingWorkers.delete(log.workerId);
					if (log.timestamp > this._timestampBound) {
						pendingWorkers.delete(-1);
					}
					if (!pendingWorkers.size) {
						return true;
					}
				} else {
					if (log.timestamp > this._timestampBound) {
						pendingWorkers.delete(-1);
						if (!pendingWorkers.size) {
							return true;
						}
					}
				}
			}
		}
		return false;
	}

	reachedLowerBound(log) {
		const pendingWorkers = this._pendingWorkers;
		if (log.workerId != null && !(log.event >= STARTING_UP)) {
			if (pendingWorkers && log.timestamp < this._timestampBound) {
				pendingWorkers.delete(log.workerId);
				if (!pendingWorkers.size) {
					return true;
				}
			}
		} else if (log.event === STARTING_UP) {
			this._allWorkers = null;
			if (log.timestamp < this._timestampBound) {
				return true;
			} else {
				this._pendingWorkers = null;
			}
		} else {
			if (!pendingWorkers) {
				if (log.event === MASTER_PING) {
					this._allWorkers = new Set([-1, ...log.workerIds]);
					if (log.timestamp < this._timestampBound) {
						if (!log.workerIds.length) {
							return true;
						} else {
							this._pendingWorkers = new Set(log.workerIds);
						}
					} else {
						this._pendingWorkers = new Set(this._allWorkers);
					}
				}
			} else {
				if (log.event === WORKER_SPAWNED) {
					this._allWorkers.delete(log.workerId);
					pendingWorkers.delete(log.workerId);
					if (log.timestamp < this._timestampBound) {
						pendingWorkers.delete(-1);
					}
					if (!pendingWorkers.size) {
						return true;
					}
				} else if (log.event === WORKER_EXITED) {
					this._allWorkers.add(log.workerId);
					if (log.timestamp < this._timestampBound) {
						pendingWorkers.delete(-1);
						if (!pendingWorkers.size) {
							return true;
						}
					} else {
						pendingWorkers.add(log.workerId);
					}
				} else {
					if (log.timestamp < this._timestampBound) {
						pendingWorkers.delete(-1);
						if (!pendingWorkers.size) {
							return true;
						}
					}
				}
			}
		}
		return false;
	}
};
