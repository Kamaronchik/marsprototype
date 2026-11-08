// End-to-end check of payments, debtors and teacher salaries against the real database.
// Run:  npm run test-finance
// Test payments and salaries are deleted at the end; the "zz_test_*" accounts are blocked again.
const {
  supabase, check, markFailed, ensureUser, openSession, startServer, call, finish,
} = require('./testKit');
const { tashkentNow } = require('../utils/schedule');

const NOTE = 'zz-test';
const month = tashkentNow().date.slice(0, 7);

const notificationTypes = async (who) => (await call('GET', '/api/notifications', who)).body.notifications.map((n) => n.type);
const overview = async (who) => (await call('GET', '/api/finance/overview', who)).body;

const testAccess = async ({ admin, financier, teacher, studentA }) => {
  console.log('\nAccess control');
  for (const path of ['/api/finance/overview', '/api/finance/payments', '/api/finance/salaries', '/api/finance/teachers']) {
    check(`teacher cannot open ${path} -> 403`, (await call('GET', path, teacher)).status === 403);
    check(`student cannot open ${path} -> 403`, (await call('GET', path, studentA)).status === 403);
  }
  check('no session -> 401', (await call('GET', '/api/finance/overview')).status === 401);
  check('admin can open the overview', (await call('GET', '/api/finance/overview', admin)).status === 200);
  check('financier can open the overview', (await call('GET', '/api/finance/overview', financier)).status === 200);
  check('teacher cannot write a payment -> 403', (await call('POST', '/api/finance/payments', teacher, {})).status === 403);
  check('financier lists teachers for the salary form', (await call('GET', '/api/finance/teachers', financier)).body.teachers?.some((t) => t.id === teacher.id));
};

const testPayments = async ({ admin, financier, studentA, studentB }) => {
  console.log('\nStudent payments');
  const pay = (who, body) => call('POST', '/api/finance/payments', who, { amount: 500000, period: month, note: NOTE, ...body });

  check('no student -> 400', (await pay(financier, {})).status === 400);
  check('unknown student -> 404', (await pay(financier, { studentId: '00000000-0000-4000-8000-000000000000' })).status === 404);
  check('amount 0 -> 400', (await pay(financier, { studentId: studentA.id, amount: 0 })).status === 400);
  check('fractional amount -> 400', (await pay(financier, { studentId: studentA.id, amount: 1.5 })).status === 400);
  check('period 2026-13 -> 400', (await pay(financier, { studentId: studentA.id, period: '2026-13' })).status === 400);
  check('unknown method -> 400', (await pay(financier, { studentId: studentA.id, method: 'gold' })).status === 400);

  const before = await overview(admin);
  await call('PATCH', `/api/students/${studentA.id}/payment-status`, admin, { paymentStatus: 'debtor' });

  const kept = await pay(financier, { studentId: studentA.id, markPaid: false });
  check('payment is saved', kept.status === 201 && kept.body.payment.amount === 500000 && kept.body.payment.studentName === studentA.full_name, kept.body);
  const stillDebtor = (await call('GET', '/api/students?paymentStatus=debtor', admin)).body.students.some((s) => s.id === studentA.id);
  check('without markPaid the student stays a debtor', stillDebtor);

  const cleared = await pay(financier, { studentId: studentA.id, amount: 250000, markPaid: true, method: 'card' });
  check('markPaid makes the student active again', cleared.status === 201 && cleared.body.paymentStatus === 'active', cleared.body);

  const types = await notificationTypes(studentA);
  check('the student is told about the payment', types.includes('payment.received'));
  check('the student is told the debt is cleared', types.includes('payment.cleared'));

  const after = await overview(admin);
  check('this month\'s revenue grows by the payments', after.revenue === before.revenue + 750000, { before: before.revenue, after: after.revenue });
  check('the overview has 6 months of history', after.history.length === 6 && after.history[5].month === month, after.history);

  const list = (await call('GET', `/api/finance/payments?studentId=${studentA.id}`, admin)).body.payments;
  check('payments can be filtered by student', list.length >= 2 && list.every((p) => p.studentId === studentA.id));
  const today = tashkentNow().date;
  check('date range with today includes them', (await call('GET', `/api/finance/payments?from=${today}&to=${today}`, admin)).body.payments.some((p) => p.studentId === studentA.id));
  check('date range in the past excludes them', !(await call('GET', '/api/finance/payments?from=2020-01-01&to=2020-01-31', admin)).body.payments.some((p) => p.studentId === studentA.id));
  check('bad date range -> 400', (await call('GET', '/api/finance/payments?from=2026-12-01&to=2026-01-01', admin)).status === 400);

  check('studentB was not touched', !(await call('GET', `/api/finance/payments?studentId=${studentB.id}`, admin)).body.payments.length);
};

const testDebtors = async ({ admin, financier, studentA, studentB }) => {
  console.log('\nReminding debtors');
  await call('PATCH', `/api/students/${studentB.id}/payment-status`, admin, { paymentStatus: 'debtor' });
  await supabase.from('notifications').delete().eq('user_id', studentB.id);

  const first = await call('POST', '/api/finance/remind-debtors', financier);
  check('reminder goes to the debtors', first.status === 200 && first.body.debtors >= 1, first.body);
  await call('POST', '/api/finance/remind-debtors', admin);

  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
    .eq('user_id', studentB.id).eq('dedupe_key', `payment.debtor:${studentB.id}:${month}`);
  check('pressing it twice sends one reminder per month', count === 1, count);
  check('the debtor sees the reminder', (await notificationTypes(studentB)).includes('payment.debtor'));
  check('an active student gets none', !(await supabase.from('notifications').select('id').eq('user_id', studentA.id).eq('dedupe_key', `payment.debtor:${studentA.id}:${month}`)).data.length);
};

const testSalaries = async ({ admin, financier, teacher, studentA }) => {
  console.log('\nTeacher salaries');
  const pay = (who, body) => call('POST', '/api/finance/salaries', who, { amount: 3000000, period: month, note: NOTE, ...body });

  check('a student is not a teacher -> 404', (await pay(admin, { teacherId: studentA.id })).status === 404);
  check('no teacher -> 400', (await pay(admin, {})).status === 400);
  check('amount -5 -> 400', (await pay(admin, { teacherId: teacher.id, amount: -5 })).status === 400);
  check('bad period -> 400', (await pay(admin, { teacherId: teacher.id, period: 'November' })).status === 400);

  const before = await overview(admin);
  const created = await pay(financier, { teacherId: teacher.id });
  check('salary is saved', created.status === 201 && created.body.salary.teacherName === teacher.full_name && created.body.salary.amount === 3000000, created.body);
  check('the teacher is told', (await notificationTypes(teacher)).includes('salary.paid'));
  check('salaries of the month grow', (await overview(admin)).salaries === before.salaries + 3000000);

  const list = (await call('GET', `/api/finance/salaries?teacherId=${teacher.id}`, admin)).body.salaries;
  check('salaries can be filtered by teacher', list.length >= 1 && list.every((s) => s.teacherId === teacher.id));
  check('teacher cannot read salaries -> 403', (await call('GET', '/api/finance/salaries', teacher)).status === 403);
};

// --- run -------------------------------------------------------------------

const cleanup = async (users) => {
  const ids = users.map((u) => u.id);
  await supabase.from('payments').delete().eq('note', NOTE);
  await supabase.from('teacher_salaries').delete().eq('note', NOTE);
  await supabase.from('sessions').delete().in('user_id', ids);
  await supabase.from('notifications').delete().in('user_id', ids);
  await supabase.from('users').update({ status: 'blocked', payment_status: 'active' }).in('id', ids);
};

(async () => {
  const server = startServer();
  let users = [];

  try {
    const raw = {
      admin: await ensureUser('admin', 'Admin'),
      financier: await ensureUser('financier', 'Financier'),
      teacher: await ensureUser('teacher', 'Teacher'),
      studentA: await ensureUser('student_a', 'Student'),
      studentB: await ensureUser('student_b', 'Student'),
    };
    users = Object.values(raw);
    await supabase.from('notifications').delete().in('user_id', users.map((u) => u.id));

    const people = {};
    for (const [key, user] of Object.entries(raw)) people[key] = { ...(await openSession(user)) };

    await testAccess(people);
    await testPayments(people);
    await testDebtors(people);
    await testSalaries(people);
  } catch (error) {
    markFailed();
    console.error('\nTest run stopped:', error.message);
  } finally {
    if (users.length) await cleanup(users);
    finish(server);
  }
})();
