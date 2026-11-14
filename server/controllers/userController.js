const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const db = require('../databaseService');
const { isUuid } = require('../utils/validate');
const { addStudentToGroup } = require('../utils/groups');
const { topUp } = require('../utils/balance');
const { logAction } = require('../utils/audit');
const { announceToStudent } = require('../utils/telegramAnnounce');

const ROLES = ['Admin', 'Teacher', 'Financier', 'Student', 'AcademicManager'];
const STATUSES = ['active', 'blocked', 'frozen'];

// Never send password_hash to the browser.
const toClient = (u) => ({
  id: u.id,
  username: u.username,
  fullName: u.full_name,
  email: u.email,
  role: u.role,
  status: u.status,
  balance: Number(u.balance ?? 0),
  emailVerified: u.email_verified,
  createdAt: u.created_at,
});

const COLUMNS = 'id, username, full_name, email, role, status, balance, email_verified, created_at';

const validate = ({ username, email, fullName, password, role }, { partial }) => {
  if (!partial || username !== undefined) {
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username || '')) return 'Username: 3-30 chars (letters, digits . _ -)';
  }
  // Email is required for every role except Admin.
  const emailGiven = !!(email && email.trim());
  if (emailGiven && !/^\S+@\S+\.\S+$/.test(email.trim())) return 'Invalid email';
  if (!partial && !emailGiven && role !== 'Admin') return 'Email is required';
  if (!partial || fullName !== undefined) {
    if (!fullName || !fullName.trim()) return 'Full name is required';
  }
  if (!partial || password !== undefined) {
    if (!password || password.length < 8) return 'Password must be at least 8 characters';
  }
  if (!partial || role !== undefined) {
    if (!ROLES.includes(role)) return 'Invalid role';
  }
  return null;
};

const handleDbError = (error, res) => {
  if (error.code === '23505') {
    return res.status(409).json({ message: 'Username already exists' });
  }
  // Orders and coin transactions are never deleted: such a user can only be blocked.
  if (error.code === '23503') {
    return res.status(409).json({ message: 'This user has shop history and cannot be deleted. Block the account instead.' });
  }
  console.error('User API error:', error);
  return res.status(500).json({ message: 'Database error' });
};

// The Owner checks the Admin, so the Admin cannot see, change or delete an Owner account.
// An Owner is created only from the command line: npm run create-owner.
const isOwnerAccount = async (id) => {
  const { data } = await supabase.from('users').select('role').eq('id', id).maybeSingle();
  return data?.role === 'Owner';
};

const listUsers = async (req, res) => {
  const { data, error } = await supabase
    .from('users').select(COLUMNS).neq('role', 'Owner').order('created_at', { ascending: false });
  if (error) return handleDbError(error, res);
  res.json({ users: data.map(toClient) });
};

const createUser = async (req, res) => {
  const { username, email, fullName, password, role, groupId } = req.body;
  const problem = validate({ username, email, fullName, password, role }, { partial: false });
  if (problem) return res.status(400).json({ message: problem });

  // A new student can be placed into an existing group right away.
  if (groupId !== undefined && groupId !== null && groupId !== '') {
    if (role !== 'Student') return res.status(400).json({ message: 'Only a student can be placed in a group' });
    if (!isUuid(groupId)) return res.status(400).json({ message: 'Invalid group' });
    const { data: group } = await supabase
      .from('groups').select('id').eq('id', groupId).eq('status', 'active').maybeSingle();
    if (!group) return res.status(400).json({ message: 'Group not found' });
  }

  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase
    .from('users')
    .insert({
      username: username.trim(),
      email: email && email.trim() ? email.trim().toLowerCase() : null,
      full_name: fullName.trim(),
      password_hash,
      role,
      status: 'active',
      email_verified: false, // becomes true after the user enters the code sent to this email
    })
    .select(COLUMNS)
    .single();
  if (error) return handleDbError(error, res);

  await logAction(req.user.id, 'user.create', 'user', data.id, { role: data.role });
  if (groupId) {
    const result = await addStudentToGroup(groupId, data, req.user.id);
    if (result.error) return handleDbError(result.error, res);
  }
  res.status(201).json({ user: toClient(data) });
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, email, fullName, password, role, status } = req.body;
  if (await isOwnerAccount(id)) return res.status(404).json({ message: 'User not found' });

  const problem = validate({ username, email, fullName, password, role }, { partial: true });
  if (problem) return res.status(400).json({ message: problem });
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  // An admin must not lock themselves out.
  if (id === req.user.id && ((role && role !== 'Admin') || status === 'blocked' || status === 'frozen')) {
    return res.status(400).json({ message: 'You cannot block or demote your own account' });
  }
  // Only a student can be frozen (a pause of lessons and payments).
  if (status === 'frozen') {
    const { data: target } = await supabase.from('users').select('role').eq('id', id).maybeSingle();
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.role !== 'Student') return res.status(400).json({ message: 'Only a student can be frozen' });
  }

  const updates = {};
  if (username !== undefined) updates.username = username.trim();
  if (email !== undefined) {
    updates.email = email.trim() ? email.trim().toLowerCase() : null;
    updates.email_verified = false; // new address must be confirmed again
  }
  if (fullName !== undefined) updates.full_name = fullName.trim();
  if (role !== undefined) updates.role = role;
  if (status !== undefined) updates.status = status;
  if (password) updates.password_hash = await bcrypt.hash(password, 12);
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'Nothing to update' });

  // Only Admin may have no email: check the final state.
  if (updates.email !== undefined || updates.role !== undefined) {
    const { data: current } = await supabase.from('users').select('email, role').eq('id', id).maybeSingle();
    if (!current) return res.status(404).json({ message: 'User not found' });
    const finalEmail = updates.email !== undefined ? updates.email : current.email;
    const finalRole = updates.role !== undefined ? updates.role : current.role;
    if (!finalEmail && finalRole !== 'Admin') {
      return res.status(400).json({ message: 'Email is required for this role' });
    }
  }

  // What the account was before the change (for the journal and for the Telegram notice).
  const { data: before } = await supabase.from('users').select('role, status').eq('id', id).maybeSingle();
  const previousStatus = before?.status ?? null;

  const { data, error } = await supabase
    .from('users').update(updates).eq('id', id).select(COLUMNS).maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return res.status(404).json({ message: 'User not found' });

  // Roles, blocking and password changes are the most sensitive actions: they are always in the journal.
  if (role !== undefined && role !== before?.role) await logAction(req.user.id, 'user.role_change', 'user', id, { from: before?.role, to: role });
  if (status !== undefined && status !== previousStatus) await logAction(req.user.id, 'user.status_change', 'user', id, { from: previousStatus, to: status });
  if (password) await logAction(req.user.id, 'user.password_change', 'user', id);
  if (fullName !== undefined || email !== undefined || username !== undefined) await logAction(req.user.id, 'user.update', 'user', id);

  // Blocked and frozen users lose all active sessions immediately.
  if (status === 'blocked' || status === 'frozen') await supabase.from('sessions').delete().eq('user_id', id);
  // Role or status changed: forget the cached sessions (after the delete) so the new rights apply at once.
  if (role !== undefined || status !== undefined) db.clearSessionCache();

  // Tell the student in Telegram when the account is frozen or unfrozen.
  if (status === 'frozen' && previousStatus !== 'frozen') await announceToStudent(id, 'accountFrozen');
  if (status === 'active' && previousStatus === 'frozen') await announceToStudent(id, 'accountUnfrozen');

  res.json({ user: toClient(data) });
};

// Admin puts money on a student's balance.
const topUpBalance = async (req, res) => {
  const { id } = req.params;
  const amount = Number(req.body.amount);
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid student' });
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1000000000) {
    return res.status(400).json({ message: 'Amount must be a positive whole number' });
  }
  const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 200) : '';

  const { data: student } = await supabase.from('users').select('id, role').eq('id', id).maybeSingle();
  if (!student || student.role !== 'Student') return res.status(404).json({ message: 'Student not found' });

  try {
    const balance = await topUp(id, amount, note || null, req.user.id);
    await logAction(req.user.id, 'balance.topup', 'user', id, { amount });
    await announceToStudent(id, 'balanceTopUp', { amount: amount.toLocaleString('ru-RU'), balance: Number(balance).toLocaleString('ru-RU') });
    res.json({ balance: Number(balance) });
  } catch (error) {
    handleDbError(error, res);
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete your own account' });
  }
  if (await isOwnerAccount(id)) return res.status(404).json({ message: 'User not found' });
  const { data: removed } = await supabase.from('users').select('full_name, role').eq('id', id).maybeSingle();
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) return handleDbError(error, res);
  await logAction(req.user.id, 'user.delete', 'user', id, { name: removed?.full_name ?? null, role: removed?.role ?? null });
  db.clearSessionCache();
  res.json({ message: 'User deleted' });
};

module.exports = { listUsers, createUser, updateUser, deleteUser, topUpBalance };
