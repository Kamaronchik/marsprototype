const supabase = require('../config/supabase');
const { tashkentNow } = require('./schedule');
const { addDays } = require('./attendance');

const WEEK_DAYS = 7;

// The student rates lessons once a week, so a rating blocks the next one for 7 days.
const sinceWeekAgo = () => new Date(Date.now() - WEEK_DAYS * 24 * 60 * 60 * 1000).toISOString();

// The lesson a student can rate now: the newest lesson of the last 7 days in the student's groups that the
// student has not rated yet. null when there is none, or when the student already rated something this week.
const findPendingLesson = async (studentId) => {
  const { data: recent } = await supabase
    .from('lesson_ratings').select('id').eq('student_id', studentId).gte('created_at', sinceWeekAgo()).limit(1);
  if (recent?.length) return null;

  const { data: memberships } = await supabase.from('group_students').select('group_id').eq('student_id', studentId);
  const groupIds = (memberships ?? []).map((m) => m.group_id);
  if (!groupIds.length) return null;

  const today = tashkentNow().date;
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, date, topic, group:groups!lessons_group_id_fkey(name)')
    .in('group_id', groupIds)
    .gte('date', addDays(today, -WEEK_DAYS))
    .lte('date', today)
    .order('date', { ascending: false })
    .limit(20);
  if (!lessons?.length) return null;

  const { data: rated } = await supabase
    .from('lesson_ratings').select('lesson_id').eq('student_id', studentId).in('lesson_id', lessons.map((l) => l.id));
  const done = new Set((rated ?? []).map((r) => r.lesson_id));
  const lesson = lessons.find((l) => !done.has(l.id));
  return lesson ? { id: lesson.id, date: lesson.date, topic: lesson.topic, groupName: lesson.group?.name ?? '' } : null;
};

// Saves one rating. Returns { ok: true } or { error: 'CODE' }.
//   INVALID  - the score or the lesson id is wrong
//   NOT_FOUND - no such lesson in the student's groups
//   ALREADY  - this lesson was rated before (the answer cannot be changed)
//   TOO_SOON - the student already rated a lesson this week
const saveRating = async (studentId, lessonId, score, comment) => {
  if (!Number.isInteger(score) || score < 1 || score > 5) return { error: 'INVALID' };
  const note = typeof comment === 'string' ? comment.trim().slice(0, 500) : '';

  const { data: lesson } = await supabase.from('lessons').select('id, group_id, date').eq('id', lessonId).maybeSingle();
  if (!lesson || lesson.date > tashkentNow().date) return { error: 'NOT_FOUND' };
  const { data: member } = await supabase
    .from('group_students').select('student_id').eq('group_id', lesson.group_id).eq('student_id', studentId).maybeSingle();
  if (!member) return { error: 'NOT_FOUND' };

  const { data: before } = await supabase
    .from('lesson_ratings').select('id').eq('lesson_id', lessonId).eq('student_id', studentId).maybeSingle();
  if (before) return { error: 'ALREADY' };

  const { data: recent } = await supabase
    .from('lesson_ratings').select('id').eq('student_id', studentId).gte('created_at', sinceWeekAgo()).limit(1);
  if (recent?.length) return { error: 'TOO_SOON' };

  const { error } = await supabase
    .from('lesson_ratings').insert({ lesson_id: lessonId, student_id: studentId, score, comment: note || null });
  // The table also has UNIQUE (lesson_id, student_id): two clicks at once end here.
  if (error) return { error: error.code === '23505' ? 'ALREADY' : 'INVALID' };
  return { ok: true };
};

module.exports = { findPendingLesson, saveRating };
