const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { logAction } = require('../utils/audit');
const { isDate } = require('../utils/attendance');
const { tashkentNow } = require('../utils/schedule');

const CATEGORIES = ['rent', 'salaries', 'advertising', 'utilities', 'materials', 'other'];
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const COLUMNS = 'id, category, amount, expense_date, comment, created_at, creator:users!expenses_created_by_fkey(full_name)';

const toClient = (e) => ({
  id: e.id,
  category: e.category,
  amount: Number(e.amount),
  date: e.expense_date,
  comment: e.comment,
  createdBy: e.creator?.full_name ?? null,
  createdAt: e.created_at,
});

// The first and the last day of a 'YYYY-MM' month.
const monthRange = (month) => {
  const [year, number] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
};

// Reads the form. Returns { fields } or { problem }.
const readFields = (body, { partial }) => {
  const fields = {};
  if (!partial || body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) return { problem: 'Invalid expense category' };
    fields.category = body.category;
  }
  if (!partial || body.amount !== undefined) {
    if (!Number.isInteger(body.amount) || body.amount <= 0 || body.amount > 1000000000000) {
      return { problem: 'Amount must be a positive whole number' };
    }
    fields.amount = body.amount;
  }
  if (!partial || body.date !== undefined) {
    if (!isDate(body.date)) return { problem: 'Invalid date' };
    fields.expense_date = body.date;
  }
  if (body.comment !== undefined) {
    fields.comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 300) || null : null;
  }
  return { fields };
};

// Filters: ?month=2026-11  ?category=rent
const listExpenses = async (req, res) => {
  const { month, category } = req.query;
  if (month !== undefined && !MONTH_PATTERN.test(month)) return res.status(400).json({ message: 'Month must look like 2026-11' });
  if (category !== undefined && !CATEGORIES.includes(category)) return res.status(400).json({ message: 'Invalid expense category' });

  let query = supabase.from('expenses').select(COLUMNS)
    .order('expense_date', { ascending: false }).order('created_at', { ascending: false }).limit(500);
  if (month) {
    const { from, to } = monthRange(month);
    query = query.gte('expense_date', from).lte('expense_date', to);
  }
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) return handleDbError(error, res);
  const expenses = data.map(toClient);
  res.json({ expenses, total: expenses.reduce((sum, e) => sum + e.amount, 0) });
};

const createExpense = async (req, res) => {
  const body = { ...req.body, date: req.body.date ?? tashkentNow().date };
  const { fields, problem } = readFields(body, { partial: false });
  if (problem) return res.status(400).json({ message: problem });

  const { data, error } = await supabase
    .from('expenses').insert({ ...fields, created_by: req.user.id }).select(COLUMNS).single();
  if (error) return handleDbError(error, res);

  await logAction(req.user.id, 'expense.create', 'expense', data.id, { category: fields.category, amount: fields.amount, date: fields.expense_date });
  res.status(201).json({ expense: toClient(data) });
};

const updateExpense = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });
  const { fields, problem } = readFields(req.body, { partial: true });
  if (problem) return res.status(400).json({ message: problem });
  if (!Object.keys(fields).length) return res.status(400).json({ message: 'Nothing to update' });

  const { data: before } = await supabase.from('expenses').select('category, amount, expense_date').eq('id', id).maybeSingle();
  if (!before) return res.status(404).json({ message: 'Expense not found' });

  const { data, error } = await supabase.from('expenses').update(fields).eq('id', id).select(COLUMNS).maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return res.status(404).json({ message: 'Expense not found' });

  await logAction(req.user.id, 'expense.update', 'expense', id, {
    before: { category: before.category, amount: Number(before.amount), date: before.expense_date },
    after: fields,
  });
  res.json({ expense: toClient(data) });
};

const deleteExpense = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });

  const { data, error } = await supabase.from('expenses').delete().eq('id', id).select('category, amount, expense_date').maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return res.status(404).json({ message: 'Expense not found' });

  await logAction(req.user.id, 'expense.delete', 'expense', id, { category: data.category, amount: Number(data.amount), date: data.expense_date });
  res.json({ message: 'Expense deleted' });
};

module.exports = { CATEGORIES, listExpenses, createExpense, updateExpense, deleteExpense };
