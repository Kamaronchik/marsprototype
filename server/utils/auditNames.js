const supabase = require('../config/supabase');

// The names of the things the journal entries point to (a user, a group, a subject), in three queries at most.
const loadNames = async (rows) => {
  const idsOf = (entity) => [...new Set(rows.filter((r) => r.entity === entity && r.entity_id).map((r) => r.entity_id))];
  const [users, groups, subjects] = await Promise.all([
    idsOf('user').length ? supabase.from('users').select('id, full_name').in('id', idsOf('user')) : { data: [] },
    idsOf('group').length ? supabase.from('groups').select('id, name').in('id', idsOf('group')) : { data: [] },
    idsOf('subject').length ? supabase.from('subjects').select('id, name').in('id', idsOf('subject')) : { data: [] },
  ]);
  const names = new Map();
  (users.data ?? []).forEach((u) => names.set(u.id, u.full_name));
  (groups.data ?? []).forEach((g) => names.set(g.id, g.name));
  (subjects.data ?? []).forEach((s) => names.set(s.id, s.name));
  return names;
};

module.exports = { loadNames };
