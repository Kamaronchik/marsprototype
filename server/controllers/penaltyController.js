// Penalties: an auditor (or the CEO) gives a teacher a penalty for breaking a rule of Mars.
// A penalty is a violation with details.source = 'audit'. It goes to the CEO, who confirms it or cancels it.
// The auditor can also take back a penalty. Cancelling always needs a reason.
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { logAction } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { tashkentNow } = require('../utils/schedule');
const { MARS_RULES, findMarsRule } = require('../data/marsRules');

const MAX_AMOUNT = 100000000;

// The rules of Mars must be rows of audit_rules, because a violation points to its rule.
// Made once per server start; safe to repeat (existing rows are kept as they are).
let rulesReady = false;
const ensureMarsRules = async () => {
  if (rulesReady) return;
  const rows = MARS_RULES.map((rule) => ({
    code: rule.code,
    title: `Mars rule ${rule.number}`,
    severity: rule.severity,
    levels: [{ afterMinutes: 0, to: ['Owner'] }],
    fine_amount: 0,
  }));
  const { error } = await supabase.from('audit_rules').upsert(rows, { onConflict: 'code', ignoreDuplicates: true });
  if (error) throw error;
  rulesReady = true;
};

const activeOwners = async () => {
  const { data } = await supabase.from('users').select('id').eq('role', 'Owner').eq('status', 'active');
  return data ?? [];
};

// Tells every active CEO. The text is made by the frontend from the type and the data.
const tellOwners = async (type, data) => {
  const owners = await activeOwners();
  await Promise.all(owners.map((owner) => notify(owner.id, type, data, { link: '/owner/penalties' })));
};

// The list of rules for the form: number, level and code (the text is in the language files).
const listMarsRules = (req, res) => {
  res.json({ rules: MARS_RULES.map(({ code, number, level }) => ({ code, number, level })) });
};

// POST /api/owner/penalties  { userId, ruleCode, comment, amount }
const issuePenalty = async (req, res) => {
  const { userId, ruleCode } = req.body;
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
  const amount = req.body.amount === undefined || req.body.amount === null || req.body.amount === '' ? 0 : req.body.amount;

  if (!isUuid(userId)) return res.status(400).json({ message: 'Choose a teacher' });
  const rule = findMarsRule(ruleCode);
  if (!rule) return res.status(400).json({ message: 'Choose a rule' });
  if (comment.length < 3 || comment.length > 500) return res.status(400).json({ message: 'Describe what happened (3 to 500 characters)' });
  if (!Number.isInteger(amount) || amount < 0 || amount > MAX_AMOUNT) return res.status(400).json({ message: 'Invalid fine amount' });

  const { data: teacher, error: teacherError } = await supabase
    .from('users').select('id, full_name, role, status').eq('id', userId).maybeSingle();
  if (teacherError) return handleDbError(teacherError, res);
  if (!teacher || teacher.role !== 'Teacher') return res.status(404).json({ message: 'Teacher not found' });

  try {
    await ensureMarsRules();
  } catch (error) {
    return handleDbError(error, res);
  }

  const { data: me } = await supabase.from('users').select('full_name').eq('id', req.user.id).maybeSingle();
  const issuedByName = me?.full_name ?? null;

  const { data: violation, error } = await supabase.from('violations').insert({
    rule_code: rule.code,
    dedupe_key: `penalty:${crypto.randomUUID()}`,
    user_id: teacher.id,
    entity: 'user',
    entity_id: teacher.id,
    subject_date: tashkentNow().date,
    details: { source: 'audit', ruleNumber: rule.number, level: rule.level, comment, amount, issuedById: req.user.id, issuedByName },
    status: 'open',
    level: 0,
  }).select('id').single();
  if (error) return handleDbError(error, res);

  await supabase.from('violation_events').insert({ violation_id: violation.id, kind: 'detected', recipient_id: req.user.id, comment });

  if (amount > 0) {
    const { error: fineError } = await supabase.from('fines').insert({
      violation_id: violation.id, user_id: teacher.id, rule_code: rule.code, amount,
      details: { source: 'audit', ruleNumber: rule.number, level: rule.level, date: tashkentNow().date },
    });
    if (fineError) console.error('Fine error:', fineError.message);
  }

  // The CEO decides; the teacher learns which rule was broken.
  await tellOwners('penalty.issued', { teacherName: teacher.full_name, rule: rule.number, auditorName: issuedByName });
  await notify(teacher.id, 'penalty.received', { rule: rule.number }, { dedupeKey: `penalty-received:${violation.id}` });

  await logAction(req.user.id, 'penalty.issue', 'violation', violation.id,
    { rule: rule.number, level: rule.level, userId: teacher.id, amount }, { reasonComment: comment });
  res.status(201).json({ id: violation.id });
};

// Called after a penalty was cancelled by an auditor: the CEO and the teacher are told.
const afterCancel = async (violation, actor, comment) => {
  const details = violation.details ?? {};
  if (details.source !== 'audit') return;
  const { data: teacher } = await supabase.from('users').select('full_name').eq('id', violation.user_id).maybeSingle();
  if (actor.role === 'Auditor') {
    await tellOwners('penalty.cancelled', { teacherName: teacher?.full_name ?? '', rule: details.ruleNumber, reason: comment });
  }
  await notify(violation.user_id, 'penalty.removed', { rule: details.ruleNumber, reason: comment }, { dedupeKey: `penalty-removed:${violation.id}` });
};

module.exports = { listMarsRules, issuePenalty, afterCancel, ensureMarsRules };
