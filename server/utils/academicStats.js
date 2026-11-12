const supabase = require('../config/supabase');
const { tashkentNow, toMinutes } = require('./schedule');
const { addDays, weekdayOf } = require('./attendance');
const { loadSlots } = require('./lessonDay');

// All the numbers of the academic manager. Plain code and database queries: no AI here.
// The AI only receives these numbers and explains them (see services/academicAi.js).

const RISK_DAYS = 14;        // the window for absences
const RISK_ABSENCES = 3;     // this many absences in the window = at risk
const FALL_POINTS = 10;      // marks lower than before by this many percent = "falling"

const percentOf = (g) => (g.score / g.max_score) * 100;
const average = (numbers) => (numbers.length ? Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length) : null);

// Lessons that should have been held by now but have no lesson record (no topic written).
// Returns [{ groupId, groupName, teacherId, date, startTime }], newest first.
const missingLessons = async (days, filter) => {
  const now = tashkentNow();
  const from = addDays(now.date, -days);
  const slots = await loadSlots(filter);
  const { data: held, error } = await supabase.from('lessons').select('group_id, date').gte('date', from);
  if (error) throw error;
  const heldKeys = new Set(held.map((l) => `${l.group_id}:${l.date}`));

  const missing = [];
  for (let date = from; date <= now.date; date = addDays(date, 1)) {
    for (const slot of slots.filter((s) => s.weekday === weekdayOf(date) && date >= s.groupCreated)) {
      const over = date < now.date || now.minutes >= toMinutes(slot.endTime);
      if (over && !heldKeys.has(`${slot.groupId}:${date}`)) {
        missing.push({ groupId: slot.groupId, groupName: slot.groupName, teacherId: slot.teacherId, teacherName: slot.teacherName, date, startTime: slot.startTime });
      }
    }
  }
  return missing.sort((a, b) => (a.date < b.date ? 1 : -1));
};

// Lessons of the last two weeks where some students have no tick or cross yet.
const unmarkedCount = async () => {
  const now = tashkentNow();
  const from = addDays(now.date, -RISK_DAYS);
  const slots = await loadSlots();
  const [{ data: members }, { data: marks }] = await Promise.all([
    supabase.from('group_students').select('group_id, joined_at, student:users!group_students_student_id_fkey(status)'),
    supabase.from('attendance').select('group_id, student_id, lesson_date').gte('lesson_date', from),
  ]);

  let count = 0;
  for (let date = from; date <= now.date; date = addDays(date, 1)) {
    for (const slot of slots.filter((s) => s.weekday === weekdayOf(date))) {
      if (!(date < now.date || now.minutes >= toMinutes(slot.startTime))) continue;
      const expected = (members ?? []).filter((m) => m.group_id === slot.groupId && m.joined_at.slice(0, 10) <= date && m.student?.status !== 'frozen').length;
      const marked = (marks ?? []).filter((r) => r.group_id === slot.groupId && r.lesson_date === date).length;
      if (expected > marked) count += 1;
    }
  }
  return count;
};

// The numbers on the dashboard.
const dashboard = async () => {
  const now = tashkentNow();
  const slots = (await loadSlots()).filter((s) => s.weekday === now.weekday);
  const missing = await missingLessons(RISK_DAYS);
  const { count: ungraded } = await supabase
    .from('homework_submissions').select('id', { count: 'exact', head: true }).is('score', null);

  return {
    lessonsToday: slots.length,
    lessonsWithoutTopic: missing.length,
    unmarkedAttendance: await unmarkedCount(),
    ungradedHomework: ungraded ?? 0,
    missing: missing.slice(0, 10),
  };
};

// Students at risk: 3+ absences in two weeks, or marks falling.
const riskStudents = async () => {
  const today = tashkentNow().date;
  const windowStart = addDays(today, -RISK_DAYS);
  const gradesStart = addDays(today, -RISK_DAYS * 3);

  const [{ data: members, error }, { data: absences }, { data: grades }] = await Promise.all([
    supabase
      .from('group_students')
      .select('group_id, student:users!group_students_student_id_fkey(id, full_name, status), group:groups!group_students_group_id_fkey(name, status)'),
    supabase.from('attendance').select('student_id').eq('status', 'absent').gte('lesson_date', windowStart),
    supabase.from('grades').select('student_id, score, max_score, created_at').gte('created_at', `${gradesStart}T00:00:00Z`),
  ]);
  if (error) throw error;

  const risks = [];
  for (const m of members.filter((row) => row.group?.status === 'active' && row.student?.status === 'active')) {
    const id = m.student.id;
    const missed = (absences ?? []).filter((a) => a.student_id === id).length;
    const marks = (grades ?? []).filter((g) => g.student_id === id);
    const recent = average(marks.filter((g) => g.created_at.slice(0, 10) >= windowStart).map(percentOf));
    const before = average(marks.filter((g) => g.created_at.slice(0, 10) < windowStart).map(percentOf));

    const reasons = [];
    if (missed >= RISK_ABSENCES) reasons.push('absences');
    if (recent !== null && before !== null && recent <= before - FALL_POINTS) reasons.push('falling');
    if (reasons.length) {
      risks.push({ studentId: id, fullName: m.student.full_name, groupId: m.group_id, groupName: m.group.name, absences: missed, recentAverage: recent, previousAverage: before, reasons });
    }
  }
  return risks.sort((a, b) => b.reasons.length - a.reasons.length || b.absences - a.absences);
};

// One student's numbers for the AI and for the page: no names, only ids and figures.
const studentFacts = async (studentId) => {
  const today = tashkentNow().date;
  const since = addDays(today, -30);
  const [{ data: marks }, { data: grades }, { data: memberships }] = await Promise.all([
    supabase.from('attendance').select('status, lesson_date').eq('student_id', studentId).gte('lesson_date', since),
    supabase.from('grades').select('title, kind, score, max_score, created_at').eq('student_id', studentId).order('created_at', { ascending: false }).limit(15),
    supabase.from('group_students').select('group_id').eq('student_id', studentId),
  ]);
  const groupIds = (memberships ?? []).map((m) => m.group_id);
  const { data: lessons } = groupIds.length
    ? await supabase.from('lessons').select('date, topic').in('group_id', groupIds).order('date', { ascending: false }).limit(8)
    : { data: [] };

  return {
    absences30: (marks ?? []).filter((r) => r.status === 'absent').length,
    present30: (marks ?? []).filter((r) => r.status === 'present').length,
    grades: (grades ?? []).map((g) => ({ title: g.title, kind: g.kind, percent: Math.round(percentOf(g)) })),
    recentTopics: (lessons ?? []).map((l) => l.topic),
  };
};

// Numbers of every teacher: average lesson rating, share of checked homework, lessons without a topic,
// and the anonymous comments. Comments carry no student id.
const teacherStats = async () => {
  const [{ data: teachers, error }, { data: ratings }, { data: homework }, missing] = await Promise.all([
    supabase.from('users').select('id, full_name').eq('role', 'Teacher').eq('status', 'active'),
    supabase.from('lesson_ratings').select('score, comment, created_at, lesson:lessons!inner(teacher_id, date, topic)').order('created_at', { ascending: false }).limit(1000),
    supabase.from('homework').select('teacher_id, submissions:homework_submissions(score)').eq('status', 'active'),
    missingLessons(30),
  ]);
  if (error) throw error;

  return teachers.map((t) => {
    const own = (ratings ?? []).filter((r) => r.lesson.teacher_id === t.id);
    const submissions = (homework ?? []).filter((h) => h.teacher_id === t.id).flatMap((h) => h.submissions);
    const checked = submissions.filter((s) => s.score !== null).length;
    const scores = own.map((r) => r.score);
    return {
      teacherId: t.id,
      fullName: t.full_name,
      ratingCount: own.length,
      averageRating: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
      checkedHomeworkPercent: submissions.length ? Math.round((checked / submissions.length) * 100) : null,
      lessonsWithoutTopic: missing.filter((m) => m.teacherId === t.id).length,
      reviews: own.filter((r) => r.comment).slice(0, 20).map((r) => ({ date: r.lesson.date, topic: r.lesson.topic, score: r.score, comment: r.comment })),
    };
  });
};

// One group's numbers for the AI.
const groupFacts = async (groupId) => {
  const since = addDays(tashkentNow().date, -30);
  const [{ data: marks }, { data: grades }, { data: lessons }, { data: homework }] = await Promise.all([
    supabase.from('attendance').select('status').eq('group_id', groupId).gte('lesson_date', since),
    supabase.from('grades').select('score, max_score').eq('group_id', groupId).gte('created_at', `${since}T00:00:00Z`),
    supabase.from('lessons').select('id, date, topic').eq('group_id', groupId).order('date', { ascending: false }).limit(10),
    supabase.from('homework').select('title, lesson_id, created_at').eq('group_id', groupId).order('created_at', { ascending: false }).limit(10),
  ]);
  const present = (marks ?? []).filter((r) => r.status === 'present').length;
  return {
    attendancePercent: (marks ?? []).length ? Math.round((present / marks.length) * 100) : null,
    averageGradePercent: average((grades ?? []).map(percentOf)),
    lessons: lessons ?? [],
    homework: homework ?? [],
  };
};

module.exports = { missingLessons, dashboard, riskStudents, studentFacts, teacherStats, groupFacts };
