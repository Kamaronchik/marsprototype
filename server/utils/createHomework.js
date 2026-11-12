const supabase = require('../config/supabase');
const { notify } = require('./notify');

// Saves a homework for a group and tells every student of the group.
// Used by the homework page and by the "hold a lesson" form. Returns { id } or { error }.
const createHomeworkRecord = async ({ group, teacherId, title, description = '', dueDate = null, maxScore = 10, lessonId = null }) => {
  const row = {
    group_id: group.id, teacher_id: teacherId, title, description, due_date: dueDate || null, max_score: maxScore,
  };
  if (lessonId) row.lesson_id = lessonId;

  const { data, error } = await supabase.from('homework').insert(row).select('id').single();
  if (error) return { error };

  const { data: members } = await supabase.from('group_students').select('student_id').eq('group_id', group.id);
  await Promise.all((members ?? []).map((m) => notify(
    m.student_id,
    'homework.new',
    { title, groupName: group.name, date: dueDate || '' },
    { link: '/student/homework', dedupeKey: `homework.new:${data.id}:${m.student_id}` },
  )));

  return { id: data.id };
};

module.exports = { createHomeworkRecord };
