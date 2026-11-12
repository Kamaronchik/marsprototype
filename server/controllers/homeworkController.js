const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { isDate } = require('../utils/attendance');
const { tashkentNow } = require('../utils/schedule');
const { notify } = require('../utils/notify');
const { createHomeworkRecord } = require('../utils/createHomework');

const MAX_TEXT = 5000;

const byName = (a, b) => a.fullName.localeCompare(b.fullName);

// The group, if this user may work with it: any group for the admin, own groups for a teacher.
const accessibleGroup = async (user, groupId) => {
  const { data } = await supabase.from('groups').select('id, name, teacher_id, status').eq('id', groupId).maybeSingle();
  if (!data) return null;
  if (user.role === 'Teacher' && data.teacher_id !== user.id) return null;
  return data;
};

// The homework with its group, if this user may work with it.
const accessibleHomework = async (user, id) => {
  const { data } = await supabase
    .from('homework')
    .select('id, group_id, title, max_score, status, group:groups(id, name, teacher_id)')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  if (user.role === 'Teacher' && data.group?.teacher_id !== user.id) return null;
  return data;
};

// --- Teacher / Admin ---------------------------------------------------------------

const createHomework = async (req, res) => {
  const { groupId, title, description, dueDate, maxScore } = req.body;
  if (!isUuid(groupId)) return res.status(400).json({ message: 'Group is required' });
  const name = typeof title === 'string' ? title.trim() : '';
  if (!name || name.length > 120) return res.status(400).json({ message: 'Title is required (up to 120 characters)' });
  const text = typeof description === 'string' ? description.trim() : '';
  if (text.length > MAX_TEXT) return res.status(400).json({ message: 'Text is too long' });
  if (dueDate && !isDate(dueDate)) return res.status(400).json({ message: 'Invalid date' });
  const max = maxScore === undefined ? 10 : maxScore;
  if (!Number.isInteger(max) || max < 1 || max > 100) return res.status(400).json({ message: 'Maximum score must be from 1 to 100' });

  const group = await accessibleGroup(req.user, groupId);
  if (!group) return res.status(404).json({ message: 'Group not found' });

  const result = await createHomeworkRecord({
    group, teacherId: req.user.id, title: name, description: text, dueDate, maxScore: max,
  });
  if (result.error) return handleDbError(result.error, res);

  res.status(201).json({ id: result.id });
};

const listTeacherHomework = async (req, res) => {
  let groupsQuery = supabase.from('groups').select('id, name').eq('status', 'active');
  if (req.user.role === 'Teacher') groupsQuery = groupsQuery.eq('teacher_id', req.user.id);
  const { data: groups, error: groupsError } = await groupsQuery.order('name');
  if (groupsError) return handleDbError(groupsError, res);
  if (!groups.length) return res.json({ homework: [], groups: [] });

  const ids = groups.map((g) => g.id);
  const [{ data: items, error }, { data: members }] = await Promise.all([
    supabase
      .from('homework')
      .select('id, group_id, title, description, due_date, max_score, created_at, submissions:homework_submissions(score)')
      .in('group_id', ids)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase.from('group_students').select('group_id').in('group_id', ids),
  ]);
  if (error) return handleDbError(error, res);

  const names = Object.fromEntries(groups.map((g) => [g.id, g.name]));
  const sizes = {};
  for (const m of members ?? []) sizes[m.group_id] = (sizes[m.group_id] ?? 0) + 1;

  res.json({
    groups,
    homework: items.map((h) => ({
      id: h.id,
      groupId: h.group_id,
      groupName: names[h.group_id],
      title: h.title,
      description: h.description,
      dueDate: h.due_date,
      maxScore: h.max_score,
      createdAt: h.created_at,
      studentCount: sizes[h.group_id] ?? 0,
      submittedCount: h.submissions.length,
      gradedCount: h.submissions.filter((s) => s.score !== null).length,
    })),
  });
};

// Every student of the group, each with the answer (or without one).
const listSubmissions = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });
  const homework = await accessibleHomework(req.user, id);
  if (!homework) return res.status(404).json({ message: 'Homework not found' });

  const [{ data: members, error }, { data: submissions }] = await Promise.all([
    supabase
      .from('group_students')
      .select('student:users!group_students_student_id_fkey(id, full_name)')
      .eq('group_id', homework.group_id),
    supabase
      .from('homework_submissions')
      .select('id, student_id, answer, link, submitted_at, score, feedback, graded_at')
      .eq('homework_id', id),
  ]);
  if (error) return handleDbError(error, res);

  const byStudent = Object.fromEntries((submissions ?? []).map((s) => [s.student_id, s]));
  res.json({
    homework: { id: homework.id, title: homework.title, maxScore: homework.max_score, groupName: homework.group.name },
    students: members
      .map((m) => {
        const s = byStudent[m.student.id];
        return {
          id: m.student.id,
          fullName: m.student.full_name,
          submission: s
            ? {
              id: s.id,
              answer: s.answer,
              link: s.link,
              submittedAt: s.submitted_at,
              score: s.score,
              feedback: s.feedback,
              gradedAt: s.graded_at,
            }
            : null,
        };
      })
      .sort(byName),
  });
};

const gradeSubmission = async (req, res) => {
  const { id } = req.params;
  const { score, feedback } = req.body;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });
  const note = typeof feedback === 'string' ? feedback.trim().slice(0, 1000) : '';

  const { data: submission } = await supabase
    .from('homework_submissions').select('id, homework_id, student_id').eq('id', id).maybeSingle();
  if (!submission) return res.status(404).json({ message: 'Answer not found' });
  const homework = await accessibleHomework(req.user, submission.homework_id);
  if (!homework) return res.status(404).json({ message: 'Answer not found' });

  if (!Number.isInteger(score) || score < 0 || score > homework.max_score) {
    return res.status(400).json({ message: 'Score must be a whole number from 0 to the maximum' });
  }

  const { error } = await supabase
    .from('homework_submissions')
    .update({ score, feedback: note || null, graded_by: req.user.id, graded_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return handleDbError(error, res);

  // The same mark goes to the student's grades.
  const { error: gradeError } = await supabase.from('grades').upsert({
    student_id: submission.student_id,
    group_id: homework.group_id,
    teacher_id: req.user.id,
    kind: 'homework',
    title: homework.title,
    score,
    max_score: homework.max_score,
    comment: note || null,
    submission_id: id,
  }, { onConflict: 'submission_id' });
  if (gradeError) return handleDbError(gradeError, res);

  await notify(
    submission.student_id,
    'homework.graded',
    { title: homework.title, score, maxScore: homework.max_score },
    { link: '/student/homework', dedupeKey: `homework.graded:${id}:${score}` },
  );
  res.json({ message: 'Graded' });
};

const archiveHomework = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });
  const homework = await accessibleHomework(req.user, id);
  if (!homework) return res.status(404).json({ message: 'Homework not found' });
  const { error } = await supabase.from('homework').update({ status: 'archived' }).eq('id', id);
  if (error) return handleDbError(error, res);
  res.json({ message: 'Homework removed' });
};

// --- Student -----------------------------------------------------------------------

// A student's homework: every task of their groups, with their own answer and mark.
const listMyHomework = async (req, res) => {
  const { data: memberships, error: memberError } = await supabase
    .from('group_students').select('group_id').eq('student_id', req.user.id);
  if (memberError) return handleDbError(memberError, res);
  const groupIds = memberships.map((m) => m.group_id);
  if (!groupIds.length) return res.json({ homework: [] });

  const { data: items, error } = await supabase
    .from('homework')
    .select('id, title, description, due_date, max_score, created_at, group:groups(name), teacher:users!homework_teacher_id_fkey(full_name)')
    .in('group_id', groupIds)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return handleDbError(error, res);

  const { data: submissions } = await supabase
    .from('homework_submissions')
    .select('homework_id, answer, link, submitted_at, score, feedback')
    .eq('student_id', req.user.id)
    .in('homework_id', items.map((h) => h.id));
  const mine = Object.fromEntries((submissions ?? []).map((s) => [s.homework_id, s]));
  const today = tashkentNow().date;

  res.json({
    homework: items.map((h) => {
      const s = mine[h.id];
      let state = 'todo';
      if (s) state = s.score === null ? 'submitted' : 'graded';
      return {
        id: h.id,
        title: h.title,
        description: h.description,
        dueDate: h.due_date,
        maxScore: h.max_score,
        groupName: h.group?.name ?? '',
        teacherName: h.teacher?.full_name ?? null,
        createdAt: h.created_at,
        state,
        overdue: state === 'todo' && !!h.due_date && h.due_date < today,
        answer: s?.answer ?? '',
        link: s?.link ?? '',
        submittedAt: s?.submitted_at ?? null,
        score: s?.score ?? null,
        feedback: s?.feedback ?? null,
      };
    }),
  });
};

const submitHomework = async (req, res) => {
  const { id } = req.params;
  const { answer, link } = req.body;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });
  const text = typeof answer === 'string' ? answer.trim() : '';
  const url = typeof link === 'string' ? link.trim() : '';
  if (!text && !url) return res.status(400).json({ message: 'Write an answer or add a link' });
  if (text.length > MAX_TEXT) return res.status(400).json({ message: 'Text is too long' });
  if (url && (url.length > 500 || !/^https?:\/\//i.test(url))) {
    return res.status(400).json({ message: 'The link must start with http:// or https://' });
  }

  const { data: homework } = await supabase
    .from('homework').select('id, group_id, title, status, group:groups(teacher_id)').eq('id', id).maybeSingle();
  if (!homework || homework.status !== 'active') return res.status(404).json({ message: 'Homework not found' });
  const { data: member } = await supabase
    .from('group_students').select('student_id').eq('group_id', homework.group_id).eq('student_id', req.user.id).maybeSingle();
  if (!member) return res.status(404).json({ message: 'Homework not found' });

  const { data: existing } = await supabase
    .from('homework_submissions').select('id, score').eq('homework_id', id).eq('student_id', req.user.id).maybeSingle();
  if (existing && existing.score !== null) return res.status(409).json({ message: 'This homework is already graded' });

  const row = { homework_id: id, student_id: req.user.id, answer: text, link: url || null, submitted_at: new Date().toISOString() };
  const { error } = await supabase.from('homework_submissions').upsert(row, { onConflict: 'homework_id,student_id' });
  if (error) return handleDbError(error, res);

  if (homework.group?.teacher_id) {
    const { data: student } = await supabase.from('users').select('full_name').eq('id', req.user.id).maybeSingle();
    await notify(
      homework.group.teacher_id,
      'homework.submitted',
      { title: homework.title, student: student?.full_name ?? '' },
      { link: '/teacher/homework', dedupeKey: `homework.submitted:${id}:${req.user.id}` },
    );
  }
  res.json({ message: 'Sent' });
};

module.exports = {
  createHomework, listTeacherHomework, listSubmissions, gradeSubmission, archiveHomework, listMyHomework, submitHomework,
};
