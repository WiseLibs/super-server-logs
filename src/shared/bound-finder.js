'use strict';
const { STARTING_UP, WORKER_SPAWNED, WORKER_EXITED, MASTER_PING } = require('./event-types');

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
		const [timestamp, eventType] = log;
		if (eventType < 40 /* worker/request/response events */) {
			if (pendingWorkers && timestamp > this._timestampBound) {
				pendingWorkers.delete(log[3]);
				if (!pendingWorkers.size) {
					return true;
				}
			}
		} else if (eventType === STARTING_UP) {
			this._allWorkers = new Set([-1]);
			if (timestamp > this._timestampBound) {
				return true;
			} else {
				this._pendingWorkers = new Set([-1]);
			}
		} else {
			if (!pendingWorkers) {
				if (eventType === MASTER_PING) {
					this._allWorkers = new Set([-1, ...log[3]]);
					if (timestamp > this._timestampBound) {
						if (!log[3].length) {
							return true;
						} else {
							this._pendingWorkers = new Set(log[3]);
						}
					} else {
						this._pendingWorkers = new Set(this._allWorkers);
					}
				}
			} else {
				if (eventType === WORKER_SPAWNED) {
					this._allWorkers.add(log[3]);
					if (timestamp > this._timestampBound) {
						pendingWorkers.delete(-1);
						if (!pendingWorkers.size) {
							return true;
						}
					} else {
						pendingWorkers.add(log[3]);
					}
				} else if (eventType === WORKER_EXITED) {
					this._allWorkers.delete(log[3]);
					pendingWorkers.delete(log[3]);
					if (timestamp > this._timestampBound) {
						pendingWorkers.delete(-1);
					}
					if (!pendingWorkers.size) {
						return true;
					}
				} else {
					if (timestamp > this._timestampBound) {
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
		const [timestamp, eventType] = log;
		if (eventType < 40 /* worker/request/response events */) {
			if (pendingWorkers && timestamp < this._timestampBound) {
				pendingWorkers.delete(log[3]);
				if (!pendingWorkers.size) {
					return true;
				}
			}
		} else if (eventType === STARTING_UP) {
			this._allWorkers = null;
			if (timestamp < this._timestampBound) {
				return true;
			} else {
				this._pendingWorkers = null;
			}
		} else {
			if (!pendingWorkers) {
				if (eventType === MASTER_PING) {
					this._allWorkers = new Set([-1, ...log[3]]);
					if (timestamp < this._timestampBound) {
						if (!log[3].length) {
							return true;
						} else {
							this._pendingWorkers = new Set(log[3]);
						}
					} else {
						this._pendingWorkers = new Set(this._allWorkers);
					}
				}
			} else {
				if (eventType === WORKER_SPAWNED) {
					this._allWorkers.delete(log[3]);
					pendingWorkers.delete(log[3]);
					if (timestamp < this._timestampBound) {
						pendingWorkers.delete(-1);
					}
					if (!pendingWorkers.size) {
						return true;
					}
				} else if (eventType === WORKER_EXITED) {
					this._allWorkers.add(log[3]);
					if (timestamp < this._timestampBound) {
						pendingWorkers.delete(-1);
						if (!pendingWorkers.size) {
							return true;
						}
					} else {
						pendingWorkers.add(log[3]);
					}
				} else {
					if (timestamp < this._timestampBound) {
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
