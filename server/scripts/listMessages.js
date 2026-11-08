// Lists every English text the server can show to a user (error and status messages).
// Used by check-i18n to make sure each one has a translation:  node server/scripts/listMessages.js
const fs = require('fs');
const path = require('path');

const SERVER = path.resolve(__dirname, '..');
const SKIP = ['node_modules', 'scripts', 'database'];

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return SKIP.includes(entry.name) ? [] : walk(full);
  return full.endsWith('.js') ? [full] : [];
});

const unescape = (text) => text.replace(/\\'/g, "'");

// A text in single quotes: message: '...'  or  return '...';  (the checks of the validate functions)
const PATTERNS = [
  /message:\s*'((?:[^'\\]|\\.)*)'/g,
  /return\s+'((?:[^'\\]|\\.)*)';/g,
  /limiter\(\d+,\s*'((?:[^'\\]|\\.)*)'\)/g,
];

const listMessages = () => {
  const found = new Set();
  for (const file of walk(SERVER)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        const text = unescape(match[1]);
        if (/^[A-Z]/.test(text)) found.add(text); // sentences start with a capital letter
      }
    }
  }
  return [...found].sort();
};

module.exports = { listMessages };

if (require.main === module) {
  const messages = listMessages();
  console.log(`${messages.length} messages`);
  console.log(messages.join('\n'));
}
