const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { logAction } = require('../utils/audit');
const original = require('../../src/i18n/locales/en.json').translation;

const LANGUAGES = ['ru', 'uz', 'en'];
const MAX_LENGTH = 2000;
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

// 'groups.title' -> the English text of that key, or undefined when the site has no such text.
const originalOf = (key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), original);

const placeholdersOf = (text) => [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);

// The changed texts of one language. Public: the login page needs them before anyone is signed in.
const listOverrides = async (req, res) => {
  const { lang } = req.params;
  if (!LANGUAGES.includes(lang)) return res.status(400).json({ message: 'Choose a language: ru, uz or en' });

  const { data, error } = await supabase.from('translations').select('key, value').eq('lang', lang);
  if (error) return handleDbError(error, res);

  res.json({ overrides: Object.fromEntries(data.map((row) => [row.key, row.value])) });
};

// Checks the language and the key; the key must be a real text of the site.
const readTarget = (body) => {
  const { lang, key } = body;
  if (!LANGUAGES.includes(lang)) return { problem: 'Choose a language: ru, uz or en' };
  if (typeof key !== 'string' || typeof originalOf(key) !== 'string') return { problem: 'That text does not exist' };
  return { lang, key };
};

// Admin: change one text of the site in one language.
const saveOverride = async (req, res) => {
  const target = readTarget(req.body);
  if (target.problem) return res.status(400).json({ message: target.problem });

  const { value } = req.body;
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_LENGTH) {
    return res.status(400).json({ message: 'Text must be 1-2000 characters' });
  }
  // Words like {{name}} are replaced by real values: losing one would break the sentence.
  const given = placeholdersOf(value);
  if (!placeholdersOf(originalOf(target.key)).every((name) => given.includes(name))) {
    return res.status(400).json({ message: 'Keep every placeholder word of the original text in double curly braces' });
  }

  const { error } = await supabase.from('translations').upsert(
    { lang: target.lang, key: target.key, value: value.trim(), updated_by: req.user.id, updated_at: new Date().toISOString() },
    { onConflict: 'lang,key' },
  );
  if (error) return handleDbError(error, res);

  await logAction(req.user.id, 'translation.save', 'translation', null, { lang: target.lang, key: target.key });
  res.json({ message: 'Done' });
};

// Admin: go back to the text that comes with the site.
const resetOverride = async (req, res) => {
  const target = readTarget(req.body);
  if (target.problem) return res.status(400).json({ message: target.problem });

  const { error } = await supabase.from('translations').delete().eq('lang', target.lang).eq('key', target.key);
  if (error) return handleDbError(error, res);

  await logAction(req.user.id, 'translation.reset', 'translation', null, { lang: target.lang, key: target.key });
  res.json({ message: 'Done' });
};

module.exports = { listOverrides, saveOverride, resetOverride };
