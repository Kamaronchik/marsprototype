// End-to-end check of groups, rooms, students, notifications and attendance against the real database.
// Run AFTER schema_platform.sql:  npm run test-platform
// Test accounts are the fixed "zz_test_*" ones (blocked again at the end); test groups are deleted.
const crypto = require('crypto');
const {
  supabase, check, markFailed, ensureUser, openSession, startServer, call, finish,
} = require('./testKit');
const { SLOTS, ROOMS, LESSON_MINUTES, toMinutes, tashkentNow } = require('../utils/schedule');
const { isMarkingOpen, weekdayOf, addDays } = require('../utils/attendance');

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const GROUP_NAMES = ['ZZ Plat A', 'ZZ Plat B', 'ZZ Plat C'];

const notificationsOf = async (who) => (await call('GET', '/api/notifications', who)).body;
const hasNotification = async (who, type) => (await notificationsOf(who)).notifications.some((n) => n.type === type);

// A lesson time with at least two free rooms, so the test cannot clash with real groups. otherRoom is
// a second room free at the same time: picking "any room but the first" would risk a real group's room.
const findFreeSlot = async (admin) => {
  const { groups } = (await call('GET', '/api/groups', admin)).body;
  const busy = (room, start) => groups.some((g) => g.status === 'active' && g.room === room && g.startTime === start);
  for (const start of SLOTS) {
    const free = ROOMS.filter((room) => !busy(room, start));
    if (free.length >= 2) return { room: free[0], otherRoom: free[1], start };
  }
  throw new Error('No free room and time left for the test');
};

// --- test groups -----------------------------------------------------------

const testClock = () => {
  console.log('\nSchool day and clock');
  check('lesson times are 09:00, 11:40, 14:20, 17:00, 19:40', SLOTS.join(' ') === '09:00 11:40 14:20 17:00 19:40', SLOTS);
  check('12 rooms from A1 to C4', ROOMS.length === 12 && ROOMS[0] === 'A1' && ROOMS[11] === 'C4');
  check('last lesson ends before 22:00', toMinutes(SLOTS[SLOTS.length - 1]) + LESSON_MINUTES <= 22 * 60);
  check('marking is closed at 08:59 and open at 09:00', !isMarkingOpen({ minutes: 539 }) && isMarkingOpen({ minutes: 540 }));
  check('marking is open at 21:59 and closed at 22:00', isMarkingOpen({ minutes: 1319 }) && !isMarkingOpen({ minutes: 1320 }));
  const noon = tashkentNow(new Date('2026-11-09T05:00:00Z')); // 10:00 in Tashkent (UTC+5), a Monday
  check('Tashkent time is read correctly', noon.date === '2026-11-09' && noon.minutes === 600 && noon.weekday === 1, noon);
  check('weekday and date helpers', weekdayOf('2026-11-08') === 7 && addDays('2026-11-01', -1) === '2026-10-31');
};

const testGroups = async ({ admin, teacher, teacherB, studentA }, ctx) => {
  console.log('\nGroups: rooms, times, names');
  const options = await call('GET', '/api/groups/options', admin);
  check('form options: rooms and lesson times', options.body.rooms?.length === 12 && options.body.slots?.[0].start === '09:00' && options.body.slots?.[0].end === '10:30', options.body);
  check('break between lessons is 1 hour 10 minutes', options.body.breakMinutes === 70);
  check('teacher cannot open group admin -> 403', (await call('GET', '/api/groups', teacher)).status === 403);

  const free = await findFreeSlot(admin);
  const base = { name: GROUP_NAMES[0], teacherId: teacher.id, room: free.room, weekdays: ALL_DAYS, startTime: free.start };

  check('room D1 does not exist -> 400', (await call('POST', '/api/groups', admin, { ...base, room: 'D1' })).status === 400);
  check('10:00 is not a lesson time -> 400', (await call('POST', '/api/groups', admin, { ...base, startTime: '10:00' })).status === 400);
  check('no weekdays -> 400', (await call('POST', '/api/groups', admin, { ...base, weekdays: [] })).status === 400);
  check('a student cannot be the head teacher -> 400', (await call('POST', '/api/groups', admin, { ...base, teacherId: studentA.id })).status === 400);
  check('head teacher is required -> 400', (await call('POST', '/api/groups', admin, { ...base, teacherId: undefined })).status === 400);
  check('teacher cannot create a group -> 403', (await call('POST', '/api/groups', teacher, base)).status === 403);

  const created = await call('POST', '/api/groups', admin, base);
  check('admin creates a group with teacher, room and time', created.status === 201 && created.body.group.room === free.room && created.body.group.teacherName === 'ZZ Test teacher', created.body);
  ctx.group = created.body.group;

  const sameRoom = await call('POST', '/api/groups', admin, { ...base, name: GROUP_NAMES[1], teacherId: teacherB.id });
  check('same room at the same time -> ROOM_BUSY', sameRoom.status === 409 && sameRoom.body.code === 'ROOM_BUSY', sameRoom.body);

  const { otherRoom } = free;
  const sameTeacher = await call('POST', '/api/groups', admin, { ...base, name: GROUP_NAMES[1], room: otherRoom });
  check('same teacher at the same time -> TEACHER_BUSY', sameTeacher.status === 409 && sameTeacher.body.code === 'TEACHER_BUSY', sameTeacher.body);

  const sameName = await call('POST', '/api/groups', admin, { ...base, name: GROUP_NAMES[0].toLowerCase(), teacherId: teacherB.id, room: otherRoom });
  check('same name (any letter case) -> NAME_TAKEN', sameName.status === 409 && sameName.body.code === 'NAME_TAKEN', sameName.body);

  // Same room and teacher are fine at another time or on other days.
  const otherSlot = SLOTS.find((start) => start !== free.start);
  const later = await call('POST', '/api/groups', admin, { ...base, name: GROUP_NAMES[1], startTime: otherSlot });
  check('the same room and teacher at another time is allowed', later.status === 201, later.body);
  ctx.groupLater = later.body.group;

  const edited = await call('PATCH', `/api/groups/${ctx.group.id}`, admin, { monthlyPrice: 500000 });
  check('admin edits the group', edited.status === 200 && edited.body.group.monthlyPrice === 500000, edited.body);

  // An archived group frees its room and time.
  const spare = await call('POST', '/api/groups', admin, { ...base, name: GROUP_NAMES[2], teacherId: teacherB.id, room: otherRoom, startTime: free.start });
  check('another room and teacher at the same time is allowed', spare.status === 201, spare.body);
  await call('DELETE', `/api/groups/${spare.body.group.id}`, admin);
  const reused = await call('POST', '/api/groups', admin, { ...base, name: GROUP_NAMES[2], teacherId: teacherB.id, room: otherRoom, startTime: free.start });
  check('an archived group frees its name, room and time', reused.status === 201, reused.body);
  ctx.groupB = reused.body.group;
};

const testStudentsInGroups = async ({ admin, teacher, teacherB, studentA, studentB }, ctx) => {
  console.log('\nStudents in groups');
  const suffix = crypto.randomBytes(4).toString('hex');
  const newStudent = {
    username: `zz_new_${suffix}`, email: `zz_new_${suffix}@example.invalid`,
    fullName: `ZZ New Student ${suffix}`, password: crypto.randomBytes(9).toString('hex'), role: 'Student',
  };

  check('unknown group -> 400', (await call('POST', '/api/users', admin, { ...newStudent, groupId: crypto.randomUUID() })).status === 400);
  check('a teacher cannot be put in a group -> 400', (await call('POST', '/api/users', admin, { ...newStudent, role: 'Teacher', groupId: ctx.group.id })).status === 400);

  const created = await call('POST', '/api/users', admin, { ...newStudent, groupId: ctx.group.id });
  check('admin creates a student and picks the group at once', created.status === 201, created.body);
  ctx.newStudentId = created.body.user?.id;

  const members = (await call('GET', `/api/groups/${ctx.group.id}/students`, teacher)).body.students ?? [];
  check('the student is in the group', members.some((s) => s.id === ctx.newStudentId));
  check('the head teacher got a notification', (await notificationsOf(teacher)).notifications.some((n) => n.type === 'group.student_added' && n.data.groupName === ctx.group.name && n.data.studentName === newStudent.fullName));
  check('another teacher cannot see this group -> 404', (await call('GET', `/api/groups/${ctx.group.id}/students`, teacherB)).status === 404);
  check('the group list counts students', (await call('GET', '/api/groups', admin)).body.groups.find((g) => g.id === ctx.group.id)?.studentCount === 1);

  check('admin adds an existing student', (await call('POST', `/api/groups/${ctx.group.id}/students`, admin, { studentId: studentA.id })).status === 201);
  check('adding twice does not fail or double', (await call('POST', `/api/groups/${ctx.group.id}/students`, admin, { studentId: studentA.id })).status === 201
    && (await call('GET', `/api/groups/${ctx.group.id}/students`, admin)).body.students.length === 2);
  check('only a student can be added -> 404', (await call('POST', `/api/groups/${ctx.group.id}/students`, admin, { studentId: teacherB.id })).status === 404);
  check('teacher cannot add students -> 403', (await call('POST', `/api/groups/${ctx.group.id}/students`, teacher, { studentId: studentB.id })).status === 403);

  const mine = (await call('GET', '/api/groups/mine', teacher)).body.groups;
  check('teacher sees only own groups with students', mine.length === 2 && mine.every((g) => g.teacherId === teacher.id) && mine.find((g) => g.id === ctx.group.id).students.length === 2, mine);
};

const testStudentSearch = async ({ admin, teacher, financier, studentA }, ctx) => {
  console.log('\nStudent search and payment status');
  const find = async (who, query) => (await call('GET', `/api/students${query}`, who)).body.students ?? [];

  check('teacher cannot search students -> 403', (await call('GET', '/api/students', teacher)).status === 403);
  check('search by name', (await find(admin, '?q=ZZ%20New')).some((s) => s.id === ctx.newStudentId));
  check('search by group name', (await find(admin, `?q=${encodeURIComponent(ctx.group.name)}`)).some((s) => s.id === studentA.id));
  check('search by teacher name', (await find(admin, '?q=ZZ%20Test%20teacher')).some((s) => s.id === studentA.id));
  const card = (await find(admin, `?q=${studentA.username}`)).find((s) => s.id === studentA.id);
  check('a student shows group, room, time, teacher and payment status', card?.paymentStatus === 'active' && card.groups[0]?.name === ctx.group.name && card.groups[0].room === ctx.group.room && card.groups[0].teacherName === 'ZZ Test teacher', card);
  check('filter by group', (await find(financier, `?groupId=${ctx.group.id}`)).length === 2);
  check('invalid filter -> 400', (await call('GET', '/api/students?paymentStatus=rich', admin)).status === 400);

  const url = `/api/students/${studentA.id}/payment-status`;
  check('invalid status -> 400', (await call('PATCH', url, admin, { paymentStatus: 'rich' })).status === 400);
  check('teacher cannot change it -> 403', (await call('PATCH', url, teacher, { paymentStatus: 'debtor' })).status === 403);
  check('admin marks a debtor', (await call('PATCH', url, admin, { paymentStatus: 'debtor' })).status === 200);
  check('the debtor filter finds the student', (await find(admin, '?paymentStatus=debtor')).some((s) => s.id === studentA.id));
  check('the student is told about the debt', await hasNotification(ctx.people.studentA, 'payment.debtor'));
  check('financier switches back to active after payment', (await call('PATCH', url, financier, { paymentStatus: 'active' })).status === 200);
  check('the student is told the debt is cleared', await hasNotification(ctx.people.studentA, 'payment.cleared'));
  await call('PATCH', url, financier, { paymentStatus: 'active' });
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', studentA.id).eq('type', 'payment.cleared');
  check('same status again sends nothing new', count === 1, count);
};

const testNotifications = async ({ studentA, studentB }) => {
  console.log('\nNotification bell');
  const before = await notificationsOf(studentA);
  check('unread counter matches the list', before.unreadCount === before.notifications.filter((n) => !n.isRead).length && before.unreadCount > 0, before.unreadCount);

  const first = before.notifications.find((n) => !n.isRead);
  check('mark one as read', (await call('POST', `/api/notifications/${first.id}/read`, studentA)).status === 200);
  check('the counter goes down', (await notificationsOf(studentA)).unreadCount === before.unreadCount - 1);
  check('someone else\'s notification -> 404', (await call('POST', `/api/notifications/${first.id}/read`, studentB)).status === 404);
  check('read all', (await call('POST', '/api/notifications/read-all', studentA)).status === 200 && (await notificationsOf(studentA)).unreadCount === 0);
  check('no session -> 401', (await call('GET', '/api/notifications')).status === 401);
};

const testAttendance = async ({ admin, teacher, teacherB, studentA, studentB }, ctx) => {
  console.log('\nAttendance: tick or cross');
  const today = tashkentNow();
  const mark = (who, student, status, extra = {}) => call('PUT', '/api/attendance/mark', who, { groupId: ctx.group.id, studentId: student.id, status, ...extra });

  check('only present or absent exist -> 400', (await mark(admin, studentA, 'late')).status === 400);
  check('future date -> 400', (await mark(admin, studentA, 'present', { date: addDays(today.date, 1) })).status === 400);
  check('student outside the group -> 404', (await mark(admin, studentB, 'present')).status === 404);
  check('student cannot mark -> 403', (await mark(studentA, studentA, 'present')).status === 403);

  const open = isMarkingOpen(today);
  const byTeacher = await mark(teacher, studentA, 'present');
  if (open) {
    check('teacher marks a tick during opening hours', byTeacher.status === 200, byTeacher.body);
  } else {
    check('teacher cannot mark before 09:00 or after 22:00', byTeacher.status === 403 && byTeacher.body.code === 'MARKING_CLOSED', byTeacher.body);
  }
  const stranger = await mark(teacherB, studentA, 'present');
  check('another teacher cannot mark this group', open ? stranger.status === 404 : stranger.status === 403, stranger.status);

  check('admin can mark any time (tick)', (await mark(admin, studentA, 'present')).status === 200);
  check('the student is told about the tick', await hasNotification(ctx.people.studentA, 'attendance.present'));
  check('changing to a cross works', (await mark(admin, studentA, 'absent')).status === 200);
  check('the student is told about the absence', await hasNotification(ctx.people.studentA, 'attendance.absent'));
  const { data: audit } = await supabase.from('audit_log').select('id').eq('action', 'attendance.change').eq('actor_id', admin.id).limit(1);
  check('the change is written to the journal', audit.length === 1);

  const yesterday = addDays(today.date, -1);
  check('admin can mark a past day', (await mark(admin, studentA, 'present', { date: yesterday })).status === 200);

  // A group that has lessons only tomorrow has none today.
  const tomorrowOnly = (today.weekday % 7) + 1;
  await call('PATCH', `/api/groups/${ctx.groupLater.id}`, admin, { weekdays: [tomorrowOnly] });
  await call('POST', `/api/groups/${ctx.groupLater.id}/students`, admin, { studentId: studentB.id });
  const noLesson = await call('PUT', '/api/attendance/mark', admin, { groupId: ctx.groupLater.id, studentId: studentB.id, status: 'present' });
  check('a day without lessons is refused -> NO_LESSON', noLesson.status === 400 && noLesson.body.code === 'NO_LESSON', noLesson.body);

  const day = (await call('GET', '/api/attendance/today', teacher)).body;
  const lesson = day.lessons.find((l) => l.groupId === ctx.group.id);
  check('teacher sees today\'s lesson with marks', day.date === today.date && day.open === '09:00' && day.close === '22:00' && lesson?.students.find((s) => s.id === studentA.id)?.status === 'absent', lesson);
  check('a student without a mark is empty', lesson?.students.some((s) => s.id !== studentA.id && s.status === null));

  const mine = (await call('GET', '/api/attendance/mine', studentA)).body;
  check('student sees own attendance and percent', mine.stats.present === 1 && mine.stats.absent === 1 && mine.stats.percent === 50, mine.stats);
  check('student cannot open the group list -> 403', (await call('GET', '/api/attendance', studentA)).status === 403);

  const list = (await call('GET', `/api/attendance?groupId=${ctx.group.id}`, admin)).body;
  check('admin sees all marks of a group with statistics', list.records.length === 2 && list.stats.total === 2, list.stats);
  check('filter by status', (await call('GET', `/api/attendance?groupId=${ctx.group.id}&status=present`, admin)).body.records.length === 1);
  check('teacher sees marks of own group', (await call('GET', `/api/attendance?groupId=${ctx.group.id}`, teacher)).body.records.length === 2);
  check('another teacher sees nothing of it', (await call('GET', `/api/attendance?groupId=${ctx.group.id}`, teacherB)).body.records.length === 0);
  check('bad date range -> 400', (await call('GET', '/api/attendance?from=2026-12-01&to=2026-01-01', admin)).status === 400);

  // studentB is not in this group; the new student never got a mark today.
  const unmarked = (await call('GET', '/api/attendance/unmarked', admin)).body.lessons ?? [];
  const started = today.minutes >= toMinutes(ctx.group.startTime);
  const todays = unmarked.find((l) => l.groupId === ctx.group.id && l.date === today.date);
  check('admin sees the lesson with unmarked students', started ? todays?.unmarkedCount === 1 : !todays, todays);
  check('teacher cannot open the unmarked list -> 403', (await call('GET', '/api/attendance/unmarked', teacher)).status === 403);

  const ended = open && today.minutes >= toMinutes(ctx.group.startTime) + LESSON_MINUTES;
  const reminded = await hasNotification(teacher, 'attendance.unmarked');
  check('teacher is reminded after the lesson if someone is unmarked', ended ? reminded : !reminded, reminded);
};

// --- run -------------------------------------------------------------------

const cleanup = async (users, ctx) => {
  const ids = users.map((u) => u.id);
  await supabase.from('sessions').delete().in('user_id', ids);
  await supabase.from('groups').delete().in('name', GROUP_NAMES); // marks and members go with them
  await supabase.from('notifications').delete().in('user_id', ids);
  if (ctx.newStudentId) await supabase.from('users').delete().eq('id', ctx.newStudentId);
  await supabase.from('users').update({ status: 'blocked', payment_status: 'active' }).in('id', ids);
};

(async () => {
  const server = startServer();
  const ctx = {};
  let users = [];

  try {
    const { error: missing } = await supabase.from('groups').select('room').limit(1);
    if (missing) throw new Error('Run schema_platform.sql in Supabase first.');

    const raw = {
      admin: await ensureUser('admin', 'Admin'),
      teacher: await ensureUser('teacher', 'Teacher'),
      teacherB: await ensureUser('teacher_b', 'Teacher'),
      financier: await ensureUser('financier', 'Financier'),
      studentA: await ensureUser('student_a', 'Student'),
      studentB: await ensureUser('student_b', 'Student'),
    };
    users = Object.values(raw);

    await supabase.from('groups').delete().in('name', GROUP_NAMES);
    await supabase.from('notifications').delete().in('user_id', users.map((u) => u.id));

    const people = {};
    for (const [key, user] of Object.entries(raw)) people[key] = await openSession(user);
    ctx.people = people;

    testClock();
    await testGroups(people, ctx);
    await testStudentsInGroups(people, ctx);
    await testStudentSearch(people, ctx);
    await testNotifications(people);
    await testAttendance(people, ctx);
  } catch (error) {
    markFailed();
    console.error('\nTest run stopped:', error.message);
  } finally {
    if (users.length) await cleanup(users, ctx);
    finish(server);
  }
})();
