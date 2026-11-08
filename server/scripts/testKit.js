// Shared helpers of the end-to-end test scripts (testShop.js, testPlatform.js).
// Tests use fixed "zz_test_*" accounts: created once, switched to active for a run, blocked again at the end.
const crypto = require('crypto');
const db = require('../databaseService');
const supabase = require('../config/supabase');
const app = require('../server');

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60 * 1000).toISOString();

let failed = 0;
const check = (name, condition, got) => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
  if (!condition) {
    failed += 1;
    if (got !== undefined) console.log('      got:', JSON.stringify(got));
  }
};
const markFailed = () => { failed += 1; };

const ensureUser = async (key, role) => {
  const username = `zz_test_${key}`;
  const existing = await db.findUserByUsername(username);
  if (existing) return db.updateUserSettings(existing.id, { status: 'active', payment_status: 'active' });
  return db.createUser({
    username,
    full_name: `ZZ Test ${key}`,
    email: `${username}@example.invalid`,
    role,
    status: 'active',
    password_hash: crypto.randomBytes(32).toString('hex'), // not a bcrypt hash: nobody can log in
  });
};

// A real session in the database, so the requests pass the same middleware as the browser.
const openSession = async (user) => {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const deviceToken = crypto.randomBytes(32).toString('hex');
  await db.createSession(sha(sessionToken), user.id, sha(deviceToken), new Date(minutesFromNow(60)));
  return { ...user, cookie: `sessionId=${sessionToken}; deviceId=${deviceToken}` };
};

let baseUrl;
const startServer = () => {
  const server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return server;
};
const serverUrl = () => baseUrl;

const call = async (method, path, who, body) => {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(who && { Cookie: who.cookie }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

// Ends a run: closes the server, prints the result and sets the exit code.
const finish = (server) => {
  server.close();
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exitCode = failed ? 1 : 0;
};

module.exports = {
  supabase, check, markFailed, ensureUser, openSession, startServer, serverUrl, call, finish, minutesFromNow,
};
