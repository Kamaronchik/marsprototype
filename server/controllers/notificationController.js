const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { remindUnmarked } = require('../utils/attendance');
const { runRulesThrottled } = require('../utils/violations');

const toClient = (n) => ({
  id: n.id,
  type: n.type,
  data: n.data,
  link: n.link,
  isRead: n.is_read,
  createdAt: n.created_at,
});

// The bell: the newest notifications of the logged-in user and how many are unread.
const listNotifications = async (req, res) => {
  // The rules engine runs whenever somebody is online (at most once a minute), besides the timer.
  await runRulesThrottled();

  // A teacher gets the "you have not marked attendance" reminder when they open the bell.
  if (req.user.role === 'Teacher') {
    try {
      await remindUnmarked(req.user.id);
    } catch (error) {
      console.error('Reminder error:', error.message);
    }
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, data, link, is_read, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return handleDbError(error, res);

  const { count, error: countError } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .eq('is_read', false);
  if (countError) return handleDbError(countError, res);

  res.json({ notifications: data.map(toClient), unreadCount: count });
};

// The user's own notifications only: the user id in the filter comes from the session.
const markRead = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid notification id' });

  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', req.user.id)
    .select('id')
    .maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return res.status(404).json({ message: 'Notification not found' });

  res.json({ message: 'Done' });
};

const markAllRead = async (req, res) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', req.user.id)
    .eq('is_read', false);
  if (error) return handleDbError(error, res);

  res.json({ message: 'Done' });
};

// POST /api/notifications/push-token  { token, language }
// The browser agreed to get pushes: remember its Firebase token for the logged-in user.
// The same browser used by another person later moves to that person.
const savePushToken = async (req, res) => {
  const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
  const language = ['ru', 'uz', 'en'].includes(req.body.language) ? req.body.language : 'ru';
  if (token.length < 20 || token.length > 4096) return res.status(400).json({ message: 'Invalid push token' });

  const { error } = await supabase
    .from('push_tokens')
    .upsert({ token, user_id: req.user.id, language, updated_at: new Date().toISOString() }, { onConflict: 'token' });
  if (error) return handleDbError(error, res);
  res.json({ message: 'Done' });
};

// DELETE /api/notifications/push-token  { token }  (on logout: this browser stops getting pushes)
const deletePushToken = async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!token) return res.status(400).json({ message: 'Invalid push token' });

  const { error } = await supabase.from('push_tokens').delete().eq('token', token).eq('user_id', req.user.id);
  if (error) return handleDbError(error, res);
  res.json({ message: 'Done' });
};

module.exports = { listNotifications, markRead, markAllRead, savePushToken, deletePushToken };
