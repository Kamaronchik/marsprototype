// One-time CLI script to create the first Admin.
// Run locally:  npm run create-admin
// It is NOT an HTTP endpoint, so nobody can call it from the internet.
const readline = require('readline');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

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

  // Refuse to run if an Admin already exists.
  const { data: admins, error: checkErr } = await supabase
    .from('users').select('id').eq('role', 'Admin').limit(1);
  if (checkErr) fail('Cannot read users table: ' + checkErr.message);
  if (admins.length) fail('An Admin already exists. Create other users from the Admin panel.');

  const username = await ask('Username: ');
  const email = (await ask('Email (2FA codes go here): ')).toLowerCase();
  const fullName = await ask('Full name: ');
  const password = await ask('Password (min 12 chars): ', true);
  const repeat = await ask('Repeat password: ', true);

  if (!username || !email || !fullName) fail('All fields are required.');
  if (!/^\S+@\S+\.\S+$/.test(email)) fail('Invalid email.');
  if (password.length < 12) fail('Password must be at least 12 characters.');
  if (password !== repeat) fail('Passwords do not match.');

  const password_hash = await bcrypt.hash(password, 12);
  const { error } = await supabase.from('users').insert({
    username,
    email,
    full_name: fullName,
    password_hash,
    role: 'Admin',
    status: 'active',
    email_verified: false, // confirmed on first login via the emailed code
  });
  if (error) fail('Insert failed: ' + error.message);

  console.log(`Admin "${username}" created. You can now log in.`);
  rl.close();
})();
