const supabase = require('../config/supabase');

// Bots are the test and demo accounts: their e-mail ends with @example.invalid.
// They stay in the system, but their traces (orders, battles, violations, fines, journal) are hidden
// from real people, and news about them is not sent to real people. A bot still sees everything,
// so the automatic tests keep working.
const BOT_EMAIL = '%@example.invalid';
const CACHE_MS = 60 * 1000;

let cache = { ids: [], at: 0 };

// All bot ids, for hiding rows in lists. Kept for a minute: a bot made a moment ago may still show.
const botIds = async () => {
  if (Date.now() - cache.at < CACHE_MS) return cache.ids;
  const { data, error } = await supabase.from('users').select('id').like('email', BOT_EMAIL);
  if (error) return cache.ids; // a failed read must not break the page: show what we knew
  cache = { ids: data.map((u) => u.id), at: Date.now() };
  return cache.ids;
};

// Which of these people are bots, asked from the database right now (no cache).
const botsAmong = async (ids) => {
  const list = ids.filter(Boolean);
  if (!list.length) return [];
  const { data } = await supabase.from('users').select('id').in('id', list).like('email', BOT_EMAIL);
  return (data ?? []).map((u) => u.id);
};

// The ids to hide from this viewer: all bots for a real person, none for a bot.
const hiddenFor = async (viewer) => {
  if ((await botsAmong([viewer?.id])).length) return [];
  return botIds();
};

// Adds "column is empty or not one of these ids" to a Supabase query. Nothing to hide = the query as it is.
// "Empty" is kept on purpose: in SQL, NOT IN drops rows where the column is NULL (a violation without a person).
const withoutIds = (query, column, ids) =>
  (ids.length ? query.or(`${column}.is.null,${column}.not.in.(${ids.join(',')})`) : query);

// True when both are bots or both are real people. News about a bot is told only to bots, and the other way round.
const sameKind = async (a, b) => {
  const bots = await botsAmong([a, b]);
  return bots.includes(a) === bots.includes(b);
};

module.exports = { botIds, botsAmong, hiddenFor, withoutIds, sameKind };
