const supabase = require('../config/supabase');

// Puts a notification in the user's bell. The frontend turns type + data into text in the user's language.
// dedupeKey makes the call safe to repeat: the same key is stored only once.
const notify = async (userId, type, data = {}, { link = null, dedupeKey = null } = {}) => {
  const { error } = await supabase
    .from('notifications')
    .upsert(
      { user_id: userId, type, data, link, dedupe_key: dedupeKey },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    );
  // A failed notification must never break the action that caused it.
  if (error) console.error('Notification error:', error.message);
};

// The same notification for every active admin ("a new order came in", "a student cancelled").
const notifyAdmins = async (type, data = {}, { link = null } = {}) => {
  const { data: admins, error } = await supabase
    .from('users').select('id').eq('role', 'Admin').eq('status', 'active');
  if (error) return console.error('Notification error:', error.message);
  await Promise.all(admins.map((admin) => notify(admin.id, type, data, { link })));
};

module.exports = { notify, notifyAdmins };
