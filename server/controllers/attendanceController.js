const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { saveMark } = require('../utils/saveMark');
const { DAY_OPEN, DAY_CLOSE, toMinutes, toTime, tashkentNow } = require('../utils/schedule');
const {
  isDate, addDays, weekdayOf, isMarkingOpen, lessonEnd, buildStats, loadTeacherGroups, remindUnmarked,
} = require('../utils/attendance');

const STATUSES = ['present', 'late', 'absent'];

const byName = (a, b) => a.fullName.localeCompare(b.fullName);

const COLUMNS = `id, group_id, student_id, lesson_date, status, absence_reason, marked_by, updated_at,
  student:users!attendance_student_id_fkey(full_name),
  group:groups!attendance_group_id_fkey(name, teacher_id)`;

const toRecord = (r) => ({
  id: r.id,
  groupId: r.group_id,
  groupName: r.group?.name ?? null,
  studentId: r.student_id,
  studentName: r.student?.full_name ?? null,
  date: r.lesson_date,
  status: r.status,
  absenceReason: r.absence_reason,
  updatedAt: r.updated_at,
});

// Date range from the query string. Default: the last 30 days up to today.
const readRange = (query, days = 30) => {
  const today = tashkentNow().date;
  const from = query.from ?? addDays(today, -days);
  const to = query.to ?? today;
  if (!isDate(from) || !isDate(to) || from > to) return null;
  return { from, to };
};

// Teacher: today's lessons with every student's tick, cross or empty mark.
const getToday = async (req, res) => {
  const now = tashkentNow();
  await remindUnmarked(req.user.id, now);

  const lessons = (await loadTeacherGroups(req.user.id)).filter((g) => g.weekdays.includes(now.weekday));

  const { data: records, error } = await supabase
    .from('attendance')
    .select('group_id, student_id, status, absence_reason')
    .eq('lesson_date', now.date)
    .in('group_id', lessons.map((g) => g.id));
  if (error) return handleDbError(error, res);

  res.json({
    date: now.date,
    markingOpen: isMarkingOpen(now),
    open: toTime(DAY_OPEN),
    close: toTime(DAY_CLOSE),
    lessons: lessons.map((g) => ({
      groupId: g.id,
      groupName: g.name,
      room: g.room,
      startTime: g.start_time.slice(0, 5),
      endTime: lessonEnd(g),
      students: g.members
        .map((m) => {
          const record = records.find((r) => r.group_id === g.id && r.student_id === m.student.id);
          return {
            id: m.student.id,
            fullName: m.student.full_name,
            status: record?.status ?? null,
            absenceReason: record?.absence_reason ?? null,
          };
        })
        .sort(byName),
    })),
  });
};

// Tick (present), clock (late) or cross (absent) for one student.
// Teacher: own group, today only, while the school is open.
// Admin: any group, any past or current date (a correction).
const markAttendance = async (req, res) => {
  const { groupId, studentId, status } = req.body;
  if (!isUuid(groupId) || !isUuid(studentId)) return res.status(400).json({ message: 'Invalid group or student' });
  if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Status must be present, late or absent' });

  const now = tashkentNow();
  const isAdmin = req.user.role === 'Admin';
  let date = now.date;

  if (isAdmin) {
    if (req.body.date !== undefined) date = req.body.date;
    if (!isDate(date) || date > now.date) return res.status(400).json({ message: 'Invalid date' });
  } else if (!isMarkingOpen(now)) {
    return res.status(403).json({ message: 'Attendance can be marked from 09:00 to 22:00', code: 'MARKING_CLOSED' });
  }

  const { data: group, error: groupError } = await supabase
    .from('groups').select('id, name, teacher_id, weekdays, status').eq('id', groupId).maybeSingle();
  if (groupError) return handleDbError(groupError, res);
  // A teacher must not learn that someone else's group exists.
  if (!group || (!isAdmin && group.teacher_id !== req.user.id)) {
    return res.status(404).json({ message: 'Group not found' });
  }
  if (!group.weekdays.includes(weekdayOf(date))) {
    return res.status(400).json({ message: 'This group has no lesson on that day', code: 'NO_LESSON' });
  }

  const { data: member } = await supabase
    .from('group_students').select('student_id, student:users!group_students_student_id_fkey(status)').eq('group_id', groupId).eq('student_id', studentId).maybeSingle();
  if (!member) return res.status(404).json({ message: 'Student is not in this group' });
  if (member.student?.status === 'frozen') {
    return res.status(400).json({ message: 'This student is frozen and cannot be marked', code: 'STUDENT_FROZEN' });
  }

  const result = await saveMark({ group, studentId, status, date, actorId: req.user.id });
  if (result.error) return handleDbError(result.error, res);

  res.json({ id: result.id, status });
};

// Admin and academic manager: every mark. Teacher: only marks of own groups.
// Filters: ?from ?to ?groupId ?studentId ?teacherId ?status
const listAttendance = async (req, res) => {
  const range = readRange(req.query);
  if (!range) return res.status(400).json({ message: 'Invalid date range' });

  const { groupId, studentId, teacherId, status } = req.query;
  if ((groupId && !isUuid(groupId)) || (studentId && !isUuid(studentId)) || (teacherId && !isUuid(teacherId))) {
    return res.status(400).json({ message: 'Invalid filter' });
  }
  if (status && !STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  let query = supabase
    .from('attendance')
    .select(COLUMNS)
    .gte('lesson_date', range.from)
    .lte('lesson_date', range.to)
    .order('lesson_date', { ascending: false })
    .limit(2000);
  if (groupId) query = query.eq('group_id', groupId);
  if (studentId) query = query.eq('student_id', studentId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return handleDbError(error, res);

  const ownerId = req.user.role === 'Teacher' ? req.user.id : teacherId;
  const records = ownerId ? data.filter((r) => r.group?.teacher_id === ownerId) : data;

  res.json({ ...range, records: records.map(toRecord), stats: buildStats(records) });
};

// Admin: lessons that already happened but where some students have no tick or cross.
const listUnmarked = async (req, res) => {
  const range = readRange(req.query, 14);
  if (!range) return res.status(400).json({ message: 'Invalid date range' });
  const now = tashkentNow();

  const { data: groups, error } = await supabase
    .from('groups')
    .select('id, name, room, weekdays, start_time, teacher:users!groups_teacher_id_fkey(full_name), members:group_students(joined_at, student_id, student:users!group_students_student_id_fkey(status))')
    .eq('status', 'active');
  if (error) return handleDbError(error, res);

  const { data: records, error: recordsError } = await supabase
    .from('attendance')
    .select('group_id, student_id, lesson_date')
    .gte('lesson_date', range.from)
    .lte('lesson_date', range.to);
  if (recordsError) return handleDbError(recordsError, res);

  const unmarked = [];
  for (let date = range.from; date <= range.to && date <= now.date; date = addDays(date, 1)) {
    for (const group of groups.filter((g) => g.weekdays.includes(weekdayOf(date)))) {
      const lessonOver = date < now.date || now.minutes >= toMinutes(group.start_time);
      if (!lessonOver) continue;

      const marked = new Set(records.filter((r) => r.group_id === group.id && r.lesson_date === date).map((r) => r.student_id));
      // Only students who were already in the group on that day.
      const expected = group.members.filter((m) => m.joined_at.slice(0, 10) <= date && m.student?.status !== 'frozen');
      const missing = expected.filter((m) => !marked.has(m.student_id)).length;
      if (missing > 0) {
        unmarked.push({
          groupId: group.id,
          groupName: group.name,
          teacherName: group.teacher?.full_name ?? null,
          room: group.room,
          date,
          startTime: group.start_time.slice(0, 5),
          unmarkedCount: missing,
          studentCount: expected.length,
        });
      }
    }
  }

  res.json({ ...range, lessons: unmarked.sort((a, b) => (a.date < b.date ? 1 : -1)) });
};

// Student: own attendance and percentage.
const listMine = async (req, res) => {
  const range = readRange(req.query, 90);
  if (!range) return res.status(400).json({ message: 'Invalid date range' });

  const { data, error } = await supabase
    .from('attendance')
    .select(COLUMNS)
    .eq('student_id', req.user.id)
    .gte('lesson_date', range.from)
    .lte('lesson_date', range.to)
    .order('lesson_date', { ascending: false });
  if (error) return handleDbError(error, res);

  res.json({ ...range, records: data.map(toRecord), stats: buildStats(data) });
};

module.exports = { getToday, markAttendance, listAttendance, listUnmarked, listMine };
