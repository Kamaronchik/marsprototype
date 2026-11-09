// Checks that the whole site is translated into Russian, Uzbek and English:  npm run check-i18n
//  1. the three language files have exactly the same keys;
//  2. every t('key') used in the code exists;
//  3. the Uzbek file is Latin only (no Cyrillic letters);
//  4. every text the server can show has a translation (apiMessages);
//  5. no English is written directly into the pages (JSX text, placeholder, title, toast, ...);
//  6. every battle question has an Uzbek and an English version.
// It exits with an error when something is missing, so it can run before every release.
const fs = require('fs');
const path = require('path');
const { listMessages } = require('./listMessages');

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src');
const LOCALES = ['en', 'ru', 'uz'];
const PLURAL_SUFFIX = /_(one|few|many|other)$/;

// Files where a name that is the same in every language is written directly.
const ALLOWED_LITERALS = new Set(['Logo.jsx']);
// Texts that are not words: translation keys given as props, example values, language codes, symbols,
// shell commands and the product name ("mars status", "Mars Space").
const ALLOWED_TEXT = [/^mars[\w\s.~—-]*$/i, /^[a-z]+(\.[A-Za-z]+)+$/, /^name@\w+\.\w+$/, /^[A-Z]{2,3}$/, /^[^A-Za-z]+$/, /^Ctrl K$/, /^UTC[+-]\d+$/];

const problems = [];
const report = (area, text) => problems.push(`[${area}] ${text}`);

const read = (file) => fs.readFileSync(file, 'utf8');

const flatten = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) => (
  typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]]
));

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(full);
  return /\.(jsx|js)$/.test(entry.name) ? [full] : [];
});

// --- 1. the language files ------------------------------------------------------

const files = Object.fromEntries(LOCALES.map((code) => [code, JSON.parse(read(path.join(SRC, 'i18n/locales', `${code}.json`))).translation]));
const flat = Object.fromEntries(LOCALES.map((code) => [code, Object.fromEntries(flatten(files[code]))]));
const base = (key) => key.replace(PLURAL_SUFFIX, '');
const baseKeys = Object.fromEntries(LOCALES.map((code) => [code, new Set(Object.keys(flat[code]).map(base))]));

for (const code of LOCALES) {
  for (const other of LOCALES.filter((c) => c !== code)) {
    for (const key of baseKeys[other]) {
      if (!baseKeys[code].has(key)) report('missing', `${code} has no "${key}" (it exists in ${other})`);
    }
  }
}
for (const code of LOCALES) {
  for (const [key, value] of Object.entries(flat[code])) {
    if (typeof value !== 'string' || !value.trim()) report('empty', `${code}: "${key}" is empty`);
  }
}

// --- 2. keys used in the code ----------------------------------------------------

const KEY_USE = /\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g;
for (const file of walk(SRC)) {
  const source = read(file);
  for (const match of source.matchAll(KEY_USE)) {
    const key = match[1];
    if (!baseKeys.en.has(key)) report('unknown key', `${path.relative(ROOT, file)} uses t('${key}'), which does not exist`);
  }
}

// --- 3. Uzbek is Latin -----------------------------------------------------------

for (const [key, value] of Object.entries(flat.uz)) {
  if (/[А-Яа-яЁё]/.test(value)) report('cyrillic', `uz "${key}" contains Cyrillic letters: ${value}`);
}

// --- 4. server messages ----------------------------------------------------------

const messageKey = (message) => message.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
for (const message of listMessages()) {
  const key = `apiMessages.${messageKey(message)}`;
  for (const code of LOCALES) {
    if (!(key in flat[code])) report('server message', `${code} has no translation of "${message}"`);
  }
}

// --- 5. English written directly into the pages ------------------------------------

const hasWords = (text) => /[A-Za-z]{3,}/.test(text) && !ALLOWED_TEXT.some((pattern) => pattern.test(text.trim()));

for (const file of walk(SRC).filter((f) => f.endsWith('.jsx') && !ALLOWED_LITERALS.has(path.basename(f)))) {
  const lines = read(file).split(/\r?\n/);
  lines.forEach((line, index) => {
    const where = `${path.relative(ROOT, file)}:${index + 1}`;
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

    // Text between tags:  <p>Some words</p>
    for (const match of line.matchAll(/>\s*([^<>{}]*[A-Za-z][^<>{}]*)\s*</g)) {
      if (hasWords(match[1])) report('hardcoded text', `${where}: ${match[1].trim()}`);
    }
    // Words in attributes
    for (const match of line.matchAll(/\b(?:placeholder|aria-label|title|alt|label)="([^"{}]+)"/g)) {
      if (hasWords(match[1])) report('hardcoded attribute', `${where}: ${match[0]}`);
    }
    // Messages shown to the user
    for (const match of line.matchAll(/toast\.\w+\(\s*['"`]([^'"`]+)['"`]/g)) {
      if (hasWords(match[1])) report('hardcoded toast', `${where}: ${match[1]}`);
    }
  });
}

// --- 6. battle questions ----------------------------------------------------------

const BANK = path.join(ROOT, 'server/database');
const questions = require(path.join(BANK, 'battleQuestions.js'));
for (const code of ['uz', 'en']) {
  const file = path.join(BANK, `battleQuestions.${code}.js`);
  if (!fs.existsSync(file)) {
    report('questions', `battleQuestions.${code}.js is missing`);
  } else {
    const translated = require(file);
    if (translated.length !== questions.length) report('questions', `${code}: ${translated.length} translations for ${questions.length} questions`);
    translated.forEach((entry, index) => {
      if (entry.length !== 5) report('questions', `${code} #${index + 1}: needs text and 4 options`);
      else if (code === 'uz' && /[А-Яа-яЁё]/.test(entry.join(' '))) report('questions', `uz #${index + 1} contains Cyrillic letters`);
    });
  }
}

// --- result ------------------------------------------------------------------------

if (problems.length) {
  console.log(problems.join('\n'));
  console.log(`\n${problems.length} problem(s) found`);
  process.exitCode = 1;
} else {
  const total = baseKeys.en.size;
  console.log(`All translations are complete: ${total} texts in ${LOCALES.length} languages, ${listMessages().length} server messages, ${questions.length} questions.`);
}
