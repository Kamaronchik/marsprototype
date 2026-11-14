// The new features: late status, my schedule, audit log visibility, subjects, expenses and reports, careers.
// Tests of a migration are skipped until it is applied (see supabase/migrations).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { as, supabase, setup, teardown, hasDatabase, tableExists } from './helpers.mjs';

const subjectsReady = await tableExists('subjects');
const expensesReady = await tableExists('expenses');
const careersReady = await tableExists('job_applications');

const PAST_MONDAY = '2020-01-06'; // a fixed past day: the groups of the tests have lessons on every weekday
const actionsOf = (res) => res.body.entries.map((e) => e.action);

describe.skipIf(!hasDatabase)('new features', () => {
  let ctx;
  beforeAll(async () => { ctx = await setup(); });
  afterAll(async () => { await teardown(); });

  describe('late status', () => {
    it('Admin marks a student late and the student sees it in the statistics', async () => {
      const res = await as(ctx.cookies.admin).put('/api/attendance/mark').send({
        groupId: ctx.groupA.id, studentId: ctx.users.student.id, status: 'late', date: PAST_MONDAY,
      });
      expect(res.status).toBe(200);

      const mine = await as(ctx.cookies.student).get(`/api/attendance/mine?from=${PAST_MONDAY}&to=${PAST_MONDAY}`);
      expect(mine.body.stats.late).toBe(1);
      expect(mine.body.stats.percent).toBe(100); // late = was at the lesson
    });

    it('refuses an unknown status', async () => {
      const res = await as(ctx.cookies.admin).put('/api/attendance/mark').send({
        groupId: ctx.groupA.id, studentId: ctx.users.student.id, status: 'sleeping', date: PAST_MONDAY,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('my schedule', () => {
    it('student and teacher get a week of seven days', async () => {
      for (const who of ['student', 'teacher']) {
        const res = await as(ctx.cookies[who]).get('/api/schedule/mine');
        expect(res.status).toBe(200);
        expect(res.body.days).toHaveLength(7);
      }
    });

    it('the teacher sees only the own group, the student only theirs', async () => {
      const teacher = await as(ctx.cookies.teacher).get('/api/schedule/mine');
      const names = teacher.body.days.flatMap((d) => d.lessons.map((l) => l.groupName));
      expect(names).toContain('zz_test_group_a');
      expect(names).not.toContain('zz_test_group_b');
    });

    it('other roles have no personal schedule', async () => {
      expect((await as(ctx.cookies.academic).get('/api/schedule/mine')).status).toBe(403);
      expect((await as(ctx.cookies.financier).get('/api/schedule/mine')).status).toBe(403);
    });
  });

  describe('audit log', () => {
    it('writes a role change, and each role sees only its own area', async () => {
      const admin = as(ctx.cookies.admin);
      await admin.patch(`/api/users/${ctx.users.victim.id}`).send({ role: 'Teacher' });
      await admin.patch(`/api/users/${ctx.users.victim.id}`).send({ role: 'Student' });

      const all = await admin.get('/api/audit?pageSize=100&action=user.role_change');
      expect(all.status).toBe(200);
      expect(all.body.entries.length).toBeGreaterThan(0);
      expect(all.body.entries[0].actor.name).toBeTruthy();

      const academic = await as(ctx.cookies.academic).get('/api/audit?pageSize=100');
      expect(academic.status).toBe(200);
      expect(actionsOf(academic).every((a) => /^(group|schedule|attendance|grade|homework|lesson|academic|subject|application)\./.test(a))).toBe(true);
      expect(actionsOf(academic)).not.toContain('user.role_change');

      const financier = await as(ctx.cookies.financier).get('/api/audit?pageSize=100');
      expect(financier.status).toBe(200);
      expect(actionsOf(financier).every((a) => /^(payment|salary|expense|balance|student\.payment_status)/.test(a))).toBe(true);
    });

    it('a role cannot ask for an action of another area', async () => {
      const res = await as(ctx.cookies.financier).get('/api/audit?action=user.role_change');
      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(0);
    });

    it('is closed to teachers and students, and filters are checked', async () => {
      expect((await as(ctx.cookies.teacher).get('/api/audit')).status).toBe(403);
      expect((await as(ctx.cookies.student).get('/api/audit')).status).toBe(403);
      expect((await as(ctx.cookies.admin).get('/api/audit?userId=nope')).status).toBe(400);
      expect((await as(ctx.cookies.admin).get('/api/audit?from=2026-13-40')).status).toBe(400);
    });

    it('pages the answer', async () => {
      const res = await as(ctx.cookies.admin).get('/api/audit?pageSize=2&page=1');
      expect(res.body.entries.length).toBeLessThanOrEqual(2);
      expect(res.body.total).toBeGreaterThanOrEqual(res.body.entries.length);
    });

    it('writes marks and attendance', async () => {
      const marks = await as(ctx.cookies.admin).get('/api/audit?pageSize=100');
      expect(actionsOf(marks).some((a) => a === 'attendance.mark' || a === 'attendance.change')).toBe(true);
    });
  });

  describe.skipIf(!subjectsReady)('subjects', () => {
    let subject;
    afterAll(async () => { if (subject) await supabase.from('subjects').delete().eq('id', subject.id); });

    it('Academic Manager creates, Teacher and Student cannot', async () => {
      const name = `zz_test_subject_${Date.now()}`;
      expect((await as(ctx.cookies.teacher).post('/api/subjects').send({ name })).status).toBe(403);
      expect((await as(ctx.cookies.student).get('/api/subjects')).status).toBe(403);
      const res = await as(ctx.cookies.academic).post('/api/subjects').send({ name, nameRu: 'Тест' });
      expect(res.status).toBe(201);
      subject = res.body.subject;
      expect((await as(ctx.cookies.academic).post('/api/subjects').send({ name })).status).toBe(409);
    });

    it('the subject of a group is seen in the group, by the teacher and by the student', async () => {
      const set = await as(ctx.cookies.academic).patch(`/api/academic/groups/${ctx.groupA.id}/subject`).send({ subjectId: subject.id });
      expect(set.status).toBe(200);

      const groups = await as(ctx.cookies.admin).get('/api/groups');
      expect(groups.body.groups.find((g) => g.id === ctx.groupA.id).subject.id).toBe(subject.id);
      const mine = await as(ctx.cookies.teacher).get('/api/groups/mine');
      expect(mine.body.groups.find((g) => g.id === ctx.groupA.id).subject.id).toBe(subject.id);
      const home = await as(ctx.cookies.student).get('/api/home/student');
      expect(home.body.crews.find((g) => g.id === ctx.groupA.id).subject.id).toBe(subject.id);
    });

    it('the analytics of the Academic Manager can be limited to a subject', async () => {
      const academic = as(ctx.cookies.academic);
      for (const path of ['dashboard', 'students/risk', 'teachers']) {
        expect((await academic.get(`/api/academic/${path}?subjectId=${subject.id}`)).status).toBe(200);
      }
      expect((await academic.get('/api/academic/dashboard?subjectId=bad')).status).toBe(400);
    });

    it('deleting a subject keeps its groups', async () => {
      expect((await as(ctx.cookies.admin).delete(`/api/subjects/${subject.id}`)).status).toBe(200);
      subject = null;
      const { data } = await supabase.from('groups').select('id, subject_id').eq('id', ctx.groupA.id).single();
      expect(data.subject_id).toBeNull();
    });
  });

  describe.skipIf(!expensesReady)('expenses and reports', () => {
    const today = new Date().toISOString().slice(0, 10);

    it('Financier adds, changes and deletes an expense; every change is in the journal', async () => {
      const financier = as(ctx.cookies.financier);
      const created = await financier.post('/api/finance/expenses').send({ category: 'rent', amount: 500000, date: today, comment: 'zz_test' });
      expect(created.status).toBe(201);
      const id = created.body.expense.id;

      expect((await financier.patch(`/api/finance/expenses/${id}`).send({ amount: 600000 })).body.expense.amount).toBe(600000);

      const list = await financier.get(`/api/finance/expenses?month=${today.slice(0, 7)}&category=rent`);
      expect(list.body.expenses.some((e) => e.id === id)).toBe(true);

      expect((await financier.delete(`/api/finance/expenses/${id}`)).status).toBe(200);
      expect((await financier.delete(`/api/finance/expenses/${id}`)).status).toBe(404);

      const log = await financier.get('/api/audit?pageSize=100');
      const mine = actionsOf(log).filter((a) => a.startsWith('expense.'));
      expect(mine).toEqual(expect.arrayContaining(['expense.create', 'expense.update', 'expense.delete']));
    });

    it('checks the form', async () => {
      const financier = as(ctx.cookies.financier);
      expect((await financier.post('/api/finance/expenses').send({ category: 'party', amount: 10 })).status).toBe(400);
      expect((await financier.post('/api/finance/expenses').send({ category: 'rent', amount: -5 })).status).toBe(400);
      expect((await financier.post('/api/finance/expenses').send({ category: 'rent', amount: 1.5 })).status).toBe(400);
      expect((await financier.get('/api/finance/expenses?month=2026-13')).status).toBe(400);
    });

    it('nobody else touches expenses', async () => {
      for (const who of ['academic', 'teacher', 'student']) {
        expect((await as(ctx.cookies[who]).post('/api/finance/expenses').send({ category: 'rent', amount: 1 })).status).toBe(403);
      }
    });

    it('the report adds up: profit = income - expenses - salaries', async () => {
      const res = await as(ctx.cookies.financier).get(`/api/finance/reports?from=${today.slice(0, 7)}-01&to=${today}`);
      expect(res.status).toBe(200);
      const r = res.body;
      expect(r.profit).toBe(r.income - r.expenses.total - r.salaries);
      expect(r.expenses.byCategory.reduce((sum, c) => sum + c.amount, 0)).toBe(r.expenses.total);
      expect(r.expenses.byCategory.map((c) => c.category)).toEqual(['rent', 'salaries', 'advertising', 'utilities', 'materials', 'other']);
      expect(typeof r.activeStudents).toBe('number');
    });

    it('refuses a bad period', async () => {
      expect((await as(ctx.cookies.admin).get('/api/finance/reports?from=2026-02-10&to=2026-02-01')).status).toBe(400);
    });
  });

  describe.skipIf(!careersReady)('job applications', () => {
    let applicationId;
    afterAll(async () => { await supabase.from('job_applications').delete().like('full_name', 'zz_test_%'); });

    it('the public form accepts an application and answers no data', async () => {
      const res = await as(null).post('/api/careers/apply').send({ fullName: 'zz_test_candidate', contact: '+998900000000', position: 'Teacher' });
      expect(res.status).toBe(201);
      expect(Object.keys(res.body)).toEqual(['message']);
      const { data } = await supabase.from('job_applications').select('id').eq('full_name', 'zz_test_candidate').limit(1).single();
      applicationId = data.id;
    });

    it('checks the fields and the file type', async () => {
      expect((await as(null).post('/api/careers/apply').send({ fullName: 'a', contact: '1', position: '' })).status).toBe(400);
      const exe = await as(null).post('/api/careers/apply')
        .field('fullName', 'zz_test_candidate').field('contact', '+998900000001').field('position', 'Teacher')
        .attach('resume', Buffer.from('MZ-not-a-resume-but-an-exe-file'), 'cv.pdf');
      expect(exe.status).toBe(400);
    });

    it('an application with a PDF goes to the private bucket and is opened by a signed link', async () => {
      const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
      const res = await as(null).post('/api/careers/apply')
        .field('fullName', 'zz_test_with_pdf').field('contact', '+998900000002').field('position', 'Teacher')
        .attach('resume', pdf, 'cv.pdf');
      expect(res.status).toBe(201);
      const { data } = await supabase.from('job_applications').select('id, resume_path').eq('full_name', 'zz_test_with_pdf').limit(1).single();
      expect(data.resume_path).toMatch(/\.pdf$/);

      const link = await as(ctx.cookies.academic).get(`/api/careers/applications/${data.id}/resume`);
      expect(link.status).toBe(200);
      expect(link.body.url).toContain('token=');
      await supabase.storage.from('resumes').remove([data.resume_path]);
    });

    it('only Academic Manager and Admin read the list', async () => {
      for (const who of ['teacher', 'student', 'financier']) {
        expect((await as(ctx.cookies[who]).get('/api/careers/applications')).status).toBe(403);
      }
      expect((await as(null).get('/api/careers/applications')).status).toBe(401);
      expect((await as(ctx.cookies.academic).get('/api/careers/applications')).status).toBe(200);
    });

    it('Academic Manager writes notes but cannot accept or make accounts', async () => {
      const academic = as(ctx.cookies.academic);
      expect((await academic.post(`/api/careers/applications/${applicationId}/notes`).send({ text: 'good candidate' })).status).toBe(201);
      expect((await academic.patch(`/api/careers/applications/${applicationId}/status`).send({ status: 'interview' })).status).toBe(200);
      expect((await academic.patch(`/api/careers/applications/${applicationId}/status`).send({ status: 'accepted' })).status).toBe(403);
      const account = await academic.post(`/api/careers/applications/${applicationId}/account`).send({ username: 'zz_test_hire', email: 'a@b.co', role: 'Teacher' });
      expect(account.status).toBe(403);
    });

    it('an account is made only after "accepted", and only once', async () => {
      const admin = as(ctx.cookies.admin);
      const body = { username: 'zz_test_hire', email: 'zz_test_hire@example.invalid', role: 'Teacher' };
      expect((await admin.post(`/api/careers/applications/${applicationId}/account`).send(body)).status).toBe(409);

      expect((await admin.patch(`/api/careers/applications/${applicationId}/status`).send({ status: 'accepted' })).status).toBe(200);
      const first = await admin.post(`/api/careers/applications/${applicationId}/account`).send(body);
      expect([201, 409]).toContain(first.status); // 409: the fixed test username exists from an earlier run
      if (first.status === 201) {
        expect(first.body.temporaryPassword.length).toBeGreaterThanOrEqual(10);
        expect((await admin.post(`/api/careers/applications/${applicationId}/account`).send(body)).status).toBe(409);
        await supabase.from('users').update({ status: 'blocked' }).eq('username', 'zz_test_hire');
      }
      expect((await admin.post(`/api/careers/applications/${applicationId}/account`).send({ ...body, role: 'Admin' })).status).toBe(400);
    });
  });
});
