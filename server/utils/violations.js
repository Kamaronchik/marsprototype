const supabase = require('../config/supabase');
const { notify } = require('./notify');
const { logAction } = require('./audit');
const { sayTo, defaults } = require('./telegramBot');
const { DAY_CLOSE, toMinutes, tashkentNow } = require('./schedule');

// The rules engine. Rule ATT_LATE: a lesson started, but the teacher has not marked the attendance.
// Every run does three things:
//   1. finds lessons of today that are late and creates a violation for each one (once per group and day);
//   2. closes a violation by itself when the teacher has marked everybody;
//   3. tells the next person in the chain when nobody reacted in time.
// It is safe to run as often as you like: every step checks what was already done.

const ATT_LATE = 'ATT_LATE';
const OPEN_STATUSES = ['open', 'acknowledged', 'escalated'];
const ROLE_LINKS = { Teacher: '/teacher/attendance', AcademicManager: '/academic', Admin: '/admin/attendance', Owner: '/owner/violations' };

// The last level whose time has come, or -1. levels are sorted by afterMinutes.
const levelFor = (levels, elapsedMinutes) => {
  let found = -1;
  levels.forEach((level, index) => { if (level.afterMinutes <= elapsedMinutes) found = index; });
  return found;
};

// Minutes since the lesson started: works for today and for a lesson of a past day.
const minutesSinceStart = (date, startTime, now) => {
  const days = Math.round((Date.parse(`${now.date}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
  return days * 1440 + now.minutes - toMinutes(startTime);
};

// How many students of the group have no mark for the day (frozen students are on pause, they are not marked).
const countUnmarked = async (groupId, date) => {
  const [{ data: members }, { data: marks }] = await Promise.all([
    supabase.from('group_students')
      .select('student_id, joined_at, student:users!group_students_student_id_fkey(status)').eq('group_id', groupId),
    supabase.from('attendance').select('student_id').eq('group_id', groupId).eq('lesson_date', date),
  ]);
  const marked = new Set((marks ?? []).map((m) => m.student_id));
  return (members ?? [])
    .filter((m) => m.joined_at.slice(0, 10) <= date && m.student?.status !== 'frozen')
    .filter((m) => !marked.has(m.student_id)).length;
};

const addEvent = (violationId, kind, extra = {}) =>
  supabase.from('violation_events').insert({ violation_id: violationId, kind, ...extra });

// The people a level is meant for. "Teacher" means the person who broke the rule.
const recipientsOf = async (roles, violation) => {
  const ids = new Set();
  if (roles.includes('Teacher') && violation.user_id) ids.add(violation.user_id);
  const others = roles.filter((role) => role !== 'Teacher');
  if (others.length) {
    const { data } = await supabase.from('users').select('id').in('role', others).eq('status', 'active');
    (data ?? []).forEach((u) => ids.add(u.id));
  }
  return [...ids];
};

// One message in Telegram, when the person has connected it. A failed message never stops the engine.
const tellInTelegram = async (userId, key, values) => {
  try {
    const { data: link } = await supabase.from('telegram_links').select('user_id, chat_id, language').eq('user_id', userId).maybeSingle();
    if (!link) return false;
    await sayTo(defaults, link, key, values);
    return true;
  } catch (error) {
    console.error('Violation Telegram error:', error.message);
    return false;
  }
};

// Level 0 goes to the person who broke the rule (a reminder), the next levels are escalations.
const tellLevel = async (violation, levelIndex, rule, missing) => {
  const level = rule.levels[levelIndex];
  const escalated = levelIndex > 0;
  const info = { groupName: violation.details.groupName, teacherName: violation.details.teacherName, date: violation.subject_date, count: missing };
  const recipients = await recipientsOf(level.to, violation);

  for (const userId of recipients) {
    const { data: user } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
    await notify(
      userId,
      escalated ? 'violation.escalated' : 'violation.attendance',
      info,
      { link: ROLE_LINKS[user?.role] ?? null, dedupeKey: `violation:${violation.id}:${levelIndex}:${userId}` },
    );
    await addEvent(violation.id, escalated ? 'escalated' : 'notified', { level: levelIndex, recipient_id: userId, channel: 'bell' });

    const key = escalated ? 'violationEscalated' : 'violationAttendance';
    const sent = await tellInTelegram(userId, key, { group: info.groupName, teacher: info.teacherName, date: info.date, count: missing });
    if (sent) await addEvent(violation.id, escalated ? 'escalated' : 'notified', { level: levelIndex, recipient_id: userId, channel: 'telegram' });
  }
};

// Step 1: a violation for every lesson of today that is late and has unmarked students.
const findNewViolations = async (rule, now) => {
  const firstLevel = rule.levels[0]?.afterMinutes ?? 15;
  if (now.minutes >= DAY_CLOSE) return 0;

  const { data: groups } = await supabase
    .from('groups').select('id, name, teacher_id, start_time, weekdays, teacher:users!groups_teacher_id_fkey(full_name)')
    .eq('status', 'active').not('teacher_id', 'is', null);

  let created = 0;
  for (const group of (groups ?? []).filter((g) => g.weekdays.includes(now.weekday))) {
    if (minutesSinceStart(now.date, group.start_time, now) < firstLevel) continue;
    const key = `${ATT_LATE}:${group.id}:${now.date}`;

    const { data: existing } = await supabase.from('violations').select('id').eq('dedupe_key', key).maybeSingle();
    if (existing) continue;
    const missing = await countUnmarked(group.id, now.date);
    if (missing === 0) continue;

    const { data: violation, error } = await supabase.from('violations').insert({
      rule_code: ATT_LATE,
      dedupe_key: key,
      user_id: group.teacher_id,
      entity: 'group',
      entity_id: group.id,
      subject_date: now.date,
      details: { groupName: group.name, teacherName: group.teacher?.full_name ?? '', startTime: group.start_time.slice(0, 5) },
    }).select('id').single();
    if (error) continue; // another run created it a moment ago
    created += 1;
    await addEvent(violation.id, 'detected');
    await logAction(null, 'violation.open', 'violation', violation.id, { rule: ATT_LATE, groupName: group.name, date: now.date, missing });
  }
  return created;
};

// Steps 2 and 3 for every violation that is still open.
const followOpenViolations = async (rule, now) => {
  const { data: open } = await supabase.from('violations').select('*').eq('rule_code', ATT_LATE).in('status', OPEN_STATUSES);
  let resolved = 0;
  let escalated = 0;

  for (const violation of open ?? []) {
    const missing = await countUnmarked(violation.entity_id, violation.subject_date);

    if (missing === 0) {
      const seconds = Math.round((Date.now() - Date.parse(violation.detected_at)) / 1000);
      await supabase.from('violations')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), reaction_seconds: seconds, resolution_comment: null })
        .eq('id', violation.id);
      await addEvent(violation.id, 'resolved', { comment: 'auto' });
      await logAction(null, 'violation.resolve', 'violation', violation.id, { auto: true, reactionSeconds: seconds });
      resolved += 1;
      continue;
    }

    const due = levelFor(rule.levels, minutesSinceStart(violation.subject_date, violation.details.startTime, now));
    if (due <= violation.level) continue;

    // Written first: if the run is interrupted, nobody is told twice.
    const status = due > 0 && violation.status === 'open' ? 'escalated' : violation.status;
    await supabase.from('violations').update({ level: due, status }).eq('id', violation.id);
    await tellLevel(violation, due, rule, missing);
    if (due > 0) {
      escalated += 1;
      await logAction(null, 'violation.escalate', 'violation', violation.id, { level: due, to: rule.levels[due].to });
    }
  }
  return { resolved, escalated };
};

const runAttendanceRule = async (now = tashkentNow()) => {
  const { data: rule } = await supabase.from('audit_rules').select('*').eq('code', ATT_LATE).maybeSingle();
  if (!rule || !rule.enabled || !rule.levels?.length) return { created: 0, resolved: 0, escalated: 0 };

  const created = await findNewViolations(rule, now);
  const { resolved, escalated } = await followOpenViolations(rule, now);
  return { created, resolved, escalated };
};

// For the places that run the engine "when somebody is online" (the bell): at most once a minute.
let lastRun = 0;
const runRulesThrottled = async () => {
  if (Date.now() - lastRun < 60 * 1000) return;
  lastRun = Date.now();
  try {
    await runAttendanceRule();
  } catch (error) {
    console.error('Rules error:', error.message);
  }
};

module.exports = { levelFor, minutesSinceStart, runAttendanceRule, runRulesThrottled };
