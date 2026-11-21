// Section 9 of the plan: who may see and change what. Real database, real middleware.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { as, supabase, setup, teardown, hasDatabase } from './helpers.mjs';

const FAKE_ID = '00000000-0000-4000-8000-000000000000';

describe.skipIf(!hasDatabase)('permissions by role', () => {
  let ctx;
  beforeAll(async () => { ctx = await setup(); });
  afterAll(async () => { await teardown(); });

  describe('Student sees only own data', () => {
    it('has no access without a session', async () => {
      expect((await as(null).get('/api/grades/mine')).status).toBe(401);
    });

    it('gets only own marks, not the marks of another student', async () => {
      const mine = await as(ctx.cookies.student).get('/api/grades/mine');
      expect(mine.status).toBe(200);
      expect(JSON.stringify(mine.body)).toContain('zz_test_mark');

      const other = await as(ctx.cookies.student2).get('/api/grades/mine');
      expect(other.status).toBe(200);
      expect(JSON.stringify(other.body)).not.toContain('zz_test_mark');
    });

    it('cannot ask for another student through query or URL', async () => {
      const student = as(ctx.cookies.student2);
      const other = ctx.users.student.id;
      expect((await student.get(`/api/attendance?studentId=${other}`)).status).toBe(403);
      expect((await student.get(`/api/grades/group/${ctx.groupA.id}`)).status).toBe(403);
      expect((await student.get(`/api/groups/${ctx.groupA.id}/students`)).status).toBe(403);
      expect((await student.get('/api/students')).status).toBe(403);
      expect((await student.get('/api/users')).status).toBe(403);
      expect((await student.get('/api/finance/payments')).status).toBe(403);
      expect((await student.get('/api/ratings')).status).toBe(403);
    });

    it('attendance/mine returns only own records', async () => {
      const res = await as(ctx.cookies.student2).get('/api/attendance/mine');
      expect(res.status).toBe(200);
      expect(res.body.records.every((r) => r.studentId === ctx.users.student2.id)).toBe(true);
    });
  });

  describe('Teacher works only with own groups', () => {
    it('sees only own groups', async () => {
      const res = await as(ctx.cookies.teacher2).get('/api/groups/mine');
      expect(res.status).toBe(200);
      const text = JSON.stringify(res.body);
      expect(text).toContain('zz_test_group_b');
      expect(text).not.toContain('zz_test_group_a');
    });

    it('cannot open the students or the marks of another group', async () => {
      const teacher2 = as(ctx.cookies.teacher2);
      expect((await teacher2.get(`/api/groups/${ctx.groupA.id}/students`)).status).toBe(404);
      expect((await teacher2.get(`/api/grades/group/${ctx.groupA.id}`)).status).toBe(404);
    });

    it('cannot add or delete a mark in another group', async () => {
      const teacher2 = as(ctx.cookies.teacher2);
      const add = await teacher2.post('/api/grades').send({
        studentId: ctx.users.student.id, groupId: ctx.groupA.id, kind: 'test', title: 'zz_hack', score: 10, maxScore: 10,
      });
      expect(add.status).toBe(404);

      const del = await teacher2.delete(`/api/grades/${ctx.grade.id}`);
      expect(del.status).toBe(404);
      const { data } = await supabase.from('grades').select('id').eq('id', ctx.grade.id).maybeSingle();
      expect(data).not.toBeNull();
    });

    it('cannot mark attendance in another group', async () => {
      const res = await as(ctx.cookies.teacher2).put('/api/attendance/mark').send({
        groupId: ctx.groupA.id, studentId: ctx.users.student.id, status: 'absent',
      });
      expect([403, 404]).toContain(res.status);
      const { data } = await supabase.from('attendance').select('id').eq('group_id', ctx.groupA.id).eq('marked_by', ctx.users.teacher2.id);
      expect(data).toHaveLength(0);
    });

    it('can read the marks of the own group', async () => {
      const res = await as(ctx.cookies.teacher).get(`/api/grades/group/${ctx.groupA.id}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Academic Manager has no access to money', () => {
    it('gets 403 on every /api/finance route', async () => {
      const academic = as(ctx.cookies.academic);
      for (const path of ['/overview', '/payments', '/teachers', '/salaries', '/expenses', '/reports']) {
        expect((await academic.get(`/api/finance${path}`)).status).toBe(403);
      }
      expect((await academic.post('/api/finance/payments').send({})).status).toBe(403);
      expect((await academic.post('/api/finance/salaries').send({})).status).toBe(403);
      expect((await academic.get('/api/students')).status).toBe(403);
    });

    it('cannot manage coins', async () => {
      const academic = as(ctx.cookies.academic);
      expect((await academic.post('/api/wallet/award').send({})).status).toBe(403);
      expect((await academic.post('/api/wallet/grant').send({})).status).toBe(403);
      expect((await academic.get('/api/wallet/teachers')).status).toBe(403);
      expect((await academic.post(`/api/users/${ctx.users.student.id}/balance`).send({ amount: 1000 })).status).toBe(403);
    });

    it('does not get prices or payment status in the group data', async () => {
      const academic = as(ctx.cookies.academic);
      const groups = await academic.get('/api/groups');
      expect(groups.status).toBe(200);
      expect(JSON.stringify(groups.body)).not.toContain('monthlyPrice');
      const students = await academic.get(`/api/groups/${ctx.groupA.id}/students`);
      expect(students.status).toBe(200);
      expect(JSON.stringify(students.body)).not.toContain('paymentStatus');
    });
  });

  describe('Financier has no access to marks and attendance', () => {
    it('gets 403 on marks', async () => {
      const financier = as(ctx.cookies.financier);
      const add = await financier.post('/api/grades').send({
        studentId: ctx.users.student.id, groupId: ctx.groupA.id, kind: 'test', title: 'zz_hack', score: 10, maxScore: 10,
      });
      expect(add.status).toBe(403);
      expect((await financier.delete(`/api/grades/${ctx.grade.id}`)).status).toBe(403);
      expect((await financier.get(`/api/grades/group/${ctx.groupA.id}`)).status).toBe(403);
    });

    it('gets 403 on attendance and lessons', async () => {
      const financier = as(ctx.cookies.financier);
      expect((await financier.put('/api/attendance/mark').send({
        groupId: ctx.groupA.id, studentId: ctx.users.student.id, status: 'present',
      })).status).toBe(403);
      expect((await financier.get('/api/attendance')).status).toBe(403);
      expect((await financier.get('/api/attendance/unmarked')).status).toBe(403);
      expect((await financier.get('/api/lessons')).status).toBe(403);
      expect((await financier.get('/api/academic/dashboard')).status).toBe(403);
    });

    it('still reaches the finance pages', async () => {
      expect((await as(ctx.cookies.financier).get('/api/finance/overview')).status).toBe(200);
    });
  });

  describe('Only Admin assigns roles and changes settings', () => {
    it('refuses a role change from every other role', async () => {
      for (const who of ['teacher', 'academic', 'financier', 'student']) {
        const res = await as(ctx.cookies[who]).patch(`/api/users/${ctx.users.victim.id}`).send({ role: 'Admin' });
        expect(res.status).toBe(403);
      }
      const { data } = await supabase.from('users').select('role').eq('id', ctx.users.victim.id).single();
      expect(data.role).toBe('Student');
    });

    it('refuses creating, deleting and blocking users from other roles', async () => {
      const academic = as(ctx.cookies.academic);
      expect((await academic.post('/api/users').send({})).status).toBe(403);
      expect((await academic.delete(`/api/users/${ctx.users.victim.id}`)).status).toBe(403);
      expect((await academic.patch(`/api/users/${ctx.users.victim.id}`).send({ status: 'blocked' })).status).toBe(403);
    });

    it('refuses settings (changed texts) from other roles', async () => {
      for (const who of ['teacher', 'academic', 'financier', 'student']) {
        const res = await as(ctx.cookies[who]).put('/api/i18n').send({ lang: 'en', key: 'x', value: 'y' });
        expect(res.status).toBe(403);
      }
    });

    it('lets Admin change a role (and the change is undone)', async () => {
      const admin = as(ctx.cookies.admin);
      const up = await admin.patch(`/api/users/${ctx.users.victim.id}`).send({ role: 'Teacher' });
      expect(up.status).toBe(200);
      expect(up.body.user.role).toBe('Teacher');
      const back = await admin.patch(`/api/users/${ctx.users.victim.id}`).send({ role: 'Student' });
      expect(back.status).toBe(200);
    });

    it('does not let Admin demote the own account', async () => {
      const res = await as(ctx.cookies.admin).patch(`/api/users/${ctx.users.admin.id}`).send({ role: 'Student' });
      expect(res.status).toBe(400);
    });
  });

  it('gives 404 for an unknown id, not a crash', async () => {
    expect((await as(ctx.cookies.admin).get(`/api/groups/${FAKE_ID}/students`)).status).toBe(404);
  });
});
