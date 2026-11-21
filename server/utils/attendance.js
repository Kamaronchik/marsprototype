const supabase = require('../config/supabase');
const { notify } = require('./notify');
const { LESSON_MINUTES, DAY_OPEN, DAY_CLOSE, toMinutes, toTime, tashkentNow } = require('./schedule');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isDate = (value) => DATE_PATTERN.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

// 'YYYY-MM-DD' shifted by a number of days (negative = into the past).
const addDays = (date, days) => {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
};

// ISO weekday (1 = Monday .. 7 = Sunday) of a 'YYYY-MM-DD' date.
const weekdayOf = (date) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

// Teachers mark attendance only while the school is open: 09:00 - 22:00 Tashkent time.
const isMarkingOpen = (now = tashkentNow()) => now.minutes >= DAY_OPEN && now.minutes < DAY_CLOSE;

const lessonEnd = (group) => toTime(toMinutes(group.start_time) + LESSON_MINUTES);

// Percent of lessons attended, rounded. A student who came late was at the lesson, so 'late' counts as attended.
// null when there is nothing to count. "present" is the number of lessons attended on time.
const buildStats = (records) => {
  const present = records.filter((r) => r.status === 'present').length;
  const late = records.filter((r) => r.status === 'late').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const total = present + late + absent;
  return { present, late, absent, total, percent: total ? Math.round(((present + late) / total) * 100) : null };
};

// The groups of a teacher with their students, as needed for one lesson day.
const loadTeacherGroups = async (teacherId) => {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, room, weekdays, start_time, members:group_students(joined_at, student:users!group_students_student_id_fkey(id, full_name, status))')
    .eq('teacher_id', teacherId)
    .eq('status', 'active')
    .order('start_time');
  if (error) throw error;
  // Frozen students are on pause: they are not shown and not marked.
  return data.map((g) => ({ ...g, members: g.members.filter((m) => m.student.status !== 'frozen') }));
};

// Reminder for the teacher: a lesson is over, but some students have no tick or cross.
// Safe to call often: dedupe_key keeps one reminder per group and day.
const remindUnmarked = async (teacherId, now = tashkentNow()) => {
  if (now.minutes >= DAY_CLOSE) return;

  const groups = (await loadTeacherGroups(teacherId)).filter((g) => g.weekdays.includes(now.weekday));
  const ended = groups.filter((g) => now.minutes >= toMinutes(g.start_time) + LESSON_MINUTES);
  if (!ended.length) return;

  const { data: records, error } = await supabase
    .from('attendance')
    .select('group_id, student_id')
    .eq('lesson_date', now.date)
    .in('group_id', ended.map((g) => g.id));
  if (error) throw error;

  for (const group of ended) {
    const marked = new Set(records.filter((r) => r.group_id === group.id).map((r) => r.student_id));
    const unmarked = group.members.filter((m) => !marked.has(m.student.id)).length;
    if (unmarked > 0) {
      await notify(
        teacherId,
        'attendance.unmarked',
        { groupName: group.name, date: now.date, count: unmarked },
        { link: '/teacher/attendance', dedupeKey: `attendance.unmarked:${group.id}:${now.date}` },
      );
    }
  }
};

module.exports = {
  isDate, addDays, weekdayOf, isMarkingOpen, lessonEnd, buildStats, loadTeacherGroups, remindUnmarked,
};
