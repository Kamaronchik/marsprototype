// Checks the numbers behind the home screens: the next launch, ranks and XP, and the student overview.
// Run:  npm run test-home
const {
  supabase, check, markFailed, ensureUser, openSession, startServer, call, finish,
} = require('./testKit');
const { nextLaunch } = require('../utils/schedule');
const { rankFor, xpOf } = require('../utils/ranks');

const GROUP = 'ZZ Home Group';
const MONDAY = 1;

const group = (id, weekdays, start) => ({ id, name: `G${id}`, room: 'A1', weekdays, start_time: `${start}:00` });
const at = (weekday, hours, minutes = 0) => ({ weekday, minutes: hours * 60 + minutes, date: '2026-11-09' });

const testNextLaunch = () => {
  console.log('\nThe next launch (lesson)');
  const crews = [group(1, [1, 3], '11:40')];

  const early = nextLaunch(crews, at(MONDAY, 10));
  check('Monday 10:00 -> today at 11:40, in 100 minutes', early.startTime === '11:40' && early.dayOffset === 0 && early.minutesUntil === 100 && !early.live, early);
  check('the lesson ends 90 minutes after it starts', early.endTime === '13:10');

  const running = nextLaunch(crews, at(MONDAY, 11, 50));
  check('Monday 11:50 -> the lesson is live now', running.live === true && running.minutesUntil === 0, running);

  const after = nextLaunch(crews, at(MONDAY, 13, 10));
  check('Monday 13:10 (just over) -> Wednesday 11:40', after.dayOffset === 2 && after.minutesUntil === 2 * 1440 + 700 - 790, after);

  const friday = nextLaunch(crews, at(5, 9));
  check('Friday -> next Monday, wrapping the week', friday.dayOffset === 3 && friday.minutesUntil === 3 * 1440 + 700 - 540, friday);

  const two = nextLaunch([group(1, [1], '17:00'), group(2, [1], '11:40')], at(MONDAY, 10));
  check('with two crews the earlier one comes first', two.groupId === 2, two);
  check('no crews -> no launch', nextLaunch([], at(MONDAY, 10)) === null);
  check('a crew with no days -> no launch', nextLaunch([group(1, [], '11:40')], at(MONDAY, 10)) === null);
  check('a lesson only on this weekday next week is found', nextLaunch([group(1, [1], '09:00')], at(MONDAY, 12)).dayOffset === 7);
};

const testRanks = () => {
  console.log('\nRanks and XP');
  check('XP: 10 per lesson and 25 per battle won', xpOf({ lessonsAttended: 4, battlesWon: 2 }) === 90);
  check('0 XP is a Cadet with 100 to go', rankFor(0).key === 'cadet' && rankFor(0).nextKey === 'pilot' && rankFor(0).xpForNext === 100);
  check('99 XP is still a Cadet', rankFor(99).key === 'cadet' && rankFor(99).xpIntoRank === 99);
  check('100 XP makes a Pilot', rankFor(100).key === 'pilot' && rankFor(100).xpIntoRank === 0 && rankFor(100).xpForNext === 200);
  check('300 XP makes a Navigator', rankFor(300).key === 'navigator');
  check('700 XP makes a Commander, the top rank', rankFor(700).key === 'commander' && rankFor(700).nextKey === null && rankFor(700).xpForNext === null);
  check('more XP stays Commander', rankFor(5000).key === 'commander');
};

const testOverview = async ({ admin, teacher, studentA, studentB }) => {
  console.log('\nThe student overview');
  check('no session -> 401', (await call('GET', '/api/home/student')).status === 401);
  check('a teacher has no student home -> 403', (await call('GET', '/api/home/student', teacher)).status === 403);

  const empty = (await call('GET', '/api/home/student', studentB)).body;
  check('a new student: no launch, no crews, no log', empty.nextLaunch === null && empty.crews.length === 0 && empty.log.length === 0, empty);
  check('a new student is a Cadet with a null readiness percent', empty.rank.key === 'cadet' && empty.readiness.percent === null, empty);

  const { data: created } = await supabase.from('groups').insert({
    name: GROUP, teacher_id: teacher.id, room: 'C3', weekdays: [1, 2, 3, 4, 5, 6, 7], start_time: '19:40',
  }).select().single();
  await supabase.from('group_students').insert({ group_id: created.id, student_id: studentA.id });
  await supabase.from('attendance').insert([
    { group_id: created.id, student_id: studentA.id, lesson_date: '2026-11-06', status: 'present', marked_by: teacher.id },
    { group_id: created.id, student_id: studentA.id, lesson_date: '2026-11-07', status: 'present', marked_by: teacher.id },
    { group_id: created.id, student_id: studentA.id, lesson_date: '2026-11-08', status: 'absent', marked_by: teacher.id },
  ]);

  const home = (await call('GET', '/api/home/student', studentA)).body;
  check('readiness is the attendance percentage', home.readiness.present === 2 && home.readiness.absent === 1 && home.readiness.percent === 67, home.readiness);
  check('the crew is listed with room and time', home.crews.length === 1 && home.crews[0].name === GROUP && home.crews[0].room === 'C3' && home.crews[0].startTime === '19:40' && home.crews[0].teacherName === teacher.full_name, home.crews);
  check('a next launch exists (the crew meets every day)', home.nextLaunch?.groupName === GROUP && home.nextLaunch.startTime === '19:40', home.nextLaunch);
  check('the log shows the newest entry first', home.log[0].date === '2026-11-08' && home.log[0].status === 'absent' && home.log.length === 3, home.log);
  check('XP counts the lessons attended (2 x 10) plus the wins', home.rank.xp === 20 + home.battles.wins * 25, home.rank);
  check('coins match the wallet', home.coins === (await call('GET', '/api/wallet', studentA)).body.balance, home.coins);
  check('another student sees nothing of this crew', (await call('GET', '/api/home/student', studentB)).body.crews.length === 0);
  check('admin has no student home -> 403', (await call('GET', '/api/home/student', admin)).status === 403);
};

// --- run -------------------------------------------------------------------

const cleanup = async (users) => {
  const ids = users.map((u) => u.id);
  await supabase.from('groups').delete().eq('name', GROUP); // members and marks go with it
  await supabase.from('sessions').delete().in('user_id', ids);
  await supabase.from('users').update({ status: 'blocked', payment_status: 'active' }).in('id', ids);
};

(async () => {
  const server = startServer();
  let users = [];

  try {
    const raw = {
      admin: await ensureUser('admin', 'Admin'),
      teacher: await ensureUser('teacher', 'Teacher'),
      studentA: await ensureUser('student_a', 'Student'),
      studentB: await ensureUser('student_b', 'Student'),
    };
    users = Object.values(raw);
    await supabase.from('groups').delete().eq('name', GROUP);
    await supabase.from('group_students').delete().in('student_id', [raw.studentA.id, raw.studentB.id]);
    await supabase.from('attendance').delete().in('student_id', [raw.studentA.id, raw.studentB.id]);

    const people = {};
    for (const [key, user] of Object.entries(raw)) people[key] = await openSession(user);

    testNextLaunch();
    testRanks();
    await testOverview(people);
  } catch (error) {
    markFailed();
    console.error('\nTest run stopped:', error.message);
  } finally {
    if (users.length) await cleanup(users);
    finish(server);
  }
})();
