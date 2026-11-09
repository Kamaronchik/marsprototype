const supabase = require('../config/supabase');
const { handleDbError, sendRpcError } = require('../utils/apiErrors');
const { isUuid, isPositiveInt } = require('../utils/validate');
const { notify } = require('../utils/notify');

const toClient = (t) => ({
  id: t.id,
  amount: t.amount,
  type: t.type,
  description: t.description,
  orderId: t.order_id,
  createdAt: t.created_at,
});

// The balance is read from the server every time; the browser can never set it.
const getWallet = async (req, res) => {
  const { data, error } = await supabase.rpc('get_wallet_balance', { p_student_id: req.user.id });
  if (error) return handleDbError(error, res);
  res.json({ balance: data });
};

const listTransactions = async (req, res) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, amount, type, description, order_id, created_at')
    .eq('student_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return handleDbError(error, res);
  res.json({ transactions: data.map(toClient) });
};

// Teacher (own students, out of their own pool) or Admin (no limit).
// No cap on how much one student can get: the pool itself is the only limit.
const awardCoins = async (req, res) => {
  const { studentId, amount, description } = req.body;
  if (!isUuid(studentId)) return res.status(400).json({ message: 'Student is required' });
  if (!isPositiveInt(amount)) return res.status(400).json({ message: 'Amount must be a positive whole number' });

  const note = typeof description === 'string' ? description.trim().slice(0, 200) : '';

  const { data, error } = await supabase.rpc('award_coins', {
    p_student_id: studentId,
    p_amount: amount,
    p_actor_id: req.user.id,
    p_description: note || null,
  });
  if (error) return handleDbError(error, res);
  if (!data.success) return sendRpcError(res, data);

  await notify(studentId, 'coins.awarded', { coins: amount, reason: note }, { link: '/student/coins' });
  res.json({ balance: data.balance, poolBalance: data.pool_balance });
};

const DEFAULT_COINS_PER_STUDENT = 50;

// Admin: what the monthly top-up would do, without changing anything.
const previewPoolTopup = async (req, res) => {
  const { data, error } = await supabase.rpc('preview_teacher_pool_topup', {
    p_coins_per_student: DEFAULT_COINS_PER_STUDENT,
  });
  if (error) return handleDbError(error, res);
  res.json({
    month: data.month,
    coinsPerStudent: data.coinsPerStudent,
    alreadyDone: data.alreadyDone,
    doneAt: data.doneAt,
    totalCoins: data.totalCoins,
    teachers: data.teachers.map((t) => ({ teacherId: t.teacherId, teacherName: t.teacherName, students: t.students, coins: t.coins })),
  });
};

// Admin: +50 coins per active student into every active teacher's pool. Once per month.
const runPoolTopup = async (req, res) => {
  const { data, error } = await supabase.rpc('top_up_teacher_pools', {
    p_admin_id: req.user.id,
    p_coins_per_student: DEFAULT_COINS_PER_STUDENT,
  });
  if (error) return handleDbError(error, res);
  if (!data.success) return sendRpcError(res, data);
  res.json({ month: data.month, teacherCount: data.teacherCount, totalCoins: data.totalCoins });
};

// How many coins the logged-in teacher can still hand out.
const getTeacherPool = async (req, res) => {
  const { data, error } = await supabase.rpc('get_teacher_balance', { p_teacher_id: req.user.id });
  if (error) return handleDbError(error, res);
  res.json({ balance: data });
};

// Admin: every teacher with the size of their pool.
const listTeacherPools = async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, teacher_wallets(balance)')
    .eq('role', 'Teacher')
    .eq('status', 'active')
    .order('full_name');
  if (error) return handleDbError(error, res);

  res.json({
    teachers: data.map((t) => ({
      id: t.id,
      fullName: t.full_name,
      email: t.email,
      balance: t.teacher_wallets?.balance ?? 0,
    })),
  });
};

// Admin gives coins to a teacher's pool.
const grantTeacherCoins = async (req, res) => {
  const { teacherId, amount } = req.body;
  if (!isUuid(teacherId)) return res.status(400).json({ message: 'Teacher is required' });
  if (!isPositiveInt(amount)) return res.status(400).json({ message: 'Amount must be a positive whole number' });

  const { data, error } = await supabase.rpc('grant_teacher_coins', {
    p_teacher_id: teacherId,
    p_amount: amount,
    p_admin_id: req.user.id,
  });
  if (error) return handleDbError(error, res);
  if (!data.success) return sendRpcError(res, data);

  await notify(teacherId, 'coins.granted', { coins: amount }, { link: '/teacher/coins' });
  res.json({ balance: data.pool_balance });
};

module.exports = {
  getWallet, listTransactions, awardCoins, getTeacherPool, listTeacherPools, grantTeacherCoins,
  previewPoolTopup, runPoolTopup,
};
