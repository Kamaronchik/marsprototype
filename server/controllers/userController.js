const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { isUuid } = require('../utils/validate');
const { addStudentToGroup } = require('../utils/groups');

const ROLES = ['Admin', 'Teacher', 'Financier', 'Student'];
const STATUSES = ['active', 'blocked'];

// Never send password_hash to the browser.
const toClient = (u) => ({
  id: u.id,
  username: u.username,
  fullName: u.full_name,
  email: u.email,
  role: u.role,
  status: u.status,
  emailVerified: u.email_verified,
  createdAt: u.created_at,
});

const COLUMNS = 'id, username, full_name, email, role, status, email_verified, created_at';

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

const listUsers = async (req, res) => {
  const { data, error } = await supabase
    .from('users').select(COLUMNS).order('created_at', { ascending: false });
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

  if (groupId) {
    const result = await addStudentToGroup(groupId, data, req.user.id);
    if (result.error) return handleDbError(result.error, res);
  }
  res.status(201).json({ user: toClient(data) });
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, email, fullName, password, role, status } = req.body;

  const problem = validate({ username, email, fullName, password, role }, { partial: true });
  if (problem) return res.status(400).json({ message: problem });
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  // An admin must not lock themselves out.
  if (id === req.user.id && ((role && role !== 'Admin') || status === 'blocked')) {
    return res.status(400).json({ message: 'You cannot block or demote your own account' });
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

  const { data, error } = await supabase
    .from('users').update(updates).eq('id', id).select(COLUMNS).maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return res.status(404).json({ message: 'User not found' });

  // Blocked users lose all active sessions immediately.
  if (status === 'blocked') await supabase.from('sessions').delete().eq('user_id', id);

  res.json({ user: toClient(data) });
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete your own account' });
  }
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) return handleDbError(error, res);
  res.json({ message: 'User deleted' });
};

module.exports = { listUsers, createUser, updateUser, deleteUser };
