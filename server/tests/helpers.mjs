// Shared helpers of the vitest files: a real session in the database for every test account,
// the same way the browser gets one, so requests pass the real middleware.
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';

const require = createRequire(import.meta.url);
export const app = require('../server');
export const supabase = require('../config/supabase');
export const db = require('../databaseService');
export const emailService = require('../services/emailService');
export const { hashCode } = require('../utils/codes');
const seed = require('../scripts/seedTestUsers');

// Without database keys the permission tests cannot run.
export const hasDatabase = !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
export const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60 * 1000).toISOString();

// A session cookie string for a user. minutes < 0 gives an already expired session.
export const openSession = async (user, minutes = 60) => {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const deviceToken = crypto.randomBytes(32).toString('hex');
  await db.createSession(sha(sessionToken), user.id, sha(deviceToken), new Date(minutesFromNow(minutes)));
  return `sessionId=${sessionToken}; deviceId=${deviceToken}`;
};

// Sends a request as a user: as(cookie).get('/api/x'), as(cookie).post('/api/x').send({...})
export const as = (cookie) => {
  const send = (method) => (url) => {
    const r = request(app)[method](url);
    return cookie ? r.set('Cookie', cookie) : r;
  };
  return { get: send('get'), post: send('post'), put: send('put'), patch: send('patch'), delete: send('delete') };
};

// Creates the accounts and their sessions. Returns { users, cookies, groupA, groupB, grade }.
export const setup = async () => {
  const data = await seed.seedTestData('active');
  const cookies = {};
  for (const [key, user] of Object.entries(data.users)) cookies[key] = await openSession(user);
  return { ...data, cookies };
};

export const teardown = () => seed.blockTestUsers();

// True when a table (or a column of it) exists, so tests of a new migration are skipped until it is applied.
export const tableExists = async (table, column = '*') => {
  if (!hasDatabase) return false;
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error;
};
