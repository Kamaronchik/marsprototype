// Login, 2FA, expired sessions and blocked users.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app, as, db, supabase, emailService, openSession, minutesFromNow, setup, teardown, hasDatabase } from './helpers.mjs';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

describe.skipIf(!hasDatabase)('login, 2FA, sessions', () => {
  let ctx;
  const password = crypto.randomBytes(12).toString('hex'); // random: lives only in this run
  const sentCodes = [];
  const lastCode = () => sentCodes[sentCodes.length - 1];

  // The resend cooldown is one minute: move older codes into the past instead of waiting.
  const resetCooldown = () => supabase.from('verification_codes')
    .update({ created_at: minutesFromNow(-5) }).eq('user_id', ctx.users.student.id);
  const setStatus = (id, status) => supabase.from('users').update({ status }).eq('id', id);

  beforeAll(async () => {
    ctx = await setup();
    // No real e-mails: the code is kept here instead.
    vi.spyOn(emailService, 'sendVerificationEmail').mockImplementation(async (email, code) => { sentCodes.push(code); });
    const hash = await bcrypt.hash(password, 4);
    await supabase.from('users').update({ password_hash: hash }).eq('id', ctx.users.student.id);
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await teardown();
  });

  const login = (agent) => agent.post('/api/auth/login').send({
    username: ctx.users.student.username, email: ctx.users.student.email, password,
  });
  const hasSessionCookie = (res) => (res.headers['set-cookie'] || []).join(';').includes('sessionId=');

  describe('2FA', () => {
    it('a new device gets no session until the code is entered', async () => {
      const agent = request.agent(app);
      const res = await login(agent);
      expect(res.status).toBe(200);
      expect(res.body.requires2FA).toBe(true);
      expect(res.body.user).toBeUndefined();
      expect(hasSessionCookie(res)).toBe(false);
      expect((await agent.get('/api/grades/mine')).status).toBe(401);
      expect(sentCodes.length).toBeGreaterThan(0);
    });

    it('a wrong code gives no session', async () => {
      await resetCooldown();
      const agent = request.agent(app);
      const first = await login(agent);
      const res = await agent.post('/api/auth/verify-device').send({ userId: first.body.userId, code: '000000' });
      expect(res.status).toBe(400);
      expect(hasSessionCookie(res)).toBe(false);
      expect((await agent.get('/api/grades/mine')).status).toBe(401);
    });

    it('an expired code gives no session', async () => {
      const agent = request.agent(app);
      const first = await login(agent);
      await supabase.from('verification_codes').update({ expires_at: minutesFromNow(-1) }).eq('user_id', ctx.users.student.id);
      const res = await agent.post('/api/auth/verify-device').send({ userId: first.body.userId, code: lastCode() });
      expect(res.status).toBe(400);
      expect((await agent.get('/api/grades/mine')).status).toBe(401);
    });

    it('the right code opens the session', async () => {
      const agent = request.agent(app);
      const first = await login(agent);
      const res = await agent.post('/api/auth/verify-device').send({ userId: first.body.userId, code: lastCode() });
      expect(res.status).toBe(200);
      expect((await agent.get('/api/grades/mine')).status).toBe(200);
    });
  });

  describe('expired session', () => {
    it('gives 401', async () => {
      const cookie = await openSession(ctx.users.student, -5);
      expect((await as(cookie).get('/api/grades/mine')).status).toBe(401);
    });

    it('is removed from the database on use', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const device = crypto.randomBytes(32).toString('hex');
      await db.createSession(sha(token), ctx.users.student.id, sha(device), new Date(minutesFromNow(-1)));
      await as(`sessionId=${token}; deviceId=${device}`).get('/api/grades/mine');
      const { data } = await supabase.from('sessions').select('session_hash').eq('session_hash', sha(token));
      expect(data).toHaveLength(0);
    });

    it('does not work from another device', async () => {
      const cookie = (await openSession(ctx.users.student)).replace(/deviceId=\w+/, `deviceId=${crypto.randomBytes(32).toString('hex')}`);
      expect((await as(cookie).get('/api/grades/mine')).status).toBe(401);
    });

    it('logout closes the session', async () => {
      const cookie = await openSession(ctx.users.student);
      expect((await as(cookie).post('/api/auth/logout')).status).toBe(200);
      expect((await as(cookie).get('/api/grades/mine')).status).toBe(401);
    });
  });

  describe('blocked user', () => {
    it('cannot log in', async () => {
      await setStatus(ctx.users.student.id, 'blocked');
      const res = await login(request.agent(app));
      expect(res.status).toBe(403);
      expect(res.body.user).toBeUndefined();
      expect(res.body.requires2FA).toBeUndefined();
    });

    it('cannot confirm a device with a code that was sent before the block', async () => {
      await setStatus(ctx.users.student.id, 'active');
      await resetCooldown();
      const first = await login(request.agent(app));
      const code = lastCode();
      await setStatus(ctx.users.student.id, 'blocked');

      const res = await request.agent(app).post('/api/auth/verify-device').send({ userId: first.body.userId, code });
      expect(res.status).toBe(403);
      expect(hasSessionCookie(res)).toBe(false);
    });

    it('loses access at once when blocked while a session is open', async () => {
      await setStatus(ctx.users.student.id, 'active');
      const cookie = await openSession(ctx.users.student);
      await setStatus(ctx.users.student.id, 'blocked');
      expect((await as(cookie).get('/api/grades/mine')).status).toBe(401);
    });

    it('is blocked by the Admin through the API and the sessions are closed', async () => {
      await setStatus(ctx.users.victim.id, 'active');
      const cookie = await openSession(ctx.users.victim);
      expect((await as(cookie).get('/api/grades/mine')).status).toBe(200);
      const res = await as(ctx.cookies.admin).patch(`/api/users/${ctx.users.victim.id}`).send({ status: 'blocked' });
      expect(res.status).toBe(200);
      expect((await as(cookie).get('/api/grades/mine')).status).toBe(401);
    });
  });
});
