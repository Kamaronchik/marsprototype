const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { logAction } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { dashboard, riskStudents, teacherStats } = require('../utils/academicStats');

// The dashboard of the academic manager: plain numbers.
// Analytics can be limited to one subject: ?subjectId=<uuid>
const readSubject = (req, res) => {
  const { subjectId } = req.query;
  if (subjectId !== undefined && !isUuid(subjectId)) {
    res.status(400).json({ message: 'Invalid subject' });
    return false;
  }
  return true;
};

const getDashboard = async (req, res) => {
  if (!readSubject(req, res)) return;
  try {
    res.json(await dashboard(req.query.subjectId));
  } catch (error) {
    handleDbError(error, res);
  }
};

// Students at risk. Counted by code from attendance and marks.
const getRiskStudents = async (req, res) => {
  if (!readSubject(req, res)) return;
  try {
    res.json({ students: await riskStudents(req.query.subjectId) });
  } catch (error) {
    handleDbError(error, res);
  }
};

// Teachers: average rating, checked homework, lessons without a topic, anonymous reviews.
const getTeachers = async (req, res) => {
  if (!readSubject(req, res)) return;
  try {
    res.json({ teachers: await teacherStats(req.query.subjectId) });
  } catch (error) {
    handleDbError(error, res);
  }
};

// Moves a student from one group to another. The old marks stay in the old group.
const transferStudent = async (req, res) => {
  const { studentId, fromGroupId, toGroupId } = req.body;
  if (!isUuid(studentId) || !isUuid(fromGroupId) || !isUuid(toGroupId)) return res.status(400).json({ message: 'Invalid id' });
  if (fromGroupId === toGroupId) return res.status(400).json({ message: 'Choose a different group' });

  const [{ data: member }, { data: target }] = await Promise.all([
    supabase.from('group_students').select('student_id').eq('group_id', fromGroupId).eq('student_id', studentId).maybeSingle(),
    supabase.from('groups').select('id, name, teacher_id, status').eq('id', toGroupId).maybeSingle(),
  ]);
  if (!member) return res.status(404).json({ message: 'Student is not in this group' });
  if (!target || target.status !== 'active') return res.status(404).json({ message: 'Group not found' });

  // Insert first: if it fails, the student stays where they were.
  const { error } = await supabase
    .from('group_students')
    .upsert({ group_id: toGroupId, student_id: studentId }, { onConflict: 'group_id,student_id', ignoreDuplicates: true });
  if (error) return handleDbError(error, res);
  const { error: removeError } = await supabase.from('group_students').delete().eq('group_id', fromGroupId).eq('student_id', studentId);
  if (removeError) return handleDbError(removeError, res);

  const { data: student } = await supabase.from('users').select('full_name').eq('id', studentId).maybeSingle();
  if (target.teacher_id) {
    await notify(target.teacher_id, 'group.student_added', { studentName: student?.full_name ?? '', groupName: target.name }, { link: '/teacher/groups' });
  }
  await logAction(req.user.id, 'group.transfer_student', 'group', toGroupId, { studentId, fromGroupId });
  res.json({ message: 'Student moved' });
};

// Gives a group another head teacher. The database refuses a teacher who is busy at that time.
const assignTeacher = async (req, res) => {
  const { id } = req.params;
  const { teacherId } = req.body;
  if (!isUuid(id) || !isUuid(teacherId)) return res.status(400).json({ message: 'Invalid id' });

  const { data: teacher } = await supabase
    .from('users').select('id').eq('id', teacherId).eq('role', 'Teacher').eq('status', 'active').maybeSingle();
  if (!teacher) return res.status(400).json({ message: 'Teacher not found' });

  const { data, error } = await supabase.from('groups').update({ teacher_id: teacherId }).eq('id', id).select('id').maybeSingle();
  if (error) {
    if (error.message === 'TEACHER_BUSY') return res.status(409).json({ message: 'This teacher already has a group at that time', code: 'TEACHER_BUSY' });
    return handleDbError(error, res);
  }
  if (!data) return res.status(404).json({ message: 'Group not found' });

  await logAction(req.user.id, 'group.assign_teacher', 'group', id, { teacherId });
  res.json({ message: 'Teacher assigned' });
};

// Gives a group its subject (or takes it away: subjectId = null).
const assignSubject = async (req, res) => {
  const { id } = req.params;
  const { subjectId = null } = req.body;
  if (!isUuid(id) || (subjectId !== null && !isUuid(subjectId))) return res.status(400).json({ message: 'Invalid id' });

  if (subjectId) {
    const { data: subject } = await supabase.from('subjects').select('id').eq('id', subjectId).maybeSingle();
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
  }
  const { data, error } = await supabase.from('groups').update({ subject_id: subjectId }).eq('id', id).select('id').maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return res.status(404).json({ message: 'Group not found' });

  await logAction(req.user.id, 'group.assign_subject', 'group', id, { subjectId });
  res.json({ message: 'Subject assigned' });
};

// Teachers for the "assign teacher" list: id and name only.
const listTeacherNames = async (req, res) => {
  const { data, error } = await supabase
    .from('users').select('id, full_name').eq('role', 'Teacher').eq('status', 'active').order('full_name');
  if (error) return handleDbError(error, res);
  res.json({ teachers: data.map((t) => ({ id: t.id, fullName: t.full_name })) });
};

module.exports = { getDashboard, getRiskStudents, getTeachers, transferStudent, assignTeacher, assignSubject, listTeacherNames };
