// CLI script to create an Owner account (the person who reads the audit journal and the violations).
// Run locally:  npm run create-owner      (several owners are allowed: run it again)
// It is NOT an HTTP endpoint, and the Admin panel cannot create an Owner: nobody checks themselves.
// The Owner signs in with e-mail and a code sent to it (2FA), like every role except the Admin.
const readline = require('readline');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { logAction } = require('../utils/audit');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let muted = false;
const origWrite = rl._writeToOutput;
rl._writeToOutput = (s) => { if (!muted) origWrite.call(rl, s); };

const ask = (q, hidden = false) =>
  new Promise((resolve) => {
    rl.question(q, (a) => { muted = false; if (hidden) console.log(); resolve(a.trim()); });
    muted = hidden;
  });

const fail = (msg) => { console.error('Error: ' + msg); rl.close(); process.exit(1); };

(async () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    fail('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env');
  }

  const username = await ask('Username: ');
  const email = (await ask('Email (2FA codes go here): ')).toLowerCase();
  const fullName = await ask('Full name: ');
  const password = await ask('Password (min 12 chars): ', true);
  const repeat = await ask('Repeat password: ', true);

  if (!username || !email || !fullName) fail('All fields are required.');
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) fail('Username: 3-30 chars (letters, digits . _ -).');
  if (!/^\S+@\S+\.\S+$/.test(email)) fail('Invalid email.');
  if (password.length < 12) fail('Password must be at least 12 characters.');
  if (password !== repeat) fail('Passwords do not match.');

  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase.from('users').insert({
    username, email, full_name: fullName, password_hash, role: 'Owner', status: 'active', email_verified: false,
  }).select('id').single();
  if (error) fail('Insert failed: ' + error.message + ' (is migration 018_audit_system.sql applied?)');

  await logAction(null, 'owner.create', 'user', data.id, { username });
  console.log(`Owner "${username}" created. Sign in on the site: a code will come to ${email}.`);
  rl.close();
})();
