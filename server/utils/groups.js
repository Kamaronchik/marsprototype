const supabase = require('../config/supabase');
const { notify } = require('./notify');
const { logAction } = require('./audit');

// Puts a student into a group and tells the head teacher about it.
// Returns { error } when the group does not exist, is archived, or the database fails.
const addStudentToGroup = async (groupId, student, actorId) => {
  const { data: group, error: groupError } = await supabase
    .from('groups').select('id, name, teacher_id, status').eq('id', groupId).maybeSingle();
  if (groupError) return { error: groupError };
  if (!group || group.status !== 'active') return { notFound: true };

  const { error } = await supabase
    .from('group_students')
    .upsert({ group_id: groupId, student_id: student.id }, { onConflict: 'group_id,student_id', ignoreDuplicates: true });
  if (error) return { error };

  if (group.teacher_id) {
    await notify(
      group.teacher_id,
      'group.student_added',
      { studentName: student.full_name, groupName: group.name },
      { link: '/teacher/groups' },
    );
  }
  await logAction(actorId, 'group.add_student', 'group', groupId, { studentId: student.id });
  return { group };
};

module.exports = { addStudentToGroup };
