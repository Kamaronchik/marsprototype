const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid, isPositiveInt } = require('../utils/validate');
const { logAction } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { changePaymentStatus } = require('../utils/students');
const { tashkentNow, TIMEZONE } = require('../utils/schedule');
const { readRange, applyRange } = require('../utils/financeRange');

const METHODS = ['cash', 'card', 'transfer'];
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const HISTORY_MONTHS = 6;

const PAYMENT_COLUMNS = `id, student_id, amount, period, method, note, paid_at,
  student:users!payments_student_id_fkey(full_name),
  group:groups!payments_group_id_fkey(name)`;

const SALARY_COLUMNS = `id, teacher_id, amount, period, note, paid_at,
  teacher:users!teacher_salaries_teacher_id_fkey(full_name)`;

const toPayment = (p) => ({
  id: p.id,
  studentId: p.student_id,
  studentName: p.student?.full_name ?? null,
  groupName: p.group?.name ?? null,
  amount: Number(p.amount),
  period: p.period,
  method: p.method,
  note: p.note,
  paidAt: p.paid_at,
});

const toSalary = (s) => ({
  id: s.id,
  teacherId: s.teacher_id,
  teacherName: s.teacher?.full_name ?? null,
  amount: Number(s.amount),
  period: s.period,
  note: s.note,
  paidAt: s.paid_at,
});

// 'YYYY-MM' of a timestamp, in Tashkent time (the school's own calendar).
const monthOf = (timestamp) => tashkentNow(new Date(timestamp)).date.slice(0, 7);

const shiftMonth = (month, delta) => {
  const [year, number] = month.split('-').map(Number);
  const moved = new Date(Date.UTC(year, number - 1 + delta, 1));
  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}`;
};

const cleanNote = (note) => (typeof note === 'string' ? note.trim().slice(0, 200) : '') || null;

// Numbers for the front page: people, debtors, this month's money and the last 6 months.
const getOverview = async (req, res) => {
  const month = tashkentNow().date.slice(0, 7);
  const firstMonth = shiftMonth(month, -(HISTORY_MONTHS - 1));
  const since = `${firstMonth}-01T00:00:00+05:00`;

  const [students, debtors, payments, salaries] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'Student').eq('status', 'active'),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'Student').eq('payment_status', 'debtor'),
    supabase.from('payments').select('amount, paid_at').gte('paid_at', since),
    supabase.from('teacher_salaries').select('amount, paid_at').gte('paid_at', since),
  ]);
  const failed = [students, debtors, payments, salaries].find((r) => r.error);
  if (failed) return handleDbError(failed.error, res);

  const history = Array.from({ length: HISTORY_MONTHS }, (_, i) => ({ month: shiftMonth(firstMonth, i), revenue: 0, salaries: 0 }));
  const sumInto = (rows, field) => rows.forEach((row) => {
    const entry = history.find((h) => h.month === monthOf(row.paid_at));
    if (entry) entry[field] += Number(row.amount);
  });
  sumInto(payments.data, 'revenue');
  sumInto(salaries.data, 'salaries');

  const current = history[history.length - 1];
  res.json({
    month,
    timezone: TIMEZONE,
    students: students.count,
    debtors: debtors.count,
    revenue: current.revenue,
    salaries: current.salaries,
    history,
  });
};

// Payments of students. Filters: ?from ?to ?studentId
const listPayments = async (req, res) => {
  const range = readRange(req.query);
  if (!range) return res.status(400).json({ message: 'Invalid date range' });
  if (req.query.studentId && !isUuid(req.query.studentId)) return res.status(400).json({ message: 'Invalid student id' });

  let query = supabase.from('payments').select(PAYMENT_COLUMNS).order('paid_at', { ascending: false }).limit(500);
  query = applyRange(query, range);
  if (req.query.studentId) query = query.eq('student_id', req.query.studentId);

  const { data, error } = await query;
  if (error) return handleDbError(error, res);
  res.json({ payments: data.map(toPayment) });
};

// Writes down a payment. With markPaid the student stops being a debtor.
const createPayment = async (req, res) => {
  const { studentId, amount, period, method = 'cash', note, groupId, markPaid } = req.body;
  if (!isUuid(studentId)) return res.status(400).json({ message: 'Choose a student' });
  if (!isPositiveInt(amount)) return res.status(400).json({ message: 'Amount must be a positive whole number' });
  if (!PERIOD_PATTERN.test(period || '')) return res.status(400).json({ message: 'Period must look like 2026-11' });
  if (!METHODS.includes(method)) return res.status(400).json({ message: 'Invalid payment method' });
  if (groupId !== undefined && groupId !== null && !isUuid(groupId)) return res.status(400).json({ message: 'Invalid group' });

  const { data: student } = await supabase
    .from('users').select('id').eq('id', studentId).eq('role', 'Student').maybeSingle();
  if (!student) return res.status(404).json({ message: 'Student not found' });

  const { data, error } = await supabase
    .from('payments')
    .insert({ student_id: studentId, group_id: groupId ?? null, amount, period, method, note: cleanNote(note), created_by: req.user.id })
    .select(PAYMENT_COLUMNS)
    .single();
  if (error) return handleDbError(error, res);

  await notify(studentId, 'payment.received', { amount, period });
  await logAction(req.user.id, 'payment.create', 'payment', data.id, { studentId, amount, period });

  let paymentStatus = null;
  if (markPaid === true) {
    const result = await changePaymentStatus(studentId, 'active', req.user.id);
    paymentStatus = result.paymentStatus ?? null;
  }
  res.status(201).json({ payment: toPayment(data), paymentStatus });
};

// Tells every debtor about the debt. One reminder per student per month, however often it is pressed.
const remindDebtors = async (req, res) => {
  const month = tashkentNow().date.slice(0, 7);
  const { data, error } = await supabase
    .from('users').select('id').eq('role', 'Student').eq('payment_status', 'debtor');
  if (error) return handleDbError(error, res);

  await Promise.all(data.map((student) => notify(student.id, 'payment.debtor', {}, { dedupeKey: `payment.debtor:${student.id}:${month}` })));
  await logAction(req.user.id, 'payment.remind_debtors', 'user', null, { debtors: data.length });
  res.json({ debtors: data.length });
};

// Teachers for the salary form (the Financier cannot open the full people list).
const listTeachers = async (req, res) => {
  const { data, error } = await supabase
    .from('users').select('id, full_name').eq('role', 'Teacher').eq('status', 'active').order('full_name');
  if (error) return handleDbError(error, res);
  res.json({ teachers: data.map((t) => ({ id: t.id, fullName: t.full_name })) });
};

// Salaries paid to teachers. Filters: ?from ?to ?teacherId
const listSalaries = async (req, res) => {
  const range = readRange(req.query);
  if (!range) return res.status(400).json({ message: 'Invalid date range' });
  if (req.query.teacherId && !isUuid(req.query.teacherId)) return res.status(400).json({ message: 'Invalid teacher id' });

  let query = supabase.from('teacher_salaries').select(SALARY_COLUMNS).order('paid_at', { ascending: false }).limit(500);
  query = applyRange(query, range);
  if (req.query.teacherId) query = query.eq('teacher_id', req.query.teacherId);

  const { data, error } = await query;
  if (error) return handleDbError(error, res);
  res.json({ salaries: data.map(toSalary) });
};

const createSalary = async (req, res) => {
  const { teacherId, amount, period, note } = req.body;
  if (!isUuid(teacherId)) return res.status(400).json({ message: 'Choose a teacher' });
  if (!isPositiveInt(amount)) return res.status(400).json({ message: 'Amount must be a positive whole number' });
  if (!PERIOD_PATTERN.test(period || '')) return res.status(400).json({ message: 'Period must look like 2026-11' });

  const { data: teacher } = await supabase
    .from('users').select('id').eq('id', teacherId).eq('role', 'Teacher').maybeSingle();
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  const { data, error } = await supabase
    .from('teacher_salaries')
    .insert({ teacher_id: teacherId, amount, period, note: cleanNote(note), paid_by: req.user.id })
    .select(SALARY_COLUMNS)
    .single();
  if (error) return handleDbError(error, res);

  await notify(teacherId, 'salary.paid', { amount, period });
  await logAction(req.user.id, 'salary.create', 'salary', data.id, { teacherId, amount, period });
  res.status(201).json({ salary: toSalary(data) });
};

module.exports = {
  getOverview, listPayments, createPayment, remindDebtors, listTeachers, listSalaries, createSalary,
};
