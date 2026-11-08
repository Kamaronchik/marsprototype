const supabase = require('../config/supabase');
const { isUuid } = require('../utils/validate');
const { logAction } = require('../utils/audit');
const { addStudentToGroup } = require('../utils/groups');
const { ROOMS, WEEKDAYS, SLOTS, LESSON_MINUTES, BREAK_MINUTES, DAY_OPEN, DAY_CLOSE, toTime } = require('../utils/schedule');

const COLUMNS = 'id, name, teacher_id, room, weekdays, start_time, monthly_price, status, created_at, teacher:users!groups_teacher_id_fkey(full_name), group_students(count)';

const toClient = (g) => ({
  id: g.id,
  name: g.name,
  teacherId: g.teacher_id,
  teacherName: g.teacher?.full_name ?? null,
  room: g.room,
  weekdays: g.weekdays,
  startTime: g.start_time ? g.start_time.slice(0, 5) : null,
  monthlyPrice: Number(g.monthly_price),
  status: g.status,
  studentCount: g.group_students?.[0]?.count ?? 0,
});

const byName = (a, b) => a.fullName.localeCompare(b.fullName);

const handleDbError = (error, res) => {
  if (error.message === 'ROOM_BUSY') {
    return res.status(409).json({ message: 'This room is already taken at that time', code: 'ROOM_BUSY' });
  }
  if (error.message === 'TEACHER_BUSY') {
    return res.status(409).json({ message: 'This teacher already has a group at that time', code: 'TEACHER_BUSY' });
  }
  if (error.code === '23505') {
    return res.status(409).json({ message: 'A group with this name already exists', code: 'NAME_TAKEN' });
  }
  console.error('Group API error:', error);
  return res.status(500).json({ message: 'Database error' });
};

const validate = ({ name, teacherId, room, weekdays, startTime, monthlyPrice }, { partial }) => {
  if (!partial || name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) return 'Name: 1-60 characters';
  }
  if (!partial || teacherId !== undefined) {
    if (!isUuid(teacherId)) return 'Choose the head teacher';
  }
  if (!partial || room !== undefined) {
    if (!ROOMS.includes(room)) return 'Choose a room from A1 to C4';
  }
  if (!partial || weekdays !== undefined) {
    const valid = Array.isArray(weekdays) && weekdays.length > 0 &&
      new Set(weekdays).size === weekdays.length && weekdays.every((d) => WEEKDAYS.includes(d));
    if (!valid) return 'Choose at least one weekday';
  }
  if (!partial || startTime !== undefined) {
    if (!SLOTS.includes(startTime)) return 'Choose a lesson time from the list';
  }
  if (monthlyPrice !== undefined && !(Number.isInteger(monthlyPrice) && monthlyPrice >= 0)) {
    return 'Monthly price must be a whole number';
  }
  return null;
};

// The head teacher must be an active Teacher.
const teacherExists = async (teacherId) => {
  const { data } = await supabase
    .from('users').select('id').eq('id', teacherId).eq('role', 'Teacher').eq('status', 'active').maybeSingle();
  return !!data;
};

// Lists for the "create group" form: rooms, lesson times, weekdays.
const getOptions = (req, res) => {
  res.json({
    rooms: ROOMS,
    weekdays: WEEKDAYS,
    slots: SLOTS.map((start) => ({
      start,
      end: toTime(Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + LESSON_MINUTES),
    })),
    lessonMinutes: LESSON_MINUTES,
    breakMinutes: BREAK_MINUTES,
    open: toTime(DAY_OPEN),
    close: toTime(DAY_CLOSE),
  });
};

// Every group with its teacher, room and time: the form uses it to grey out taken slots.
const listGroups = async (req, res) => {
  const { data, error } = await supabase.from('groups').select(COLUMNS).order('name');
  if (error) return handleDbError(error, res);
  res.json({ groups: data.map(toClient) });
};

const createGroup = async (req, res) => {
  const { name, teacherId, room, weekdays, startTime, monthlyPrice } = req.body;
  const problem = validate({ name, teacherId, room, weekdays, startTime, monthlyPrice }, { partial: false });
  if (problem) return res.status(400).json({ message: problem });
  if (!(await teacherExists(teacherId))) return res.status(400).json({ message: 'Teacher not found' });

  const { data, error } = await supabase
    .from('groups')
    .insert({
      name: name.trim(),
      teacher_id: teacherId,
      room,
      weekdays: [...weekdays].sort((a, b) => a - b),
      start_time: startTime,
      monthly_price: monthlyPrice ?? 0,
    })
    .select(COLUMNS)
    .single();
  if (error) return handleDbError(error, res);

  await logAction(req.user.id, 'group.create', 'group', data.id, { name: data.name });
  res.status(201).json({ group: toClient(data) });
};

const updateGroup = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid group id' });

  const { name, teacherId, room, weekdays, startTime, monthlyPrice } = req.body;
  const problem = validate({ name, teacherId, room, weekdays, startTime, monthlyPrice }, { partial: true });
  if (problem) return res.status(400).json({ message: problem });
  if (teacherId !== undefined && !(await teacherExists(teacherId))) {
    return res.status(400).json({ message: 'Teacher not found' });
  }

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (teacherId !== undefined) updates.teacher_id = teacherId;
  if (room !== undefined) updates.room = room;
  if (weekdays !== undefined) updates.weekdays = [...weekdays].sort((a, b) => a - b);
  if (startTime !== undefined) updates.start_time = startTime;
  if (monthlyPrice !== undefined) updates.monthly_price = monthlyPrice;
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'Nothing to update' });

  const { data, error } = await supabase
    .from('groups').update(updates).eq('id', id).select(COLUMNS).maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return res.status(404).json({ message: 'Group not found' });

  await logAction(req.user.id, 'group.update', 'group', id, updates);
  res.json({ group: toClient(data) });
};

// A group is archived, not deleted: its attendance history stays. Its room and time become free.
const archiveGroup = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid group id' });

  const { data, error } = await supabase
    .from('groups').update({ status: 'archived' }).eq('id', id).select('id').maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return res.status(404).json({ message: 'Group not found' });

  await logAction(req.user.id, 'group.archive', 'group', id);
  res.json({ message: 'Group archived' });
};

// Students of a group. A teacher may open only their own group.
const listGroupStudents = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid group id' });

  const { data: group } = await supabase.from('groups').select('teacher_id').eq('id', id).maybeSingle();
  if (!group) return res.status(404).json({ message: 'Group not found' });
  if (req.user.role === 'Teacher' && group.teacher_id !== req.user.id) {
    return res.status(404).json({ message: 'Group not found' });
  }

  const { data, error } = await supabase
    .from('group_students')
    .select('student:users!group_students_student_id_fkey(id, full_name, email, payment_status)')
    .eq('group_id', id);
  if (error) return handleDbError(error, res);

  res.json({
    students: data
      .map((row) => ({
        id: row.student.id,
        fullName: row.student.full_name,
        email: row.student.email,
        paymentStatus: row.student.payment_status,
      }))
      .sort(byName),
  });
};

const addStudent = async (req, res) => {
  const { id } = req.params;
  const { studentId } = req.body;
  if (!isUuid(id) || !isUuid(studentId)) return res.status(400).json({ message: 'Invalid id' });

  const { data: student } = await supabase
    .from('users').select('id, full_name').eq('id', studentId).eq('role', 'Student').maybeSingle();
  if (!student) return res.status(404).json({ message: 'Student not found' });

  const result = await addStudentToGroup(id, student, req.user.id);
  if (result.error) return handleDbError(result.error, res);
  if (result.notFound) return res.status(404).json({ message: 'Group not found' });
  res.status(201).json({ message: 'Student added' });
};

const removeStudent = async (req, res) => {
  const { id, studentId } = req.params;
  if (!isUuid(id) || !isUuid(studentId)) return res.status(400).json({ message: 'Invalid id' });

  const { error } = await supabase.from('group_students').delete().eq('group_id', id).eq('student_id', studentId);
  if (error) return handleDbError(error, res);

  await logAction(req.user.id, 'group.remove_student', 'group', id, { studentId });
  res.json({ message: 'Student removed' });
};

// The logged-in teacher's own groups with their students.
const listMyGroups = async (req, res) => {
  const { data, error } = await supabase
    .from('groups')
    .select(`${COLUMNS}, members:group_students(student:users!group_students_student_id_fkey(id, full_name, email))`)
    .eq('teacher_id', req.user.id)
    .eq('status', 'active')
    .order('name');
  if (error) return handleDbError(error, res);

  res.json({
    groups: data.map((g) => ({
      ...toClient(g),
      students: g.members
        .map((m) => ({ id: m.student.id, fullName: m.student.full_name, email: m.student.email }))
        .sort(byName),
    })),
  });
};

module.exports = {
  getOptions, listGroups, createGroup, updateGroup, archiveGroup,
  listGroupStudents, addStudent, removeStudent, listMyGroups,
};
