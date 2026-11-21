// End-to-end check of the academic manager: lessons with topics, ratings, risk list, AI reports, messages.
// Run AFTER 013_academic_manager.sql:  npm run test-academic
// Gemini and Telegram are replaced by fakes: nothing is sent anywhere and no model is called.
// Test accounts are the fixed "zz_test_*" ones (blocked again at the end); the test group is deleted.

// The fake Gemini must be in place BEFORE the server loads the AI service.
const gemini = require('../services/gemini');
const prompts = [];
let geminiOn = true;
gemini.askGemini = async (args) => {
  prompts.push(`${args.system}\n${args.text}`);
  if (!geminiOn) throw new Error('Gemini is switched off in the test');
  if (args.system.startsWith('You check school homework')) return '[]';
  return 'Hello {{NAME}}. Work on loops. 1. Loop A 2. Loop B 3. Loop C';
};

const {
  supabase, check, markFailed, ensureUser, openSession, startServer, call, finish,
} = require('./testKit');
const bot = require('../utils/telegramBot');
const { SLOTS, ROOMS, tashkentNow } = require('../utils/schedule');
const { addDays, isMarkingOpen } = require('../utils/attendance');

const GROUP = 'ZZ Academic A';
const CHAT = 710000000 + Math.floor(Math.random() * 1000000);

// What the bot "sends" is kept here.
const sent = [];
bot.defaults.send = async (chatId, text, options) => { sent.push({ chatId, text, options }); };
bot.defaults.answerCallback = async () => {};

const findFreeSlot = async (admin) => {
  const { groups } = (await call('GET', '/api/groups', admin)).body;
  const busy = (room, start) => groups.some((g) => g.status === 'active' && g.room === room && g.startTime === start);
  for (const start of SLOTS) {
    const room = ROOMS.find((r) => !busy(r, start));
    if (room) return { room, start };
  }
  throw new Error('No free room and time left for the test');
};

const run = async (who, ctx) => {
  const { admin, am, teacher, teacherB, student, studentB } = who;
  const free = await findFreeSlot(admin);
  const created = await call('POST', '/api/groups', admin, {
    name: GROUP, teacherId: teacher.id, room: free.room, weekdays: [1, 2, 3, 4, 5, 6, 7], startTime: free.start,
  });
  check('test group created', created.status === 201, created.body);
  const groupId = created.body.group.id;
  ctx.groupId = groupId;
  for (const s of [student, studentB]) {
    check('student added to the group', (await call('POST', `/api/groups/${groupId}/students`, admin, { studentId: s.id })).status < 300);
  }

  console.log('\nRights of the academic manager');
  const reads = [
    '/api/attendance', '/api/attendance/unmarked', `/api/grades/group/${groupId}`, '/api/homework', '/api/groups', '/api/groups/options',
    `/api/groups/${groupId}/students`, '/api/lessons', '/api/schedule', '/api/ratings', '/api/academic/dashboard',
    '/api/academic/students/risk', '/api/academic/teachers', '/api/notifications',
  ];
  for (const path of reads) check(`GET ${path} -> 200`, (await call('GET', path, am)).status === 200);

  const closed = [
    ['GET', '/api/finance/overview'], ['GET', '/api/finance/payments'], ['GET', '/api/finance/salaries'],
    ['GET', '/api/admin/shop/products'], ['GET', '/api/admin/telegram'], ['GET', '/api/users'], ['GET', '/api/students'],
    ['GET', '/api/wallet'],
  ];
  for (const [method, path] of closed) check(`${method} ${path} -> 403`, (await call(method, path, am)).status === 403);
  check('cannot create a user -> 403', (await call('POST', '/api/users', am, { username: 'zz_x' })).status === 403);
  check('cannot delete a user -> 403', (await call('DELETE', `/api/users/${student.id}`, am)).status === 403);
  check('cannot give homework -> 403', (await call('POST', '/api/homework', am, { groupId, title: 'x' })).status === 403);
  check('cannot add a mark -> 403', (await call('POST', '/api/grades', am, { groupId, studentId: student.id })).status === 403);
  check('cannot mark attendance -> 403', (await call('PUT', '/api/attendance/mark', am, { groupId, studentId: student.id, status: 'present' })).status === 403);
  check('cannot create a group -> 403', (await call('POST', '/api/groups', am, { name: 'x' })).status === 403);
  check('cannot hold a lesson -> 403', (await call('POST', '/api/lessons', am, { groupId })).status === 403);

  const groupsSeen = (await call('GET', '/api/groups', am)).body.groups;
  check('group prices are hidden from the manager', groupsSeen.length > 0 && groupsSeen.every((g) => !('monthlyPrice' in g)), groupsSeen[0]);
  const studentsSeen = (await call('GET', `/api/groups/${groupId}/students`, am)).body.students;
  check('payment status and email are hidden from the manager', studentsSeen.length === 2 && studentsSeen.every((s) => !('paymentStatus' in s) && !('email' in s)), studentsSeen);

  console.log('\nOther roles cannot use the academic API');
  for (const [name, who2] of [['student', student], ['teacher', teacher]]) {
    check(`${name}: dashboard -> 403`, (await call('GET', '/api/academic/dashboard', who2)).status === 403);
    check(`${name}: teacher analysis -> 403`, (await call('GET', `/api/academic/reports/teacher/${teacher.id}`, who2)).status === 403);
    check(`${name}: lesson journal -> 403`, (await call('GET', '/api/lessons', who2)).status === 403);
    check(`${name}: all ratings -> 403`, (await call('GET', '/api/ratings', who2)).status === 403);
  }

  console.log('\nSchedule');
  const slot = { groupId, weekday: 3, startTime: '10:00', endTime: '11:30' };
  check('a teacher cannot change the schedule -> 403', (await call('POST', '/api/schedule', teacher, slot)).status === 403);
  check('end before start -> 400', (await call('POST', '/api/schedule', am, { ...slot, endTime: '09:30' })).status === 400);
  check('bad weekday -> 400', (await call('POST', '/api/schedule', am, { ...slot, weekday: 9 })).status === 400);
  const row = await call('POST', '/api/schedule', am, slot);
  check('the manager adds a lesson time', row.status === 201, row.body);
  check('the same time twice -> 409', (await call('POST', '/api/schedule', am, slot)).status === 409);
  const listed = (await call('GET', `/api/schedule?groupId=${groupId}`, am)).body.slots;
  check('the schedule shows it', listed.some((s) => s.scheduleId === row.body.id && s.weekday === 3 && s.startTime === '10:00'), listed);
  check('the manager changes it', (await call('PATCH', `/api/schedule/${row.body.id}`, am, { endTime: '11:45' })).status === 200);
  check('the manager deletes it', (await call('DELETE', `/api/schedule/${row.body.id}`, am)).status === 200);
  check('deleting twice -> 404', (await call('DELETE', `/api/schedule/${row.body.id}`, am)).status === 404);

  console.log('\nHolding a lesson');
  const open = isMarkingOpen();
  const actor = open ? teacher : admin; // outside 09:00-22:00 only the admin may mark
  if (!open) console.log('      (school is closed now: the admin holds the lesson)');
  const today = (await call('GET', '/api/lessons/today', teacher)).body;
  check('the teacher sees today\'s lesson', today.lessons?.some((l) => l.groupId === groupId && l.students.length === 2), today);
  const marks = [{ studentId: student.id, status: 'present' }, { studentId: studentB.id, status: 'absent' }];
  const form = { groupId, topic: 'ZZ Loops in JavaScript', attendance: marks, homework: { title: 'ZZ Loop homework', description: 'for and while' } };
  check('no topic -> 400', (await call('POST', '/api/lessons', actor, { ...form, topic: '   ' })).status === 400);
  check('no attendance -> 400', (await call('POST', '/api/lessons', actor, { ...form, attendance: [] })).status === 400);
  check('a student outside the list -> 400', (await call('POST', '/api/lessons', actor, { ...form, attendance: [{ studentId: teacherB.id, status: 'present' }] })).status === 400);
  check('another teacher cannot hold it -> 404 or 403', [404, 403].includes((await call('POST', '/api/lessons', teacherB, form)).status));
  check('a student cannot hold it -> 403', (await call('POST', '/api/lessons', student, form)).status === 403);

  const held = await call('POST', '/api/lessons', actor, form);
  check('the lesson is held with a topic', held.status === 201 && held.body.id && held.body.homeworkId, held.body);
  const lessonId = held.body.id;
  ctx.lessonId = lessonId;
  const { data: att } = await supabase.from('attendance').select('student_id, status, lesson_id').eq('group_id', groupId);
  check('attendance is tied to the lesson', att.length === 2 && att.every((a) => a.lesson_id === lessonId), att);
  const { data: hw } = await supabase.from('homework').select('lesson_id').eq('id', held.body.homeworkId).single();
  check('homework is tied to the lesson', hw.lesson_id === lessonId, hw);
  const again = await call('POST', '/api/lessons', actor, { ...form, topic: 'ZZ Loops v2', homework: undefined });
  check('sending the form again corrects the same lesson', again.status === 201 && again.body.id === lessonId, again.body);

  const journal = (await call('GET', `/api/lessons?groupId=${groupId}`, am)).body.lessons;
  check('the manager sees the lesson with its topic, marks and homework', journal.length === 1 && journal[0].topic === 'ZZ Loops v2' && journal[0].present === 1 && journal[0].absent === 1 && journal[0].homeworkCount === 1, journal);
  check('the dashboard counts today\'s lessons', (await call('GET', '/api/academic/dashboard', am)).body.lessonsToday >= 1);

  console.log('\nWeekly question: Telegram');
  await supabase.from('telegram_links').delete().eq('user_id', studentB.id);
  await supabase.from('telegram_links').insert({ user_id: studentB.id, chat_id: CHAT, language: 'en' });
  const prompt = await call('POST', '/api/ratings/send-prompts', am);
  check('the weekly question is sent', prompt.status === 200 && prompt.body.sent >= 2, prompt.body);
  const message = sent.find((m) => m.chatId === CHAT);
  check('Telegram gets the question with buttons 1-5', message?.options?.inline?.[0]?.length === 5 && message.options.inline[0][4].data === `rate:${lessonId}:5`, message);
  check('the bell gets the question too', (await call('GET', '/api/notifications', student)).body.notifications.some((n) => n.type === 'lesson.rate'));
  await bot.handleUpdate({ callback_query: { id: 'cb', data: `rate:${lessonId}:5`, message: { chat: { id: CHAT } } } });
  const { data: viaBot } = await supabase.from('lesson_ratings').select('score').eq('lesson_id', lessonId).eq('student_id', studentB.id);
  check('the rating from the bot button is saved', viaBot.length === 1 && viaBot[0].score === 5, viaBot);
  await bot.handleUpdate({ callback_query: { id: 'cb', data: `rate:${lessonId}:1`, message: { chat: { id: CHAT } } } });
  const { data: viaBot2 } = await supabase.from('lesson_ratings').select('score').eq('lesson_id', lessonId).eq('student_id', studentB.id);
  check('a second press does not change it', viaBot2.length === 1 && viaBot2[0].score === 5, viaBot2);

  console.log('\nRating a lesson (cabinet)');
  const pending = (await call('GET', '/api/ratings/pending', student)).body;
  check('the student has a lesson to rate', pending.lesson?.id === lessonId, pending);
  check('a teacher has no weekly question -> 403', (await call('GET', '/api/ratings/pending', teacher)).status === 403);
  check('score 6 -> 400', (await call('POST', '/api/ratings', student, { lessonId, score: 6 })).status === 400);
  check('score 0 -> 400', (await call('POST', '/api/ratings', student, { lessonId, score: 0 })).status === 400);
  check('a teacher cannot rate a lesson -> 403', (await call('POST', '/api/ratings', teacherB, { lessonId, score: 3 })).status === 403);
  const rated = await call('POST', '/api/ratings', student, { lessonId, score: 3, comment: 'ZZ too fast' });
  check('the rating is saved', rated.status === 201, rated.body);
  const twice = await call('POST', '/api/ratings', student, { lessonId, score: 5 });
  check('the same lesson cannot be rated twice -> 409', twice.status === 409 && twice.body.code === 'ALREADY', twice.body);
  check('the question is gone after the answer', (await call('GET', '/api/ratings/pending', student)).body.lesson === null);

  console.log('\nAnonymity');
  const forTeacher = await call('GET', '/api/ratings/mine', teacher);
  const forManager = await call('GET', `/api/ratings?groupId=${groupId}`, am); // only this test's group: other groups may hold real answers
  check('the teacher sees 2 answers, average 4', forTeacher.body.count === 2 && forTeacher.body.average === 4, forTeacher.body);
  check('the teacher sees the comment', forTeacher.body.answers.some((a) => a.comment === 'ZZ too fast'));
  for (const [name, res] of [['teacher', forTeacher], ['manager', forManager]]) {
    const text = JSON.stringify(res.body);
    check(`${name}: no student id or name in the answers`, !text.includes(student.id) && !text.includes(studentB.id) && !text.includes('ZZ Test') && !/student_?id/i.test(text), text.slice(0, 200));
  }
  check('the manager sees group and date of the answer', forManager.body.answers.every((a) => a.groupName === GROUP && a.date));
  const lessonsJournal = (await call('GET', `/api/lessons?groupId=${groupId}`, am)).body.lessons[0];
  check('the journal shows the average rating only', lessonsJournal.averageRating === 4 && lessonsJournal.ratingCount === 2, lessonsJournal);

  console.log('\nOne rating a week');
  const older = await call('POST', '/api/lessons', admin, { ...form, date: addDays(tashkentNow().date, -1), topic: 'ZZ Older lesson', homework: undefined });
  check('an older lesson is added by the admin', older.status === 201, older.body);
  const tooSoon = await call('POST', '/api/ratings', student, { lessonId: older.body.id, score: 4 });
  check('a second lesson in the same week -> 429', tooSoon.status === 429 && tooSoon.body.code === 'TOO_SOON', tooSoon.body);

  console.log('\nStudents at risk');
  for (let back = 3; back <= 5; back += 1) {
    await supabase.from('attendance').upsert({ group_id: groupId, student_id: student.id, lesson_date: addDays(tashkentNow().date, -back), status: 'absent' }, { onConflict: 'group_id,student_id,lesson_date' });
  }
  const risk = (await call('GET', '/api/academic/students/risk', am)).body.students;
  const me = risk.find((s) => s.studentId === student.id);
  check('3+ absences in two weeks puts the student on the list', me?.reasons.includes('absences') && me.absences >= 3, risk);
  check('a student with fewer than 3 absences is not on the list', !risk.some((s) => s.studentId === studentB.id), risk);

  console.log('\nAI reports');
  const noReport = await call('GET', `/api/academic/reports/student/${student.id}`, am);
  check('before the first analysis there is no report', noReport.status === 200 && noReport.body.report === null, noReport.body);
  const bad = await call('POST', '/api/academic/reports/robot/' + student.id + '/refresh', am, {});
  check('unknown report type -> 400', bad.status === 400);

  prompts.length = 0;
  const report = await call('POST', `/api/academic/reports/student/${student.id}/refresh`, am, { language: 'ru' });
  check('the student analysis is made', report.status === 200 && report.body.report.text.includes('Loop A'), report.body);
  check('the real name is put in AFTER the answer', report.body.report.text.startsWith('Hello ZZ Test student_a'), report.body.report.text);
  const sentToAi = prompts.join('\n');
  check('the AI got no name, username or email', !sentToAi.includes('ZZ Test') && !sentToAi.includes('zz_test') && !sentToAi.includes('example.invalid'), sentToAi.slice(0, 300));
  check('the AI got the student id and the lesson topic', sentToAi.includes(student.id) && sentToAi.includes('ZZ Loops'), sentToAi.slice(0, 300));
  check('the AI was asked for the answer language', sentToAi.includes('Russian'));
  check('the report is saved', (await call('GET', `/api/academic/reports/student/${student.id}`, am)).body.report?.text.includes('ZZ Test student_a'));
  await call('POST', `/api/academic/reports/student/${student.id}/refresh`, am, { language: 'ru' });
  const { data: saved } = await supabase.from('ai_reports').select('id').eq('type', 'student').eq('target_id', student.id);
  check('pressing the button again keeps one report per day', saved.length === 1, saved);

  const teacherReport = await call('POST', `/api/academic/reports/teacher/${teacher.id}/refresh`, am, { language: 'en' });
  check('the teacher analysis is made', teacherReport.status === 200, teacherReport.body);
  check('the teacher prompt carries the anonymous comment, not the author', prompts.at(-1).includes('ZZ too fast') && !prompts.at(-1).includes('ZZ Test'));
  const groupReport = await call('POST', `/api/academic/reports/group/${groupId}/refresh`, am, { language: 'uz' });
  check('the group analysis is made, with the homework flags counted by code', groupReport.status === 200 && groupReport.body.report.text.includes('Loop'), groupReport.body);
  check('a lesson without homework is flagged by the code', groupReport.body.report.text.includes('- Uy vazifasiz dars: ZZ Older lesson'), groupReport.body.report.text);

  console.log('\nMessages');
  const noDraftYet = await call('POST', '/api/academic/draft', am, { type: 'student', targetId: studentB.id, language: 'en' });
  check('a draft needs an analysis first -> 409', noDraftYet.status === 409 && noDraftYet.body.code === 'NO_REPORT', noDraftYet.body);
  const draft = await call('POST', '/api/academic/draft', am, { type: 'student', targetId: student.id, language: 'ru' });
  check('the AI writes a draft', draft.status === 200 && draft.body.draft.includes('ZZ Test student_a'), draft.body);
  check('writing a draft sends nothing', !(await call('GET', '/api/notifications', student)).body.notifications.some((n) => n.type === 'academic.message'));
  check('the student cannot send a message -> 403', (await call('POST', '/api/academic/send', student, { type: 'student', targetId: student.id, text: 'x' })).status === 403);
  check('an empty message -> 400', (await call('POST', '/api/academic/send', am, { type: 'student', targetId: student.id, text: '  ' })).status === 400);

  await supabase.from('telegram_links').delete().eq('user_id', student.id);
  await supabase.from('telegram_links').insert({ user_id: student.id, chat_id: CHAT + 1, language: 'ru' });
  sent.length = 0;
  const text = 'ZZ Please repeat loops, here are 3 exercises.';
  const sentOk = await call('POST', '/api/academic/send', am, { type: 'student', targetId: student.id, text });
  check('the manager sends the (edited) text', sentOk.status === 200 && sentOk.body.sent === 1 && sentOk.body.telegram === 1, sentOk.body);
  const studentBell = (await call('GET', '/api/notifications', student)).body.notifications.find((n) => n.type === 'academic.message');
  check('the student gets it in the cabinet', studentBell?.data.text === text, studentBell);
  check('and in Telegram', sent.some((m) => m.chatId === CHAT + 1 && m.text === text), sent);
  check('another student does not get it', !(await call('GET', '/api/notifications', studentB)).body.notifications.some((n) => n.type === 'academic.message'));
  check('the teacher does not get it', !(await call('GET', '/api/notifications', teacher)).body.notifications.some((n) => n.type === 'academic.message'));

  const groupDraft = await call('POST', '/api/academic/draft', am, { type: 'group', targetId: groupId, language: 'en' });
  check('a group draft is built from the group analysis', groupDraft.status === 200 && groupDraft.body.draft.includes(GROUP), groupDraft.body);
  const toGroup = await call('POST', '/api/academic/send', am, { type: 'group', targetId: groupId, text: 'ZZ Group message' });
  check('a group message goes to every student of the group', toGroup.status === 200 && toGroup.body.sent === 2, toGroup.body);
  const teacherMessage = await call('POST', '/api/academic/send', am, { type: 'teacher', targetId: teacher.id, text: 'ZZ Note for the teacher' });
  check('a teacher message goes to the teacher only', teacherMessage.status === 200 && teacherMessage.body.sent === 1);
  check('the student never sees the teacher\'s message or analysis', !JSON.stringify((await call('GET', '/api/notifications', student)).body).includes('ZZ Note for the teacher'));

  console.log('\nGroups');
  const moved = await call('POST', '/api/academic/transfer', am, { studentId: studentB.id, fromGroupId: groupId, toGroupId: groupId });
  check('moving to the same group -> 400', moved.status === 400);
  const teachersList = (await call('GET', '/api/academic/teacher-names', am)).body.teachers;
  check('the list of teachers has names and ids', teachersList.some((t) => t.id === teacherB.id && t.fullName));
  const assigned = await call('PATCH', `/api/academic/groups/${groupId}/teacher`, am, { teacherId: teacherB.id });
  check('the manager gives the group to another teacher', assigned.status === 200, assigned.body);
  check('the old teacher no longer sees the group', !(await call('GET', '/api/groups/mine', teacher)).body.groups.some((g) => g.id === groupId));
  check('a student is not a teacher -> 400', (await call('PATCH', `/api/academic/groups/${groupId}/teacher`, am, { teacherId: student.id })).status === 400);

  console.log('\nGemini switched off');
  geminiOn = false;
  const off = await call('POST', `/api/academic/reports/student/${student.id}/refresh`, am, { language: 'en' });
  check('the AI update fails politely -> 502', off.status === 502 && off.body.code === 'AI_UNAVAILABLE', off.body);
  const stillThere = await call('GET', `/api/academic/reports/student/${student.id}`, am);
  check('the saved analysis is still shown', stillThere.status === 200 && stillThere.body.report?.text.includes('Loop A'), stillThere.body);
  const offDraft = await call('POST', '/api/academic/draft', am, { type: 'student', targetId: student.id, language: 'en' });
  check('the draft fails politely -> 502', offDraft.status === 502, offDraft.body);
  for (const path of ['/api/academic/dashboard', '/api/academic/students/risk', '/api/academic/teachers', '/api/lessons', '/api/schedule', '/api/ratings']) {
    check(`without the AI: GET ${path} -> 200`, (await call('GET', path, am)).status === 200);
  }
  check('without the AI the message can still be sent by hand', (await call('POST', '/api/academic/send', am, { type: 'student', targetId: student.id, text: 'ZZ By hand' })).status === 200);
  geminiOn = true;
};

const cleanup = async (users, groupId) => {
  const ids = users.map((u) => u.id);
  await supabase.from('sessions').delete().in('user_id', ids);
  await supabase.from('telegram_links').delete().in('user_id', ids);
  await supabase.from('ai_reports').delete().in('target_id', [...ids, ...(groupId ? [groupId] : [])]);
  await supabase.from('groups').delete().eq('name', GROUP); // lessons, ratings, marks and homework go with it
  await supabase.from('notifications').delete().in('user_id', ids);
  await supabase.from('users').update({ status: 'blocked', payment_status: 'active' }).in('id', ids);
};

(async () => {
  const server = startServer();
  const ctx = {};
  let users = [];

  try {
    const { error: missing } = await supabase.from('lessons').select('id').limit(1);
    if (missing) throw new Error('Run 013_academic_manager.sql in Supabase first.');

    const raw = {
      admin: await ensureUser('admin', 'Admin'),
      am: await ensureUser('academic', 'AcademicManager'),
      teacher: await ensureUser('teacher', 'Teacher'),
      teacherB: await ensureUser('teacher_b', 'Teacher'),
      student: await ensureUser('student_a', 'Student'),
      studentB: await ensureUser('student_b', 'Student'),
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
    if (users.length) await cleanup(users, ctx.groupId);
    finish(server);
  }
})();
