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
		assignProperties(properties, err);

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

// Similar to Object.assign(), but array-index-like keys are ignored.
function assignProperties(properties, source) {
	if (typeof source === 'object' || typeof source === 'function') {
		if (Array.isArray(source) || ArrayBuffer.isView(source)) {
			for (const key of Object.keys(source)) {
				if (!/^(?:0|[1-9][0-9]*)$/.test(key)) {
					properties[key] = source[key];
				}
			}
		} else {
			Object.assign(properties, source);
		}
	}
}
