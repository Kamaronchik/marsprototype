// End-to-end check of student balance, lesson charges and freezing against the real database.
// Run AFTER schema_balance.sql:  npm run test-balance
// Test groups and balance history are deleted at the end; the "zz_test_*" accounts are blocked again.
const {
  supabase, check, markFailed, ensureUser, openSession, startServer, call, finish,
} = require('./testKit');
const { SLOTS, ROOMS, tashkentNow } = require('../utils/schedule');
const { LESSON_PRICE } = require('../utils/balance');

const GROUP_NAME = 'ZZ Balance A';
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

const balanceOf = async (id) => Number((await supabase.from('users').select('balance').eq('id', id).single()).data.balance);

const findFreeSlot = async (admin) => {
  const { groups } = (await call('GET', '/api/groups', admin)).body;
  const busy = (room, start) => groups.some((g) => g.status === 'active' && g.room === room && g.startTime === start);
  for (const start of SLOTS) {
    const room = ROOMS.find((r) => !busy(r, start));
    if (room) return { room, start };
  }
  throw new Error('No free room and time left for the test');
};

const testTopUp = async ({ admin, teacher, studentA }) => {
  console.log('\nTop up');
  const url = `/api/users/${studentA.id}/balance`;
  check('teacher cannot top up -> 403', (await call('POST', url, teacher, { amount: 1000 })).status === 403);
  check('amount 0 -> 400', (await call('POST', url, admin, { amount: 0 })).status === 400);
  check('negative amount -> 400', (await call('POST', url, admin, { amount: -5 })).status === 400);
  check('fractional amount -> 400', (await call('POST', url, admin, { amount: 1.5 })).status === 400);
  check('text amount -> 400', (await call('POST', url, admin, { amount: 'abc' })).status === 400);
  check('not a student -> 404', (await call('POST', `/api/users/${teacher.id}/balance`, admin, { amount: 1000 })).status === 404);
  check('balance is still 0 after bad requests', (await balanceOf(studentA.id)) === 0);

  const ok = await call('POST', url, admin, { amount: 300000, note: 'zz-test' });
  check('admin tops up 300 000', ok.status === 200 && ok.body.balance === 300000, ok.body);
  check('balance is saved in the database', (await balanceOf(studentA.id)) === 300000);
  const list = (await call('GET', '/api/users', admin)).body.users.find((u) => u.id === studentA.id);
  check('the people list shows the balance', list?.balance === 300000, list);
};

const testCharge = async ({ admin, studentA }, ctx) => {
  console.log('\nLesson charge');
  const mark = (status) => call('PUT', '/api/attendance/mark', admin, { groupId: ctx.group.id, studentId: studentA.id, status });

  check('lesson price is 90 000', LESSON_PRICE === 90000);
  check('first mark works', (await mark('present')).status === 200);
  check('first mark takes 90 000', (await balanceOf(studentA.id)) === 210000);
  check('the same mark again takes nothing', (await mark('present')).status === 200 && (await balanceOf(studentA.id)) === 210000);
  check('changing tick to cross takes nothing more', (await mark('absent')).status === 200 && (await balanceOf(studentA.id)) === 210000);

  const { data: history } = await supabase.from('balance_transactions').select('kind, amount').eq('student_id', studentA.id);
  check('history has one top up and one lesson', history.length === 2 && history.some((h) => h.kind === 'lesson' && Number(h.amount) === -90000), history);
};

const testFreeze = async ({ admin, teacher, studentA, studentB }, ctx) => {
  console.log('\nFreeze');
  const status = (who, value) => call('PATCH', `/api/users/${who.id}`, admin, { status: value });
  const today = async () => {
    const lesson = (await call('GET', '/api/attendance/today', teacher)).body.lessons?.find((l) => l.groupId === ctx.group.id);
    return lesson ? lesson.students.map((s) => s.id) : [];
  };

  check('admin cannot freeze themselves -> 400', (await status(admin, 'frozen')).status === 400);
  check('a teacher cannot be frozen -> 400', (await status(teacher, 'frozen')).status === 400);
  check('unknown status -> 400', (await status(studentB, 'asleep')).status === 400);
  check('before freezing the teacher sees the student', (await today()).includes(studentB.id));

  const frozen = await status(studentB, 'frozen');
  check('admin freezes a student', frozen.status === 200 && frozen.body.user.status === 'frozen', frozen.body);
  check('the frozen student is hidden from the teacher', !(await today()).includes(studentB.id));

  const before = await balanceOf(studentB.id);
  const marked = await call('PUT', '/api/attendance/mark', admin, { groupId: ctx.group.id, studentId: studentB.id, status: 'present' });
  check('a frozen student cannot be marked -> 400', marked.status === 400 && marked.body.code === 'STUDENT_FROZEN', marked.body);
  check('a frozen student is not charged', (await balanceOf(studentB.id)) === before);

  const { data: row } = await supabase.from('attendance').select('id').eq('student_id', studentB.id).eq('group_id', ctx.group.id);
  check('no attendance record was created', row.length === 0, row);

  const me = await call('GET', '/api/auth/me', { cookie: studentB.cookie });
  check('a frozen student has no session', me.status === 200 && me.body.user === null || me.status === 401, me.body);

  const back = await status(studentB, 'active');
  check('admin unfreezes the student', back.status === 200 && back.body.user.status === 'active', back.body);
  check('after unfreezing the teacher sees the student again', (await today()).includes(studentB.id));
  const again = await call('PUT', '/api/attendance/mark', admin, { groupId: ctx.group.id, studentId: studentB.id, status: 'present' });
  check('after unfreezing the student can be marked and is charged', again.status === 200 && (await balanceOf(studentB.id)) === before - 90000, again.body);
};

const cleanup = async (users, ctx) => {
  const ids = users.map((u) => u.id);
  if (ctx.group) {
    await supabase.from('attendance').delete().eq('group_id', ctx.group.id);
    await supabase.from('group_students').delete().eq('group_id', ctx.group.id);
    await supabase.from('groups').delete().eq('id', ctx.group.id);
  }
  await supabase.from('balance_transactions').delete().in('student_id', ids);
  await supabase.from('telegram_absences').delete().in('student_id', ids);
  await supabase.from('sessions').delete().in('user_id', ids);
  await supabase.from('notifications').delete().in('user_id', ids);
  await supabase.from('users').update({ status: 'blocked', payment_status: 'active', balance: 0 }).in('id', ids);
};

(async () => {
  const server = startServer();
  let users = [];
  const ctx = {};

  try {
    const raw = {
      admin: await ensureUser('admin', 'Admin'),
      teacher: await ensureUser('teacher', 'Teacher'),
      studentA: await ensureUser('student_a', 'Student'),
      studentB: await ensureUser('student_b', 'Student'),
    };
    users = Object.values(raw);
    await supabase.from('balance_transactions').delete().in('student_id', [raw.studentA.id, raw.studentB.id]);
    await supabase.from('users').update({ balance: 0 }).in('id', [raw.studentA.id, raw.studentB.id]);

    const who = {};
    for (const [key, user] of Object.entries(raw)) who[key] = await openSession(user);

    const free = await findFreeSlot(who.admin);
    const created = await call('POST', '/api/groups', who.admin, {
      name: GROUP_NAME, teacherId: who.teacher.id, room: free.room, weekdays: ALL_DAYS, startTime: free.start,
    });
    if (created.status !== 201) throw new Error(`Test group was not created: ${JSON.stringify(created.body)}`);
    ctx.group = created.body.group;
    for (const key of ['studentA', 'studentB']) {
      await call('POST', `/api/groups/${ctx.group.id}/students`, who.admin, { studentId: who[key].id });
    }
    console.log(`Today in Tashkent: ${tashkentNow().date}`);

    await testTopUp(who);
    await testCharge(who, ctx);
    await testFreeze(who, ctx);
  } catch (error) {
    console.error('Test crashed:', error);
    markFailed();
  } finally {
    if (users.length) await cleanup(users, ctx);
    finish(server);
  }
})();
