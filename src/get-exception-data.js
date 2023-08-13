'use strict';

/*
	Returns an object that describes the given exception. If the exception is
	Error-like, the returned object will have a string "stack" property,
	otherwise it will have a string "value" property, unless the exception is
	null or undefined in which case both properties will be omitted. In any
	case, the returned object will have a "properties" object, containing the
	enumerable properties found on the exception.
 */

module.exports = (err) => {
	const data = {};

	if (err != null) {
		data.properties = Object.assign({}, err);

		const { stack, message, name } = err;
		if (typeof stack === 'string') {
			data.stack = stack;
		} else if (typeof message === 'string') {
			const errName = typeof name === 'string' ? name : 'Error';
			data.stack = `${errName}: ${message}`;
		} else {
			data.value = String(err);
		}
	} else {
		data.properties = {};
	}

	return data;
};
