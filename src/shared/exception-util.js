'use strict';
const ARBITRARY_VALUE = 0;
const ERROR_LIKE = 1;

// Serializes an exception for logging purposes.
exports.encode = (err, debugLogs) => {
	let type = ARBITRARY_VALUE;
	let value = '';
	const properties = {};

	if (err == null) {
		value = String(err);
	} else {
		Object.assign(properties, err);

		const { stack, message, name } = err;
		if (typeof stack === 'string') {
			value = stack;
			type = ERROR_LIKE;
		} else if (typeof message === 'string') {
			value = `${typeof name === 'string' ? name : 'Error'}: ${message}`;
			type = ERROR_LIKE;
		} else {
			value = String(err);
		}
	}

	return [type, value, properties, debugLogs || []];
};

// Deserializes a logged exception, converting it into a user-friendly object.
exports.decode = ([type, value, properties, debugLogs]) => {
	const debug = [];
	for (const [timestamp, data] of debugLogs) {
		debug.push({ timestamp, data });
	}

	const result = {};
	if (type === ARBITRARY_VALUE) {
		result.value = value;
	} else {
		result.stack = value;
	}

	result.properties = properties;
	result.debug = debug;

	return result;
};
