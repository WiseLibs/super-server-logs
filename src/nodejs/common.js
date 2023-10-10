'use strict';

exports.isLogBasename = (basename) => {
	return /^[0-9]{14}\.log$/.test(basename);
};

exports.toLogBasename = (timestamp) => {
	return `${String(timestamp).padStart(14, '0')}.log`;
};

exports.toLogTimestamp = (basename) => {
	return Number(basename.slice(0, -4));
};
