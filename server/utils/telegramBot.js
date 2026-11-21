const supabase = require('../config/supabase');
const { hashCode } = require('./codes');
const { notifyAdmins } = require('./notify');
const { loadStudentOverview } = require('./studentOverview');
const { buildSystemPrompt } = require('./aiContext');
const { LANGUAGES, LANGUAGE_NAMES, say, actionOfLabel, menuFor } = require('./botTexts');
const telegram = require('../services/telegram');
const { askGemini } = require('../services/gemini');
const { saveRating } = require('./ratings');

const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 30;
const HISTORY_MESSAGES = 6;
const REASON_MAX_LENGTH = 500;
const QUESTION_MAX_LENGTH = 1000;
const WEEKDAYS = {
  ru: ['', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'],
  uz: ['', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba', 'yakshanba'],
  en: ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

// The real services, replaceable in tests so nothing is sent to Telegram or Gemini.
const defaults = { send: telegram.sendMessage, answerCallback: telegram.answerCallback, ask: askGemini };

const logMessage = (userId, direction, kind, body) =>
  supabase.from('telegram_messages').insert({ user_id: userId, direction, kind, body });

// A message from the bot to a student: sent, then written to the log the admin reads.
const sayTo = async (deps, link, key, values, { kind = 'text', options } = {}) => {
  const text = say(link.language, key, values);
  await deps.send(link.chat_id, text, options);
  await logMessage(link.user_id, 'out', kind, text);
};

const languageButtons = () => [LANGUAGES.map((code) => ({ text: LANGUAGE_NAMES[code], data: `lang:${code}` }))];

const askLanguage = (deps, chatId, language) =>
  deps.send(chatId, say(language, 'chooseLanguage'), { inline: languageButtons() });

const notLinkedText = () => `${say('ru', 'notLinked')}\n\n${say('en', 'notLinked')}`;

// "/start <token>": the student pressed the link made on the site. The token is single-use and short-lived.
const linkAccount = async (deps, chatId, token) => {
  const { data: row } = await supabase
    .from('telegram_link_tokens')
    .select('token_hash, user_id, expires_at, used_at, user:users!telegram_link_tokens_user_id_fkey(full_name, role, status)')
    .eq('token_hash', hashCode(token))
    .maybeSingle();

  const valid = row && !row.used_at && new Date(row.expires_at) > new Date() && row.user?.role === 'Student' && row.user.status === 'active';
  if (!valid) return deps.send(chatId, `${say('ru', 'tokenInvalid')}\n${say('en', 'tokenInvalid')}`);

  const { data: taken } = await supabase.from('telegram_links').select('user_id').eq('chat_id', chatId).maybeSingle();
  if (taken && taken.user_id !== row.user_id) return deps.send(chatId, say('ru', 'chatTaken'));

  // A student can reconnect from another chat: the old link is replaced.
  await supabase.from('telegram_links').delete().eq('user_id', row.user_id);
  const { error } = await supabase.from('telegram_links').insert({ user_id: row.user_id, chat_id: chatId, language: 'ru' });
  if (error) return deps.send(chatId, say('ru', 'aiFailed'));
  await supabase.from('telegram_link_tokens').update({ used_at: new Date().toISOString() }).eq('token_hash', row.token_hash);

  await deps.send(chatId, say('ru', 'linked', { name: row.user.full_name }));
  await askLanguage(deps, chatId, 'ru');
};

const setLanguage = async (deps, link, language) => {
  await supabase.from('telegram_links').update({ language }).eq('user_id', link.user_id);
  const { data: user } = await supabase.from('users').select('full_name').eq('id', link.user_id).single();
  const updated = { ...link, language };
  await sayTo(deps, updated, 'welcome', { name: (user?.full_name ?? '').split(' ')[0] }, { options: { keyboard: menuFor(language) } });
};

const showCoins = async (deps, link) => {
  const { data, error } = await supabase.rpc('get_wallet_balance', { p_student_id: link.user_id });
  if (error) return sayTo(deps, link, 'aiFailed');
  return sayTo(deps, link, 'coins', { coins: data });
};

const showAttendance = async (deps, link) => {
  const { error, overview } = await loadStudentOverview(link.user_id);
  if (error) return sayTo(deps, link, 'aiFailed');
  const { total, present, percent } = overview.readiness;
  return total === 0 ? sayTo(deps, link, 'attendanceNone') : sayTo(deps, link, 'attendance', { present, total, percent });
};

const showNext = async (deps, link) => {
  const { error, overview } = await loadStudentOverview(link.user_id);
  if (error) return sayTo(deps, link, 'aiFailed');
  const next = overview.nextLaunch;
  if (!next) return sayTo(deps, link, 'nextNone');
  const day = next.dayOffset === 0
    ? say(link.language, 'today')
    : next.dayOffset === 1 ? say(link.language, 'tomorrow') : WEEKDAYS[link.language][next.weekday];
  return sayTo(deps, link, 'next', { group: next.groupName, when: `${day} ${next.startTime}`, room: next.room });
};

// The newest open "why were you absent?" question of this student, if there is one.
const openQuestion = async (studentId) => {
  const { data } = await supabase
    .from('telegram_absences')
    .select('id, attendance_id, attendance:attendance!telegram_absences_attendance_id_fkey(lesson_date, group:groups!attendance_group_id_fkey(name))')
    .eq('student_id', studentId)
    .eq('status', 'asked')
    .order('asked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
};

// The student answered the question: keep the reason and show it to the admins.
const saveReason = async (deps, link, question, text) => {
  const reason = text.slice(0, REASON_MAX_LENGTH);
  const now = new Date().toISOString();
  await supabase.from('telegram_absences').update({ status: 'answered', reason, answered_at: now }).eq('id', question.id);
  await supabase.from('attendance').update({ absence_reason: reason, reason_received_at: now }).eq('id', question.attendance_id);
  await logMessage(link.user_id, 'in', 'absence_reason', reason);
  const { data: user } = await supabase.from('users').select('full_name').eq('id', link.user_id).single();
  await notifyAdmins('telegram.reason', {
    studentName: user?.full_name ?? '',
    groupName: question.attendance?.group?.name ?? '',
    date: question.attendance?.lesson_date ?? '',
    reason,
  }, { link: '/admin/telegram' });
  await sayTo(deps, link, 'reasonSaved');
};

// A free question goes to the model, with this student's facts and the last messages as context.
const answerWithAi = async (deps, link, text) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('telegram_messages').select('id', { count: 'exact', head: true })
    .eq('user_id', link.user_id).eq('kind', 'ai').gte('created_at', since);
  if (count >= AI_DAILY_LIMIT) return sayTo(deps, link, 'aiLimit');

  const question = text.slice(0, QUESTION_MAX_LENGTH);
  const [overview, user, recent] = await Promise.all([
    loadStudentOverview(link.user_id),
    supabase.from('users').select('full_name').eq('id', link.user_id).single(),
    supabase.from('telegram_messages').select('direction, body').eq('user_id', link.user_id)
      .in('kind', ['text', 'ai']).order('created_at', { ascending: false }).limit(HISTORY_MESSAGES),
  ]);
  if (overview.error) return sayTo(deps, link, 'aiFailed');
  await logMessage(link.user_id, 'in', 'text', question);

  try {
    const history = (recent.data ?? []).reverse().map((m) => ({ role: m.direction === 'in' ? 'user' : 'model', text: m.body }));
    const answer = await deps.ask({
      system: buildSystemPrompt({ name: user.data?.full_name ?? '', language: link.language, overview: overview.overview }),
      history,
      text: question,
    });
    await deps.send(link.chat_id, answer);
    await logMessage(link.user_id, 'out', 'ai', answer);
  } catch (error) {
    console.error('AI answer error:', error.message);
    await sayTo(deps, link, 'aiFailed');
  }
};

const handleMessage = async (deps, message) => {
  const chatId = message.chat.id;
  if (message.chat.type !== 'private') return;
  const text = message.text?.trim();

  const { data: link } = await supabase.from('telegram_links').select('user_id, chat_id, language').eq('chat_id', chatId).maybeSingle();

  if (text?.startsWith('/start')) {
    const token = text.split(/\s+/)[1];
    if (token) return linkAccount(deps, chatId, token);
    return link ? setLanguage(deps, link, link.language) : deps.send(chatId, notLinkedText());
  }
  if (!link) return deps.send(chatId, notLinkedText());
  if (text === '/language') return askLanguage(deps, chatId, link.language);
  if (!text) return sayTo(deps, link, 'textOnly');

  const action = actionOfLabel(text);
  if (action === 'coins') return showCoins(deps, link);
  if (action === 'attendance') return showAttendance(deps, link);
  if (action === 'next') return showNext(deps, link);

  // The first free message after a "why were you absent?" question is the answer to it.
  const question = await openQuestion(link.user_id);
  return question ? saveReason(deps, link, question, text) : answerWithAi(deps, link, text);
};

// A pressed 1-5 button under the weekly question: "rate:<lessonId>:<score>".
const handleRating = async (deps, callback) => {
  const [, lessonId, score] = callback.data.split(':');
  const { data: link } = await supabase
    .from('telegram_links').select('user_id, chat_id, language').eq('chat_id', callback.message.chat.id).maybeSingle();
  if (!link) return;

  const result = await saveRating(link.user_id, lessonId, Number(score));
  const key = { INVALID: 'rateFailed', NOT_FOUND: 'rateFailed', ALREADY: 'rateAlready', TOO_SOON: 'rateTooSoon' }[result.error] ?? 'rateThanks';
  await sayTo(deps, link, key);
};

const handleCallback = async (deps, callback) => {
  await deps.answerCallback(callback.id).catch(() => {});
  if (callback.data?.startsWith('rate:')) return handleRating(deps, callback);
  const language = callback.data?.startsWith('lang:') ? callback.data.slice(5) : null;
  if (!LANGUAGES.includes(language)) return;
  const { data: link } = await supabase
    .from('telegram_links').select('user_id, chat_id, language').eq('chat_id', callback.message.chat.id).maybeSingle();
  if (link) await setLanguage(deps, link, language);
};

// One update from Telegram (a message or a pressed button). Never throws: one bad message must not stop the bot.
// overrides replaces the real send / answerCallback / ask, used by the tests.
const handleUpdate = async (update, overrides = {}) => {
  const deps = { ...defaults, ...overrides };
  try {
    if (update.message) await handleMessage(deps, update.message);
    else if (update.callback_query) await handleCallback(deps, update.callback_query);
  } catch (error) {
    console.error('Telegram update error:', error.message);
  }
};

module.exports = { handleUpdate, sayTo, logMessage, defaults };
