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

module.exports = { notify };
