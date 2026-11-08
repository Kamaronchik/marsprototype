const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { PAYMENT_STATUSES, changePaymentStatus } = require('../utils/students');

const COLUMNS = `id, username, full_name, email, status, payment_status, created_at,
  memberships:group_students(group:groups(id, name, room, weekdays, start_time, status, teacher:users!groups_teacher_id_fkey(full_name)))`;

const toClient = (s) => ({
  id: s.id,
  username: s.username,
  fullName: s.full_name,
  email: s.email,
  accountStatus: s.status,
  paymentStatus: s.payment_status,
  createdAt: s.created_at,
  groups: s.memberships
    .filter((m) => m.group && m.group.status === 'active')
    .map((m) => ({
      id: m.group.id,
      name: m.group.name,
      room: m.group.room,
      weekdays: m.group.weekdays,
      startTime: m.group.start_time ? m.group.start_time.slice(0, 5) : null,
      teacherName: m.group.teacher?.full_name ?? null,
    })),
});

// Global student search. One box finds a student by name, username, email, group name or teacher.
// Filters: ?paymentStatus=debtor|active  ?groupId=<uuid>
const searchStudents = async (req, res) => {
  const { q, paymentStatus, groupId } = req.query;
  if (paymentStatus !== undefined && !PAYMENT_STATUSES.includes(paymentStatus)) {
    return res.status(400).json({ message: 'Invalid payment status' });
  }
  if (groupId !== undefined && !isUuid(groupId)) return res.status(400).json({ message: 'Invalid group id' });

  let query = supabase.from('users').select(COLUMNS).eq('role', 'Student').order('full_name').limit(1000);
  if (paymentStatus) query = query.eq('payment_status', paymentStatus);

  const { data, error } = await query;
  if (error) return handleDbError(error, res);

  let students = data.map(toClient);
  if (groupId) students = students.filter((s) => s.groups.some((g) => g.id === groupId));

  const needle = typeof q === 'string' ? q.trim().toLowerCase() : '';
  if (needle) {
    students = students.filter((s) => [
      s.fullName, s.username, s.email,
      ...s.groups.flatMap((g) => [g.name, g.teacherName, g.room]),
    ].some((text) => text && text.toLowerCase().includes(needle)));
  }

  res.json({ students });
};

// Admin or financier: mark a student as debtor, or back to active after the payment.
// The student gets a notification either way.
const setPaymentStatus = async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid student id' });
  if (!PAYMENT_STATUSES.includes(paymentStatus)) return res.status(400).json({ message: 'Invalid payment status' });

  const result = await changePaymentStatus(id, paymentStatus, req.user.id);
  if (result.error) return handleDbError(result.error, res);
  if (result.notFound) return res.status(404).json({ message: 'Student not found' });
  res.json({ paymentStatus: result.paymentStatus });
};

module.exports = { searchStudents, setPaymentStatus };
