const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { tashkentNow } = require('../utils/schedule');
const { readRange, applyRange, applyDateRange } = require('../utils/financeRange');
const { CATEGORIES } = require('./expenseController');

const sum = (rows) => rows.reduce((total, row) => total + Number(row.amount), 0);

// The financial report of a period: ?from=2026-11-01&to=2026-11-30 (default: today).
// Income, expenses by category, teacher salaries, profit, debtors and active students.
const getReport = async (req, res) => {
  const today = tashkentNow().date;
  const from = req.query.from ?? today;
  const range = readRange({ from, to: req.query.to ?? from });
  if (!range) return res.status(400).json({ message: 'Invalid date range' });

  const [payments, expenses, salaries, debtors, students] = await Promise.all([
    applyRange(supabase.from('payments').select('amount'), range),
    applyDateRange(supabase.from('expenses').select('category, amount'), range, 'expense_date'),
    applyRange(supabase.from('teacher_salaries').select('amount'), range),
    supabase.from('users').select('id, full_name').eq('role', 'Student').eq('payment_status', 'debtor').order('full_name').limit(200),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'Student').eq('status', 'active'),
  ]);
  const failed = [payments, expenses, salaries, debtors, students].find((r) => r.error);
  if (failed) return handleDbError(failed.error, res);

  const income = sum(payments.data);
  const expensesTotal = sum(expenses.data);
  const salariesTotal = sum(salaries.data);

  res.json({
    from: range.from,
    to: range.to,
    income,
    expenses: {
      total: expensesTotal,
      byCategory: CATEGORIES.map((category) => ({ category, amount: sum(expenses.data.filter((e) => e.category === category)) })),
    },
    salaries: salariesTotal,
    profit: income - expensesTotal - salariesTotal,
    debtors: { count: debtors.data.length, students: debtors.data.map((d) => ({ id: d.id, fullName: d.full_name })) },
    activeStudents: students.count,
  });
};

module.exports = { getReport };
