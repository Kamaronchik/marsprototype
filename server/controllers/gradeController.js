const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { notify } = require('../utils/notify');

const MANUAL_KINDS = ['lesson', 'test', 'project'];

const toClient = (g) => ({
  id: g.id,
  groupId: g.group_id,
  kind: g.kind,
  title: g.title,
  score: g.score,
  maxScore: g.max_score,
  percent: Math.round((g.score / g.max_score) * 100),
  comment: g.comment,
  fromHomework: !!g.submission_id,
  createdAt: g.created_at,
});

// The average of the marks, in percent: a mark out of 5 and a mark out of 10 count the same.
const averagePercent = (grades) => (grades.length
  ? Math.round(grades.reduce((sum, g) => sum + (g.score / g.max_score) * 100, 0) / grades.length)
  : null);

const accessibleGroup = async (user, groupId) => {
  const { data } = await supabase.from('groups').select('id, name, teacher_id').eq('id', groupId).maybeSingle();
  if (!data) return null;
  if (user.role === 'Teacher' && data.teacher_id !== user.id) return null;
  return data;
};

// --- Teacher / Admin ---------------------------------------------------------------

const addGrade = async (req, res) => {
  const { studentId, groupId, kind, title, score, maxScore, comment } = req.body;
  if (!isUuid(studentId) || !isUuid(groupId)) return res.status(400).json({ message: 'Student and group are required' });
  if (!MANUAL_KINDS.includes(kind)) return res.status(400).json({ message: 'Invalid type of mark' });
  const name = typeof title === 'string' ? title.trim() : '';
  if (!name || name.length > 120) return res.status(400).json({ message: 'Title is required (up to 120 characters)' });
  const max = maxScore === undefined ? 10 : maxScore;
  if (!Number.isInteger(max) || max < 1 || max > 100) return res.status(400).json({ message: 'Maximum score must be from 1 to 100' });
  if (!Number.isInteger(score) || score < 0 || score > max) {
    return res.status(400).json({ message: 'Score must be a whole number from 0 to the maximum' });
  }
  const note = typeof comment === 'string' ? comment.trim().slice(0, 500) : '';

  const group = await accessibleGroup(req.user, groupId);
  if (!group) return res.status(404).json({ message: 'Group not found' });
  const { data: member } = await supabase
    .from('group_students').select('student_id').eq('group_id', groupId).eq('student_id', studentId).maybeSingle();
  if (!member) return res.status(404).json({ message: 'Student not found' });

  const { data, error } = await supabase
    .from('grades')
    .insert({
      student_id: studentId, group_id: groupId, teacher_id: req.user.id,
      kind, title: name, score, max_score: max, comment: note || null,
    })
    .select('id')
    .single();
  if (error) return handleDbError(error, res);

  await notify(studentId, 'grade.added', { title: name, score, maxScore: max, groupName: group.name }, { link: '/student/grades' });
  res.status(201).json({ id: data.id });
};

// Every student of a group with their marks and average.
const listGroupGrades = async (req, res) => {
  const { groupId } = req.params;
  if (!isUuid(groupId)) return res.status(400).json({ message: 'Invalid group id' });
  const group = await accessibleGroup(req.user, groupId);
  if (!group) return res.status(404).json({ message: 'Group not found' });

  const [{ data: members, error }, { data: grades }] = await Promise.all([
    supabase
      .from('group_students')
      .select('student:users!group_students_student_id_fkey(id, full_name)')
      .eq('group_id', groupId),
    supabase
      .from('grades')
      .select('id, student_id, group_id, kind, title, score, max_score, comment, submission_id, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
  ]);
  if (error) return handleDbError(error, res);

  res.json({
    group: { id: group.id, name: group.name },
    students: members
      .map((m) => {
        const own = (grades ?? []).filter((g) => g.student_id === m.student.id);
        return {
          id: m.student.id,
          fullName: m.student.full_name,
          average: averagePercent(own),
          grades: own.map(toClient),
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  });
};

const deleteGrade = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });
  const { data: grade } = await supabase.from('grades').select('id, group_id, submission_id').eq('id', id).maybeSingle();
  if (!grade || !(await accessibleGroup(req.user, grade.group_id))) return res.status(404).json({ message: 'Mark not found' });
  if (grade.submission_id) return res.status(400).json({ message: 'A homework mark is changed in the homework' });

  const { error } = await supabase.from('grades').delete().eq('id', id);
  if (error) return handleDbError(error, res);
  res.json({ message: 'Mark deleted' });
};

// --- Student -----------------------------------------------------------------------

const listMyGrades = async (req, res) => {
  const { data, error } = await supabase
    .from('grades')
    .select('id, group_id, kind, title, score, max_score, comment, submission_id, created_at, group:groups(name)')
    .eq('student_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return handleDbError(error, res);

  const byGroup = new Map();
  for (const g of data) {
    if (!byGroup.has(g.group_id)) byGroup.set(g.group_id, { groupId: g.group_id, groupName: g.group?.name ?? '', raw: [] });
    byGroup.get(g.group_id).raw.push(g);
  }

  res.json({
    average: averagePercent(data),
    count: data.length,
    groups: [...byGroup.values()].map((entry) => ({
      groupId: entry.groupId,
      groupName: entry.groupName,
      average: averagePercent(entry.raw),
      grades: entry.raw.map(toClient),
    })),
  });
};

module.exports = { addGrade, listGroupGrades, deleteGrade, listMyGrades };
