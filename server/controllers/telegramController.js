const crypto = require('crypto');
const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { hashCode } = require('../utils/codes');
const { isUuid } = require('../utils/validate');
const { handleUpdate, sayTo, defaults } = require('../utils/telegramBot');

const TOKEN_MINUTES = 10;
const MESSAGES_LIMIT = 200;
const LIST_LIMIT = 100;

const botName = () => process.env.TELEGRAM_BOT_USERNAME || 'MarsBotReplier_bot';

// --- the student's side -------------------------------------------------------

// The student presses "Connect Telegram": a one-time link to the bot is made. Only its hash is stored.
const createLink = async (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_MINUTES * 60 * 1000).toISOString();

  // Older links that were never used are dropped, so only the newest one works.
  await supabase.from('telegram_link_tokens').delete().eq('user_id', req.user.id).is('used_at', null);
  const { error } = await supabase
    .from('telegram_link_tokens').insert({ token_hash: hashCode(token), user_id: req.user.id, expires_at: expiresAt });
  if (error) return handleDbError(error, res);

  res.status(201).json({ url: `https://t.me/${botName()}?start=${token}`, expiresAt });
};

const getStatus = async (req, res) => {
  const { data, error } = await supabase
    .from('telegram_links').select('language, linked_at').eq('user_id', req.user.id).maybeSingle();
  if (error) return handleDbError(error, res);
  res.json({ linked: Boolean(data), language: data?.language ?? null, linkedAt: data?.linked_at ?? null, botName: botName() });
};

const unlink = async (req, res) => {
  const { data: link, error } = await supabase
    .from('telegram_links').select('user_id, chat_id, language').eq('user_id', req.user.id).maybeSingle();
  if (error) return handleDbError(error, res);
  if (!link) return res.json({ linked: false });

  const { error: deleteError } = await supabase.from('telegram_links').delete().eq('user_id', req.user.id);
  if (deleteError) return handleDbError(deleteError, res);
  // The goodbye message is a courtesy: if Telegram does not answer, the account is unlinked anyway.
  await sayTo(defaults, link, 'unlinked').catch((e) => console.error('Telegram error:', e.message));
  res.json({ linked: false });
};

// --- Telegram's side ----------------------------------------------------------

const sameSecret = (given, expected) => {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(String(expected ?? ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Telegram calls this for every message. The secret header proves the call is really from Telegram.
// It is answered with 200 once handled: Telegram would otherwise keep re-sending the same update.
const webhook = async (req, res) => {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !sameSecret(req.get('x-telegram-bot-api-secret-token'), expected)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  await handleUpdate(req.body ?? {});
  res.json({ ok: true });
};

// --- the admin's Telegram tab ---------------------------------------------------

// Who is connected, the latest "why were you absent?" answers and unanswered questions.
const getOverview = async (req, res) => {
  const [links, absences] = await Promise.all([
    supabase
      .from('telegram_links')
      .select('user_id, language, linked_at, student:users!telegram_links_user_id_fkey(full_name, email)')
      .order('linked_at', { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from('telegram_absences')
      .select('id, status, reason, asked_at, answered_at, student:users!telegram_absences_student_id_fkey(id, full_name), attendance:attendance!telegram_absences_attendance_id_fkey(lesson_date, group:groups!attendance_group_id_fkey(name))')
      .neq('status', 'cancelled')
      .order('asked_at', { ascending: false })
      .limit(LIST_LIMIT),
  ]);
  const failed = [links, absences].find((r) => r.error);
  if (failed) return handleDbError(failed.error, res);

  res.json({
    chats: links.data.map((l) => ({
      userId: l.user_id,
      name: l.student?.full_name ?? '',
      email: l.student?.email ?? '',
      language: l.language,
      linkedAt: l.linked_at,
    })),
    absences: absences.data.map((a) => ({
      id: a.id,
      status: a.status,
      reason: a.reason,
      askedAt: a.asked_at,
      answeredAt: a.answered_at,
      studentId: a.student?.id ?? null,
      studentName: a.student?.full_name ?? '',
      groupName: a.attendance?.group?.name ?? '',
      date: a.attendance?.lesson_date ?? '',
    })),
  });
};

// The whole conversation of one student with the bot, oldest first.
const getChat = async (req, res) => {
  const { userId } = req.params;
  if (!isUuid(userId)) return res.status(400).json({ message: 'Invalid student' });

  const { data, error } = await supabase
    .from('telegram_messages')
    .select('id, direction, kind, body, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_LIMIT);
  if (error) return handleDbError(error, res);

  res.json({
    messages: data.reverse().map((m) => ({ id: m.id, direction: m.direction, kind: m.kind, body: m.body, createdAt: m.created_at })),
  });
};

module.exports = { createLink, getStatus, unlink, webhook, getOverview, getChat };
