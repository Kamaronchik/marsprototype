// Penalties by the rules of Mars: the auditor gives them, the CEO confirms or cancels them, and a reason is always needed.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { as, setup, teardown, hasDatabase, supabase } from './helpers.mjs';

describe.skipIf(!hasDatabase)('penalties', () => {
  let ctx;
  const made = [];

  beforeAll(async () => { ctx = await setup(); });
  afterAll(async () => {
    if (made.length) await supabase.from('violations').delete().in('id', made);
    // The real CEO was told about the test penalties too: take those notifications away.
    await supabase.from('notifications').delete().like('data->>teacherName', 'ZZ Test%');
    const testIds = Object.values(ctx.users).map((u) => u.id);
    await supabase.from('notifications').delete().in('user_id', testIds).like('type', 'penalty.%');
    await teardown();
  });

  const give = (role, body) => as(ctx.cookies[role]).post('/api/owner/penalties').send(body);
  const base = () => ({ userId: ctx.users.teacher.id, ruleCode: 'MARS_3_2', comment: 'Phone in the lesson, 10:15' });
  const closeAs = (role, id, body) => as(ctx.cookies[role]).post(`/api/owner/violations/${id}/close`).send(body);

  it('lists the 25 rules of Mars for the form', async () => {
    const res = await as(ctx.cookies.auditor).get('/api/owner/mars-rules');
    expect(res.status).toBe(200);
    expect(res.body.rules).toHaveLength(25);
    expect(res.body.rules.find((r) => r.code === 'MARS_3_2')).toEqual({ code: 'MARS_3_2', number: '3.2', level: 'red' });
  });

  it('shows every teacher to the auditor', async () => {
    const res = await as(ctx.cookies.auditor).get('/api/owner/staff');
    const ids = res.body.staff.filter((p) => p.role === 'Teacher').map((p) => p.id);
    expect(ids).toContain(ctx.users.teacher.id);
    expect(ids).toContain(ctx.users.teacher2.id);
  });

  it('refuses a penalty from anybody but the auditor and the CEO', async () => {
    for (const role of ['admin', 'academic', 'teacher', 'financier', 'student']) {
      expect((await give(role, base())).status).toBe(403);
    }
  });

  it('refuses a penalty without a rule, without a description, or for somebody who is not a teacher', async () => {
    expect((await give('auditor', { ...base(), ruleCode: 'MARS_9_9' })).status).toBe(400);
    expect((await give('auditor', { ...base(), comment: ' ' })).status).toBe(400);
    expect((await give('auditor', { ...base(), amount: -5 })).status).toBe(400);
    expect((await give('auditor', { ...base(), userId: ctx.users.admin.id })).status).toBe(404);
  });

  it('gives a penalty that goes to the CEO and to the teacher', async () => {
    const res = await give('auditor', base());
    expect(res.status).toBe(201);
    made.push(res.body.id);

    const { data: v } = await supabase.from('violations').select('*').eq('id', res.body.id).single();
    expect(v.status).toBe('open');
    expect(v.user_id).toBe(ctx.users.teacher.id);
    expect(v.details).toMatchObject({ source: 'audit', ruleNumber: '3.2', level: 'red', issuedById: ctx.users.auditor.id });

    const { data: toCeo } = await supabase.from('notifications').select('type').eq('user_id', ctx.users.owner.id).eq('type', 'penalty.issued');
    expect(toCeo.length).toBeGreaterThan(0);
    const { data: toTeacher } = await supabase.from('notifications').select('type').eq('user_id', ctx.users.teacher.id).eq('type', 'penalty.received');
    expect(toTeacher.length).toBeGreaterThan(0);

    const list = await as(ctx.cookies.owner).get('/api/owner/violations?source=audit&status=active');
    expect(list.body.violations.map((x) => x.id)).toContain(res.body.id);
    expect(list.body.violations.every((x) => x.details.source === 'audit')).toBe(true);
  });

  it('lets the auditor take a penalty back only with a reason, and never confirm it', async () => {
    const res = await give('auditor', base());
    made.push(res.body.id);

    expect((await closeAs('auditor', res.body.id, { outcome: 'resolved', comment: 'confirmed' })).status).toBe(403);
    expect((await closeAs('auditor', res.body.id, { outcome: 'dismissed', comment: '' })).status).toBe(400);
    expect((await closeAs('auditor', res.body.id, { outcome: 'dismissed', comment: 'Wrong teacher on the video' })).status).toBe(200);

    const { data: v } = await supabase.from('violations').select('status, resolution_comment').eq('id', res.body.id).single();
    expect(v).toEqual({ status: 'dismissed', resolution_comment: 'Wrong teacher on the video' });
    const { data: toCeo } = await supabase.from('notifications').select('type').eq('user_id', ctx.users.owner.id).eq('type', 'penalty.cancelled');
    expect(toCeo.length).toBeGreaterThan(0);
  });

  it('lets the CEO cancel a penalty with a reason, and the fine is cancelled with it', async () => {
    const res = await give('auditor', { ...base(), amount: 50000 });
    made.push(res.body.id);
    const { data: fine } = await supabase.from('fines').select('status, amount').eq('violation_id', res.body.id).single();
    expect(fine).toEqual({ status: 'issued', amount: 50000 });

    expect((await closeAs('owner', res.body.id, { outcome: 'dismissed', comment: '' })).status).toBe(400);
    expect((await closeAs('owner', res.body.id, { outcome: 'dismissed', comment: 'He had permission' })).status).toBe(200);

    const { data: after } = await supabase.from('fines').select('status, comment').eq('violation_id', res.body.id).single();
    expect(after).toEqual({ status: 'cancelled', comment: 'He had permission' });
  });

  it('tells the teacher about every penalty taken back, not only the first one', async () => {
    const before = await supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.users.teacher2.id).eq('type', 'penalty.removed');
    for (const ruleCode of ['MARS_1_1', 'MARS_2_3']) {
      const res = await give('auditor', { ...base(), userId: ctx.users.teacher2.id, ruleCode });
      made.push(res.body.id);
      expect((await closeAs('auditor', res.body.id, { outcome: 'dismissed', comment: 'Not him on the video' })).status).toBe(200);
    }
    const after = await supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.users.teacher2.id).eq('type', 'penalty.removed');
    expect(after.count - before.count).toBe(2);
  });

  it('lets the CEO confirm a penalty', async () => {
    const res = await give('owner', { ...base(), ruleCode: 'MARS_2_2' });
    expect(res.status).toBe(201);
    made.push(res.body.id);
    expect((await closeAs('owner', res.body.id, { outcome: 'resolved', comment: 'Seen on camera' })).status).toBe(200);
    const { data: v } = await supabase.from('violations').select('status').eq('id', res.body.id).single();
    expect(v.status).toBe('resolved');
  });

  it('does not let the auditor close a violation of the engine', async () => {
    const { data: v, error } = await supabase.from('violations').insert({
      rule_code: 'ATT_LATE', dedupe_key: `zz-test-${Date.now()}`, user_id: ctx.users.teacher.id, details: { groupName: 'zz' }, status: 'open',
    }).select('id').single();
    expect(error).toBeNull();
    made.push(v.id);
    expect((await closeAs('auditor', v.id, { outcome: 'dismissed', comment: 'nope nope' })).status).toBe(403);
  });

  it('keeps the rules of Mars out of the page of the engine rules', async () => {
    const res = await as(ctx.cookies.owner).get('/api/owner/rules');
    expect(res.status).toBe(200);
    expect(res.body.rules.some((r) => r.code.startsWith('MARS'))).toBe(false);
  });
});
