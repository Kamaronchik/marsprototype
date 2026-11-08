const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === 'string' && UUID.test(value);

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

module.exports = { isUuid, isPositiveInt };
