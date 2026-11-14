const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { tashkentNow } = require('../utils/schedule');
const { isDate, isMarkingOpen, loadTeacherGroups } = require('../utils/attendance');
const { slotsOnDate } = require('../utils/lessonDay');
const { saveMark } = require('../utils/saveMark');
const { createHomeworkRecord } = require('../utils/createHomework');
const { logAction } = require('../utils/audit');

const MAX_TOPIC = 200;
const MAX_NOTES = 2000;
const STATUSES = ['present', 'late', 'absent'];

const byName = (a, b) => a.fullName.localeCompare(b.fullName);

// Teacher: today's lessons by the schedule. Each one has the students (with today's tick or cross)
// and, when the lesson was already held, its topic.
const getToday = async (req, res) => {
  const now = tashkentNow();
  try {
    const slots = await slotsOnDate(now.date, { teacherId: req.user.id });
    const groups = await loadTeacherGroups(req.user.id);
    const ids = slots.map((s) => s.groupId);
    if (!ids.length) return res.json({ date: now.date, markingOpen: isMarkingOpen(now), lessons: [] });

    const [{ data: held, error }, { data: marks }] = await Promise.all([
      supabase.from('lessons').select('id, group_id, topic, notes').eq('date', now.date).in('group_id', ids),
      supabase.from('attendance').select('group_id, student_id, status').eq('lesson_date', now.date).in('group_id', ids),
    ]);
    if (error) return handleDbError(error, res);

    res.json({
      date: now.date,
      markingOpen: isMarkingOpen(now),
      lessons: slots.map((slot) => {
        const group = groups.find((g) => g.id === slot.groupId);
        const lesson = held.find((l) => l.group_id === slot.groupId);
        return {
          groupId: slot.groupId,
          groupName: slot.groupName,
          room: slot.room,
          startTime: slot.startTime,
          endTime: slot.endTime,
          lesson: lesson ? { id: lesson.id, topic: lesson.topic, notes: lesson.notes } : null,
          students: (group?.members ?? [])
            .map((m) => ({
              id: m.student.id,
              fullName: m.student.full_name,
              status: marks?.find((r) => r.group_id === slot.groupId && r.student_id === m.student.id)?.status ?? null,
            }))
            .sort(byName),
        };
      }),
    });
  } catch (error) {
    handleDbError(error, res);
  }
};

// Checks the form body. Returns a message or null.
const validate = ({ groupId, topic, notes, attendance, homework }) => {
  if (!isUuid(groupId)) return 'Choose a group';
  const name = typeof topic === 'string' ? topic.trim() : '';
  if (!name) return 'Write the topic of the lesson';
  if (name.length > MAX_TOPIC) return 'The topic is too long';
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > MAX_NOTES)) return 'The notes are too long';
  if (!Array.isArray(attendance) || !attendance.length) return 'Mark the students';
  if (!attendance.every((a) => isUuid(a.studentId) && STATUSES.includes(a.status))) return 'Invalid attendance';
  if (homework) {
    if (typeof homework.title !== 'string' || !homework.title.trim() || homework.title.length > 120) return 'Homework title: 1-120 characters';
    if (homework.dueDate && !isDate(homework.dueDate)) return 'Invalid date';
  }
  return null;
};

// The one short form after a lesson: topic + attendance + (optional) homework.
// Teacher: own group, today, while the school is open. Admin: any group and date (a correction).
const createLesson = async (req, res) => {
  const { groupId, topic, notes, attendance, homework } = req.body;
  const problem = validate({ groupId, topic, notes, attendance, homework });
  if (problem) return res.status(400).json({ message: problem });

  const now = tashkentNow();
  const isAdmin = req.user.role === 'Admin';
  let date = now.date;
  if (isAdmin && req.body.date !== undefined) date = req.body.date;
  if (!isDate(date) || date > now.date) return res.status(400).json({ message: 'Invalid date' });
  if (!isAdmin && !isMarkingOpen(now)) {
    return res.status(403).json({ message: 'Attendance can be marked from 09:00 to 22:00', code: 'MARKING_CLOSED' });
  }

  const { data: group, error: groupError } = await supabase
    .from('groups').select('id, name, teacher_id, status').eq('id', groupId).maybeSingle();
  if (groupError) return handleDbError(groupError, res);
  if (!group || group.status !== 'active' || (!isAdmin && group.teacher_id !== req.user.id)) {
    return res.status(404).json({ message: 'Group not found' });
  }

  try {
    if (!(await slotsOnDate(date, { groupId })).length) {
      return res.status(400).json({ message: 'This group has no lesson on that day', code: 'NO_LESSON' });
    }
  } catch (error) {
    return handleDbError(error, res);
  }

  // Every student in the list must be in the group and not frozen.
  const { data: members, error: membersError } = await supabase
    .from('group_students').select('student_id, student:users!group_students_student_id_fkey(status)').eq('group_id', groupId);
  if (membersError) return handleDbError(membersError, res);
  const allowed = new Set(members.filter((m) => m.student?.status !== 'frozen').map((m) => m.student_id));
  if (!attendance.every((a) => allowed.has(a.studentId))) return res.status(400).json({ message: 'Student is not in this group' });

  // One lesson per group per day: sending the form again corrects it.
  const { data: lesson, error } = await supabase
    .from('lessons')
    .upsert(
      { group_id: groupId, teacher_id: group.teacher_id, date, topic: topic.trim(), notes: notes?.trim() || null },
      { onConflict: 'group_id,date' },
    )
    .select('id')
    .single();
  if (error) return handleDbError(error, res);

  for (const mark of attendance) {
    const result = await saveMark({ group, studentId: mark.studentId, status: mark.status, date, actorId: req.user.id, lessonId: lesson.id });
    if (result.error) return handleDbError(result.error, res);
  }
  // Marks made on the attendance page before the form also belong to this lesson.
  await supabase.from('attendance').update({ lesson_id: lesson.id }).eq('group_id', groupId).eq('lesson_date', date);

  let homeworkId = null;
  if (homework) {
    const result = await createHomeworkRecord({
      group,
      teacherId: req.user.id,
      title: homework.title.trim(),
      description: typeof homework.description === 'string' ? homework.description.trim().slice(0, 5000) : '',
      dueDate: homework.dueDate,
      lessonId: lesson.id,
    });
    if (result.error) return handleDbError(result.error, res);
    homeworkId = result.id;
  }

  await logAction(req.user.id, 'lesson.create', 'group', groupId, { date, topic: topic.trim() });
  res.status(201).json({ id: lesson.id, homeworkId });
};

// The lesson journal for the admin and the academic manager. Filters: ?groupId ?teacherId ?from ?to.
// Ratings are shown as numbers only: no student names.
const listLessons = async (req, res) => {
  const { groupId, teacherId, from, to } = req.query;
  if ((groupId && !isUuid(groupId)) || (teacherId && !isUuid(teacherId))) return res.status(400).json({ message: 'Invalid filter' });
  if ((from && !isDate(from)) || (to && !isDate(to))) return res.status(400).json({ message: 'Invalid date range' });

  let query = supabase
    .from('lessons')
    .select(`id, group_id, teacher_id, date, topic, notes,
      group:groups!lessons_group_id_fkey(name),
      teacher:users!lessons_teacher_id_fkey(full_name),
      marks:attendance(status),
      homework(id),
      ratings:lesson_ratings(score)`)
    .order('date', { ascending: false })
    .limit(300);
  if (groupId) query = query.eq('group_id', groupId);
  if (teacherId) query = query.eq('teacher_id', teacherId);
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query;
  if (error) return handleDbError(error, res);

  res.json({
    lessons: data.map((l) => ({
      id: l.id,
      date: l.date,
      topic: l.topic,
      notes: l.notes,
      groupId: l.group_id,
      groupName: l.group?.name ?? null,
      teacherId: l.teacher_id,
      teacherName: l.teacher?.full_name ?? null,
      present: l.marks.filter((m) => m.status === 'present').length,
      late: l.marks.filter((m) => m.status === 'late').length,
      absent: l.marks.filter((m) => m.status === 'absent').length,
      homeworkCount: l.homework.length,
      ratingCount: l.ratings.length,
      averageRating: l.ratings.length
        ? Math.round((l.ratings.reduce((sum, r) => sum + r.score, 0) / l.ratings.length) * 10) / 10
        : null,
    })),
  });
};

module.exports = { getToday, createLesson, listLessons };
