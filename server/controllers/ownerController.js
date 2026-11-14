const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { readRange, applyRange } = require('../utils/financeRange');
const { logAction } = require('../utils/audit');
const { runAttendanceRule } = require('../utils/violations');
const { loadNames } = require('./auditController');
const { tashkentNow } = require('../utils/schedule');

const MAX_PAGE_SIZE = 100;
const EXPORT_LIMIT = 5000;
const OPEN_STATUSES = ['open', 'acknowledged', 'escalated'];
const ACTION_PATTERN = /^[a-z_]+(\.[a-z_]*)*$/;
const ENTITY_PATTERN = /^[a-z_]+$/;
const STAFF_ROLES = ['Teacher', 'AcademicManager', 'Financier', 'Admin'];
const LEVEL_ROLES = ['Teacher', 'AcademicManager', 'Admin', 'Owner'];

const pageOf = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.pageSize, 10) || 25));
  return { page, pageSize };
};

// --- The journal -------------------------------------------------------------------

const LOG_COLUMNS = `id, actor_id, actor_role, action, entity, entity_id, details, old_value, new_value,
  reason_code, reason_comment, ip_address, user_agent, created_at,
  actor:users!audit_log_actor_id_fkey(full_name)`;

// Filters: ?userId ?role ?action ?entity ?entityId ?studentId ?ip ?from ?to
// action ending with a dot ("grade.") means "every action of this kind".
const buildLogQuery = (query, range, columns, options) => {
  const { userId, role, action, entity, entityId, studentId, ip } = query;
  let q = supabase.from('audit_log').select(columns, options).order('created_at', { ascending: false });
  if (userId) q = q.eq('actor_id', userId);
  if (role) q = q.eq('actor_role', role);
  if (action) q = action.endsWith('.') ? q.like('action', `${action}*`) : q.eq('action', action);
  if (entity) q = q.eq('entity', entity);
  if (entityId) q = q.eq('entity_id', entityId);
  if (studentId) q = q.or(`entity_id.eq.${studentId},details->>studentId.eq.${studentId}`);
  if (ip) q = q.eq('ip_address', ip);
  return applyRange(q, range, 'created_at');
};

// null when the filters are fine, otherwise the reason.
const checkLogFilters = (query) => {
  const { userId, action, entity, entityId, studentId, ip } = query;
  if ([userId, entityId, studentId].some((id) => id && !isUuid(id))) return 'Invalid filter';
  if (action && !ACTION_PATTERN.test(action)) return 'Invalid filter';
  if (entity && !ENTITY_PATTERN.test(entity)) return 'Invalid filter';
  if (ip && !/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return 'Invalid filter';
  return null;
};

const toEntry = (row, names) => ({
  id: row.id,
  at: row.created_at,
  actor: row.actor_id ? { id: row.actor_id, name: row.actor?.full_name ?? null, role: row.actor_role } : null,
  action: row.action,
  entity: row.entity,
  entityId: row.entity_id,
  targetName: names.get(row.entity_id) ?? null,
  details: row.details ?? {},
  oldValue: row.old_value,
  newValue: row.new_value,
  reasonCode: row.reason_code,
  reasonComment: row.reason_comment,
  ip: row.ip_address,
  userAgent: row.user_agent,
});

const listLog = async (req, res) => {
  const range = readRange(req.query);
  const problem = checkLogFilters(req.query);
  if (!range || problem) return res.status(400).json({ message: 'Invalid filter' });
  const { page, pageSize } = pageOf(req.query);

  const { data, error, count } = await buildLogQuery(req.query, range, LOG_COLUMNS, { count: 'exact' })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return handleDbError(error, res);

  const names = await loadNames(data);
  res.json({ page, pageSize, total: count ?? 0, entries: data.map((row) => toEntry(row, names)) });
};

// A cell that starts with = + - @ would be run as a formula by Excel.
const csvCell = (value) => {
  const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const exportLog = async (req, res) => {
  const range = readRange(req.query);
  const problem = checkLogFilters(req.query);
  if (!range || problem) return res.status(400).json({ message: 'Invalid filter' });

  const { data, error } = await buildLogQuery(req.query, range, LOG_COLUMNS).limit(EXPORT_LIMIT);
  if (error) return handleDbError(error, res);

  await logAction(req.user.id, 'owner.export', 'owner', null, { rows: data.length, filters: req.query });

  const header = ['time', 'who', 'role', 'action', 'entity', 'entity_id', 'old', 'new', 'reason', 'ip'];
  const lines = data.map((r) => [
    r.created_at, r.actor?.full_name, r.actor_role, r.action, r.entity, r.entity_id,
    r.old_value, r.new_value, [r.reason_code, r.reason_comment].filter(Boolean).join(': '), r.ip_address,
  ].map(csvCell).join(','));
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="audit-log.csv"');
  res.send(`﻿${[header.join(','), ...lines].join('\n')}`);
};

// Every change of one thing (a mark, a group, a person) from the first to the last.
const entityHistory = async (req, res) => {
  const { entity, id } = req.params;
  if (!ENTITY_PATTERN.test(entity) || !isUuid(id)) return res.status(400).json({ message: 'Invalid filter' });

  const { data, error } = await supabase
    .from('audit_log').select(LOG_COLUMNS).eq('entity', entity).eq('entity_id', id)
    .order('created_at', { ascending: true }).limit(500);
  if (error) return handleDbError(error, res);

  const names = await loadNames(data);
  res.json({ entity, id, entries: data.map((row) => toEntry(row, names)) });
};

// --- Overview ----------------------------------------------------------------------

const overview = async (req, res) => {
  // The rules also run here, so the owner never looks at stale numbers.
  try { await runAttendanceRule(); } catch (e) { console.error('Rules error:', e.message); }

  const dayStart = `${tashkentNow().date}T00:00:00+05:00`;
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [open, today, events, recent, resolved] = await Promise.all([
    supabase.from('violations').select('id', { count: 'exact', head: true }).in('status', OPEN_STATUSES),
    supabase.from('violations').select('id', { count: 'exact', head: true }).gte('detected_at', dayStart),
    supabase.from('audit_log').select('id', { count: 'exact', head: true }).gte('created_at', dayStart),
    supabase.from('violations').select('user_id').gte('detected_at', monthAgo).not('user_id', 'is', null),
    supabase.from('violations').select('reaction_seconds').eq('status', 'resolved').gte('detected_at', monthAgo).not('reaction_seconds', 'is', null),
  ]);
  const failed = [open, today, events, recent, resolved].find((r) => r.error);
  if (failed) return handleDbError(failed.error, res);

  const counts = new Map();
  recent.data.forEach((v) => counts.set(v.user_id, (counts.get(v.user_id) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const { data: people } = top.length
    ? await supabase.from('users').select('id, full_name, role').in('id', top.map(([id]) => id))
    : { data: [] };

  const seconds = resolved.data.map((v) => v.reaction_seconds);
  res.json({
    openViolations: open.count ?? 0,
    violationsToday: today.count ?? 0,
    actionsToday: events.count ?? 0,
    averageReactionMinutes: seconds.length ? Math.round(seconds.reduce((a, b) => a + b, 0) / seconds.length / 60) : null,
    topOffenders: top.map(([id, count]) => {
      const person = people.find((p) => p.id === id);
      return { id, name: person?.full_name ?? null, role: person?.role ?? null, count };
    }),
  });
};

// --- Violations --------------------------------------------------------------------

const VIOLATION_COLUMNS = `id, rule_code, user_id, entity_id, subject_date, details, status, level, detected_at, resolved_at,
  resolution_comment, reaction_seconds, user:users!violations_user_id_fkey(full_name, role), rule:audit_rules(title, severity)`;

const toViolation = (v) => ({
  id: v.id,
  ruleCode: v.rule_code,
  severity: v.rule?.severity ?? 'medium',
  person: v.user_id ? { id: v.user_id, name: v.user?.full_name ?? null, role: v.user?.role ?? null } : null,
  date: v.subject_date,
  details: v.details,
  status: v.status,
  level: v.level,
  detectedAt: v.detected_at,
  resolvedAt: v.resolved_at,
  comment: v.resolution_comment,
  reactionSeconds: v.reaction_seconds,
});

const STATUS_FILTERS = ['open', 'acknowledged', 'escalated', 'resolved', 'dismissed'];

// ?status=open|acknowledged|escalated|resolved|dismissed|active (active = not closed yet)
const listViolations = async (req, res) => {
  const { status, userId } = req.query;
  if ((status && status !== 'active' && !STATUS_FILTERS.includes(status)) || (userId && !isUuid(userId))) {
    return res.status(400).json({ message: 'Invalid filter' });
  }
  const { page, pageSize } = pageOf(req.query);

  let q = supabase.from('violations').select(VIOLATION_COLUMNS, { count: 'exact' })
    .order('detected_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (status === 'active') q = q.in('status', OPEN_STATUSES);
  else if (status) q = q.eq('status', status);
  if (userId) q = q.eq('user_id', userId);

  const { data, error, count } = await q;
  if (error) return handleDbError(error, res);
  res.json({ page, pageSize, total: count ?? 0, violations: data.map(toViolation) });
};

// One violation with its whole chain: found, told, escalated, closed.
const getViolation = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid violation' });

  const { data, error } = await supabase.from('violations').select(VIOLATION_COLUMNS).eq('id', id).maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return res.status(404).json({ message: 'Violation not found' });

  const { data: events } = await supabase
    .from('violation_events').select('id, kind, level, channel, comment, created_at, recipient:users!violation_events_recipient_id_fkey(full_name, role)')
    .eq('violation_id', id).order('created_at', { ascending: true });

  res.json({
    violation: toViolation(data),
    events: (events ?? []).map((e) => ({
      id: e.id, kind: e.kind, level: e.level, channel: e.channel, comment: e.comment, at: e.created_at,
      recipient: e.recipient ? { name: e.recipient.full_name, role: e.recipient.role } : null,
    })),
  });
};

const acknowledge = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid violation' });

  const { data, error } = await supabase.from('violations')
    .update({ status: 'acknowledged' }).eq('id', id).in('status', ['open', 'escalated']).select('id').maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return res.status(404).json({ message: 'Violation not found' });

  await supabase.from('violation_events').insert({ violation_id: id, kind: 'acknowledged', recipient_id: req.user.id });
  await logAction(req.user.id, 'violation.acknowledge', 'violation', id);
  res.json({ message: 'Done' });
};

// Closing by hand is possible only with a comment: "resolved" (it was fixed) or "dismissed" (a false alarm).
const closeViolation = async (req, res) => {
  const { id } = req.params;
  const { outcome } = req.body;
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid violation' });
  if (!['resolved', 'dismissed'].includes(outcome)) return res.status(400).json({ message: 'Invalid outcome' });
  if (comment.length < 3 || comment.length > 500) return res.status(400).json({ message: 'A comment is required (3 to 500 characters)' });

  const { data: before } = await supabase.from('violations').select('detected_at').eq('id', id).in('status', OPEN_STATUSES).maybeSingle();
  if (!before) return res.status(404).json({ message: 'Violation not found' });

  const seconds = Math.round((Date.now() - Date.parse(before.detected_at)) / 1000);
  const { error } = await supabase.from('violations').update({
    status: outcome, resolved_at: new Date().toISOString(), resolved_by: req.user.id, resolution_comment: comment, reaction_seconds: seconds,
  }).eq('id', id);
  if (error) return handleDbError(error, res);

  await supabase.from('violation_events').insert({ violation_id: id, kind: outcome, recipient_id: req.user.id, comment });
  await logAction(req.user.id, `violation.${outcome === 'resolved' ? 'resolve' : 'dismiss'}`, 'violation', id, { auto: false }, { reasonComment: comment });
  res.json({ message: 'Done' });
};

// --- Staff -------------------------------------------------------------------------

// Everybody who works at the school, with the number of violations of each.
const listStaff = async (req, res) => {
  const [{ data: people, error }, { data: violations }] = await Promise.all([
    supabase.from('users').select('id, full_name, role, status').in('role', STAFF_ROLES).order('full_name'),
    supabase.from('violations').select('user_id, status').not('user_id', 'is', null),
  ]);
  if (error) return handleDbError(error, res);

  res.json({
    staff: people.map((p) => {
      const mine = (violations ?? []).filter((v) => v.user_id === p.id);
      return {
        id: p.id, fullName: p.full_name, role: p.role, status: p.status,
        violations: mine.length, open: mine.filter((v) => OPEN_STATUSES.includes(v.status)).length,
      };
    }),
  });
};

// The profile of one person: the latest actions, violations, how fast they react, logins and devices.
const getStaff = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid user' });

  const { data: person, error } = await supabase.from('users').select('id, full_name, role, status, email').eq('id', id).maybeSingle();
  if (error) return handleDbError(error, res);
  if (!person || !STAFF_ROLES.includes(person.role)) return res.status(404).json({ message: 'User not found' });

  const [actions, violations, devices] = await Promise.all([
    supabase.from('audit_log').select(LOG_COLUMNS).eq('actor_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('violations').select(VIOLATION_COLUMNS).eq('user_id', id).order('detected_at', { ascending: false }).limit(50),
    supabase.from('audit_log').select('ip_address, user_agent, created_at').eq('actor_id', id).like('action', 'auth.login*')
      .order('created_at', { ascending: false }).limit(200),
  ]);
  const names = await loadNames(actions.data ?? []);
  const reactions = (violations.data ?? []).filter((v) => v.reaction_seconds != null).map((v) => v.reaction_seconds);

  // Devices: the different IP + browser pairs seen at sign-in, newest first.
  const seen = new Map();
  (devices.data ?? []).forEach((d) => {
    const key = `${d.ip_address}|${d.user_agent}`;
    if (!seen.has(key)) seen.set(key, { ip: d.ip_address, userAgent: d.user_agent, lastSeen: d.created_at });
  });

  res.json({
    person: { id: person.id, fullName: person.full_name, role: person.role, status: person.status },
    averageReactionMinutes: reactions.length ? Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length / 60) : null,
    actions: (actions.data ?? []).map((row) => toEntry(row, names)),
    violations: (violations.data ?? []).map(toViolation),
    devices: [...seen.values()].slice(0, 10),
  });
};

// --- Rules -------------------------------------------------------------------------

const toRule = (r) => ({ code: r.code, title: r.title, enabled: r.enabled, severity: r.severity, levels: r.levels, updatedAt: r.updated_at });

const listRules = async (req, res) => {
  const { data, error } = await supabase.from('audit_rules').select('*').order('code');
  if (error) return handleDbError(error, res);
  res.json({ rules: data.map(toRule) });
};

// null when the levels are fine: 1 to 5 steps, the time grows, every step has someone to tell.
const checkLevels = (levels) => {
  if (!Array.isArray(levels) || levels.length < 1 || levels.length > 5) return 'Invalid levels';
  let last = -1;
  for (const level of levels) {
    const minutes = level?.afterMinutes;
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080 || minutes <= last) return 'Invalid levels';
    if (!Array.isArray(level.to) || !level.to.length || level.to.some((role) => !LEVEL_ROLES.includes(role))) return 'Invalid levels';
    last = minutes;
  }
  return null;
};

const updateRule = async (req, res) => {
  const { code } = req.params;
  const { enabled, severity, levels } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ message: 'Invalid rule' });
  if (!['low', 'medium', 'high', 'critical'].includes(severity)) return res.status(400).json({ message: 'Invalid rule' });
  if (checkLevels(levels)) return res.status(400).json({ message: 'Invalid levels' });

  const { data: before } = await supabase.from('audit_rules').select('*').eq('code', code).maybeSingle();
  if (!before) return res.status(404).json({ message: 'Rule not found' });

  const clean = levels.map((l) => ({ afterMinutes: l.afterMinutes, to: [...new Set(l.to)] }));
  const { error } = await supabase.from('audit_rules')
    .update({ enabled, severity, levels: clean, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('code', code);
  if (error) return handleDbError(error, res);

  await logAction(req.user.id, 'rule.update', 'rule', null, { code }, {
    oldValue: { enabled: before.enabled, severity: before.severity, levels: before.levels },
    newValue: { enabled, severity, levels: clean },
  });
  res.json({ message: 'Done' });
};

// "Check now": runs the rules at once and tells what happened.
const runRules = async (req, res) => {
  const result = await runAttendanceRule();
  await logAction(req.user.id, 'owner.run_rules', 'owner', null, result);
  res.json(result);
};

// Every request of the owner to the panel is written to the journal: the owner is checked too.
const logOwnerView = async (req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/log/export')) {
    await logAction(req.user.id, 'owner.view', 'owner', null, { path: req.originalUrl.replace(/^\/api\/owner/, '').slice(0, 200) });
  }
  next();
};

module.exports = {
  listLog, exportLog, entityHistory, overview, listViolations, getViolation, acknowledge, closeViolation,
  listStaff, getStaff, listRules, updateRule, runRules, logOwnerView, checkLevels,
};
