// Push notifications: a teacher's browser token is saved, and a penalty goes to Firebase as a push.
// Uses the real Firebase project when FIREBASE_SERVICE_ACCOUNT is set (the fake token is refused by Firebase,
// which proves the server really reached it with valid keys).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { as, setup, teardown, hasDatabase, supabase, tableExists } from './helpers.mjs';

const ready = hasDatabase && (await tableExists('push_tokens'));
const FAKE_TOKEN = `test-token-${Date.now()}-${'x'.repeat(40)}`;

describe.skipIf(!ready)('push notifications', () => {
  let ctx;
  const made = [];

  beforeAll(async () => { ctx = await setup(); });
  afterAll(async () => {
    await supabase.from('push_tokens').delete().eq('token', FAKE_TOKEN);
    if (made.length) await supabase.from('violations').delete().in('id', made);
    const testIds = Object.values(ctx.users).map((u) => u.id);
    await supabase.from('notifications').delete().in('user_id', testIds).like('type', 'penalty.%');
    await teardown();
  });

  it('refuses a bad token and needs a login', async () => {
    expect((await as(null).post('/api/notifications/push-token').send({ token: FAKE_TOKEN })).status).toBe(401);
    expect((await as(ctx.cookies.teacher).post('/api/notifications/push-token').send({ token: 'short' })).status).toBe(400);
  });

  it('saves the browser token of the teacher with the language', async () => {
    const res = await as(ctx.cookies.teacher).post('/api/notifications/push-token').send({ token: FAKE_TOKEN, language: 'uz' });
    expect(res.status).toBe(200);
    const { data } = await supabase.from('push_tokens').select('user_id, language').eq('token', FAKE_TOKEN).single();
    expect(data).toEqual({ user_id: ctx.users.teacher.id, language: 'uz' });
  });

  it('sends a push to Firebase when the auditor gives a penalty', async () => {
    const log = vi.spyOn(console, 'log');
    const res = await as(ctx.cookies.auditor).post('/api/owner/penalties')
      .send({ userId: ctx.users.teacher.id, ruleCode: 'MARS_3_2', comment: 'Push test, phone in the lesson' });
    expect(res.status).toBe(201);
    made.push(res.body.id);

    const { data: notes } = await supabase.from('notifications').select('type')
      .eq('user_id', ctx.users.teacher.id).eq('type', 'penalty.received');
    expect(notes.length).toBeGreaterThan(0);

    const lines = log.mock.calls.map((c) => c.join(' ')).filter((l) => l.startsWith('[Push]'));
    log.mockRestore();
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Firebase answered about our fake token: the keys work and the push really left the server.
      expect(lines.join('\n')).toMatch(/0 of 1 delivered, errors: messaging\//);
    }
    console.info('Firebase answer:', lines.join(' | ') || '(push is off)');
  });

  it('forgets the token on logout', async () => {
    const res = await as(ctx.cookies.teacher).delete('/api/notifications/push-token').send({ token: FAKE_TOKEN });
    expect(res.status).toBe(200);
    const { data } = await supabase.from('push_tokens').select('token').eq('token', FAKE_TOKEN);
    expect(data).toHaveLength(0);
  });
});
