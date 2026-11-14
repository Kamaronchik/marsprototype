const { isDate } = require('./attendance');

// Date range from ?from and ?to (inclusive days, 'YYYY-MM-DD'). Returns null when it is invalid.
const readRange = (query) => {
  const { from, to } = query;
  if ((from && !isDate(from)) || (to && !isDate(to)) || (from && to && from > to)) return null;
  return { from, to };
};

// The day after a 'YYYY-MM-DD' date.
const nextDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

// Limits a query on a timestamp column to the range, in Tashkent time (UTC+5).
const applyRange = (query, { from, to }, column = 'paid_at') => {
  let ranged = query;
  if (from) ranged = ranged.gte(column, `${from}T00:00:00+05:00`);
  if (to) ranged = ranged.lt(column, `${nextDay(to)}T00:00:00+05:00`);
  return ranged;
};

// Limits a query on a DATE column to the range.
const applyDateRange = (query, { from, to }, column) => {
  let ranged = query;
  if (from) ranged = ranged.gte(column, from);
  if (to) ranged = ranged.lte(column, to);
  return ranged;
};

module.exports = { readRange, applyRange, applyDateRange };
