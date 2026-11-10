// End-to-end check of homework, grades and the AI tutor against the real database.
// Run AFTER schema_learning.sql:  npm run test-learning
// Test accounts are the fixed "zz_test_*" ones (blocked again at the end); the test group is deleted.
const {
  supabase, check, markFailed, ensureUser, openSession, startServer, call, finish,
} = require('./testKit');
const { SLOTS, ROOMS } = require('../utils/schedule');

const GROUP = 'ZZ Learn A';

const findFreeSlot = async (admin) => {
  const { groups } = (await call('GET', '/api/groups', admin)).body;
  const busy = (room, start) => groups.some((g) => g.status === 'active' && g.room === room && g.startTime === start);
  for (const start of SLOTS) {
    const room = ROOMS.find((r) => !busy(r, start));
    if (room) return { room, start };
  }
  throw new Error('No free room and time left for the test');
};

const run = async ({ admin, teacher, teacherB, studentIn, studentOut }, ctx) => {
  const free = await findFreeSlot(admin);
  const created = await call('POST', '/api/groups', admin, {
    name: GROUP, teacherId: teacher.id, room: free.room, weekdays: [1, 2, 3, 4, 5, 6, 7], startTime: free.start,
  });
  check('test group created', created.status === 201, created.body);
  const groupId = created.body.group.id;
  check('student added to the group', (await call('POST', `/api/groups/${groupId}/students`, admin, { studentId: studentIn.id })).status < 300);

  console.log('\nHomework: giving');
  const base = { groupId, title: 'ZZ Build a card', description: 'HTML + CSS', maxScore: 10 };
  check('student cannot give homework -> 403', (await call('POST', '/api/homework', studentIn, base)).status === 403);
  check('another teacher cannot give homework to this group -> 404', (await call('POST', '/api/homework', teacherB, base)).status === 404);
  check('empty title -> 400', (await call('POST', '/api/homework', teacher, { ...base, title: ' ' })).status === 400);
  check('maximum score 0 -> 400', (await call('POST', '/api/homework', teacher, { ...base, maxScore: 0 })).status === 400);
  check('bad date -> 400', (await call('POST', '/api/homework', teacher, { ...base, dueDate: '2026-13-45' })).status === 400);

  const given = await call('POST', '/api/homework', teacher, { ...base, dueDate: '2099-01-01' });
  check('teacher gives homework', given.status === 201, given.body);
  const homeworkId = given.body.id;

  const bell = (await call('GET', '/api/notifications', studentIn)).body;
  check('the student is told about the new homework', bell.notifications.some((n) => n.type === 'homework.new'), bell);

  console.log('\nHomework: student side');
  const mine = (await call('GET', '/api/homework/mine', studentIn)).body.homework;
  const item = mine.find((h) => h.id === homeworkId);
  check('the student sees it as "todo"', item?.state === 'todo' && item.overdue === false, item);
  check('a student outside the group does not see it', !(await call('GET', '/api/homework/mine', studentOut)).body.homework.some((h) => h.id === homeworkId));
  check('empty answer -> 400', (await call('POST', `/api/homework/${homeworkId}/submit`, studentIn, { answer: ' ' })).status === 400);
  check('link without http -> 400', (await call('POST', `/api/homework/${homeworkId}/submit`, studentIn, { link: 'javascript:alert(1)' })).status === 400);
  check('a student outside the group cannot send -> 404', (await call('POST', `/api/homework/${homeworkId}/submit`, studentOut, { answer: 'x' })).status === 404);

  check('answer is sent', (await call('POST', `/api/homework/${homeworkId}/submit`, studentIn, { answer: '<div class="card"></div>' })).status === 200);
  check('the answer can be changed before the mark', (await call('POST', `/api/homework/${homeworkId}/submit`, studentIn, { answer: 'v2', link: 'https://example.com' })).status === 200);
  const afterSend = (await call('GET', '/api/homework/mine', studentIn)).body.homework.find((h) => h.id === homeworkId);
  check('state is "submitted" with the new answer', afterSend.state === 'submitted' && afterSend.answer === 'v2', afterSend);
  check('the teacher is told about the answer', (await call('GET', '/api/notifications', teacher)).body.notifications.some((n) => n.type === 'homework.submitted'));

  console.log('\nHomework: teacher side');
  check('another teacher cannot read the answers -> 404', (await call('GET', `/api/homework/${homeworkId}/submissions`, teacherB)).status === 404);
  const listed = (await call('GET', `/api/homework/${homeworkId}/submissions`, teacher)).body;
  const row = listed.students.find((s) => s.id === studentIn.id);
  check('teacher sees the answer', row?.submission?.answer === 'v2', listed);
  const overview = (await call('GET', '/api/homework', teacher)).body.homework.find((h) => h.id === homeworkId);
  check('counts: 1 sent, 0 graded', overview?.submittedCount === 1 && overview.gradedCount === 0, overview);

  const submissionId = row.submission.id;
  check('score above the maximum -> 400', (await call('PATCH', `/api/homework/submissions/${submissionId}/grade`, teacher, { score: 11 })).status === 400);
  check('decimal score -> 400', (await call('PATCH', `/api/homework/submissions/${submissionId}/grade`, teacher, { score: 7.5 })).status === 400);
  check('another teacher cannot grade -> 404', (await call('PATCH', `/api/homework/submissions/${submissionId}/grade`, teacherB, { score: 5 })).status === 404);
  check('teacher grades 8 / 10', (await call('PATCH', `/api/homework/submissions/${submissionId}/grade`, teacher, { score: 8, feedback: 'Good' })).status === 200);
  check('the student cannot resend a graded homework -> 409', (await call('POST', `/api/homework/${homeworkId}/submit`, studentIn, { answer: 'again' })).status === 409);

  console.log('\nGrades');
  const mineGrades = (await call('GET', '/api/grades/mine', studentIn)).body;
  const hwGrade = mineGrades.groups.flatMap((g) => g.grades).find((g) => g.title === base.title);
  check('the homework mark is in the grades with 80%', hwGrade?.percent === 80 && hwGrade.fromHomework, mineGrades);
  check('the student is told about the mark', (await call('GET', '/api/notifications', studentIn)).body.notifications.some((n) => n.type === 'homework.graded'));

  const test = { studentId: studentIn.id, groupId, kind: 'test', title: 'ZZ Test 1', score: 4, maxScore: 5 };
  check('student cannot add a mark -> 403', (await call('POST', '/api/grades', studentIn, test)).status === 403);
  check('another teacher cannot add a mark -> 404', (await call('POST', '/api/grades', teacherB, test)).status === 404);
  check('a student outside the group -> 404', (await call('POST', '/api/grades', teacher, { ...test, studentId: studentOut.id })).status === 404);
  check('kind "homework" cannot be added by hand -> 400', (await call('POST', '/api/grades', teacher, { ...test, kind: 'homework' })).status === 400);
  check('score above the maximum -> 400', (await call('POST', '/api/grades', teacher, { ...test, score: 6 })).status === 400);
  const added = await call('POST', '/api/grades', teacher, test);
  check('teacher adds 4 / 5 for a test', added.status === 201, added.body);

  const groupGrades = (await call('GET', `/api/grades/group/${groupId}`, teacher)).body;
  const own = groupGrades.students.find((s) => s.id === studentIn.id);
  check('average of 80% and 80% is 80', own?.average === 80 && own.grades.length === 2, own);
  check('another teacher cannot read the group marks -> 404', (await call('GET', `/api/grades/group/${groupId}`, teacherB)).status === 404);
  check('a homework mark cannot be deleted here -> 400', (await call('DELETE', `/api/grades/${hwGrade.id}`, teacher)).status === 400);
  check('teacher deletes the test mark', (await call('DELETE', `/api/grades/${added.body.id}`, teacher)).status === 200);

  console.log('\nAI tutor');
  check('a teacher cannot use the tutor -> 403', (await call('POST', '/api/tutor/ask', teacher, { message: 'hi' })).status === 403);
  check('empty question -> 400', (await call('POST', '/api/tutor/ask', studentIn, { message: ' ' })).status === 400);
  check('too long question -> 400', (await call('POST', '/api/tutor/ask', studentIn, { message: 'x'.repeat(2001) })).status === 400);
  if (process.env.GEMINI_API_KEY) {
    const answer = await call('POST', '/api/tutor/ask', studentIn, { message: 'What is a variable in JavaScript? One sentence.', language: 'en', homeworkId });
    check('the tutor answers', answer.status === 200 && answer.body.answer?.length > 0, answer.body);
  } else {
    console.log('SKIP  the tutor answer (GEMINI_API_KEY is not set)');
  }

  console.log('\nHomework: removing');
  check('teacher removes the homework', (await call('DELETE', `/api/homework/${homeworkId}`, teacher)).status === 200);
  check('it is gone for the student', !(await call('GET', '/api/homework/mine', studentIn)).body.homework.some((h) => h.id === homeworkId));
  ctx.groupId = groupId;
};

const cleanup = async (users) => {
  const ids = users.map((u) => u.id);
  await supabase.from('sessions').delete().in('user_id', ids);
  await supabase.from('groups').delete().eq('name', GROUP); // homework, answers and marks go with it
  await supabase.from('notifications').delete().in('user_id', ids);
  await supabase.from('users').update({ status: 'blocked', payment_status: 'active' }).in('id', ids);
};

(async () => {
  const server = startServer();
  const ctx = {};
  let users = [];

  try {
    const { error: missing } = await supabase.from('homework').select('id').limit(1);
    if (missing) throw new Error('Run schema_learning.sql in Supabase first.');

    const raw = {
      admin: await ensureUser('admin', 'Admin'),
      teacher: await ensureUser('teacher', 'Teacher'),
      teacherB: await ensureUser('teacher_b', 'Teacher'),
      studentIn: await ensureUser('student_a', 'Student'),
      studentOut: await ensureUser('student_b', 'Student'),
    };
    users = Object.values(raw);
    await supabase.from('groups').delete().eq('name', GROUP);
    await supabase.from('notifications').delete().in('user_id', users.map((u) => u.id));

    const people = {};
    for (const [key, user] of Object.entries(raw)) people[key] = await openSession(user);
    await run(people, ctx);
  } catch (error) {
    markFailed();
    console.error('\nTest run stopped:', error.message);
  } finally {
    if (users.length) await cleanup(users);
    finish(server);
  }
})();
