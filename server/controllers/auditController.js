const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { readRange, applyRange } = require('../utils/financeRange');

const { prefixesFor, hiddenFor, canSee, actorRolesFor } = require('../utils/auditAreas');

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// "group.*,schedule.*" for the database filter.
const prefixFilter = (prefixes) => prefixes.map((p) => `action.like.${p}*`).join(',');

// The names of the things the entries point to (a user, a group, a subject), in three queries at most.
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

// Filters: ?userId ?action ?from ?to ?page ?pageSize
const listAudit = async (req, res) => {
  const { userId, action } = req.query;
  const range = readRange(req.query);
  if (!range || (userId && !isUuid(userId)) || (action && !/^[a-z_]+(\.[a-z_]+)*$/.test(action))) {
    return res.status(400).json({ message: 'Invalid filter' });
  }
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(req.query.pageSize, 10) || PAGE_SIZE));
  const empty = { entries: [], page, pageSize, total: 0 };

  // Asking for an action the role may not see gives nothing, not an error that leaks its existence.
  if (action && !canSee(req.user.role, action)) return res.json(empty);

  let query = supabase
    .from('audit_log')
    .select('id, actor_id, action, entity, entity_id, details, created_at, actor:users!audit_log_actor_id_fkey(full_name, role)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const prefixes = prefixesFor(req.user.role);
  if (prefixes) query = query.or(prefixFilter(prefixes));
  hiddenFor(req.user.role).forEach((prefix) => { query = query.not('action', 'like', `${prefix}*`); });
  if (action) query = query.eq('action', action);
  if (userId) query = query.eq('actor_id', userId);
  query = applyRange(query, range, 'created_at');

  const { data, error, count } = await query;
  if (error) return handleDbError(error, res);

  const names = await loadNames(data);
  res.json({
    page,
    pageSize,
    total: count ?? 0,
    entries: data.map((row) => ({
      id: row.id,
      at: row.created_at,
      actor: row.actor ? { id: row.actor_id, name: row.actor.full_name, role: row.actor.role } : null,
      action: row.action,
      entity: row.entity,
      targetName: names.get(row.entity_id) ?? null,
      details: row.details ?? {},
    })),
  });
};

// The people who can appear in the journal, for the "user" filter.
const listAuditUsers = async (req, res) => {
  let query = supabase.from('users').select('id, full_name, role').order('full_name').limit(500);
  const roles = actorRolesFor(req.user.role);
  if (roles) query = query.in('role', roles);
  else query = query.neq('role', 'Student');
  if (req.user.role !== 'Owner') query = query.neq('role', 'Owner');

  const { data, error } = await query;
  if (error) return handleDbError(error, res);
  res.json({ users: data.map((u) => ({ id: u.id, fullName: u.full_name, role: u.role })) });
};

module.exports = { listAudit, listAuditUsers, loadNames };
