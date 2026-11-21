const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { notify } = require('../utils/notify');
const { findPendingLesson, saveRating } = require('../utils/ratings');
const { tashkentNow } = require('../utils/schedule');
const { sendRatingPrompt } = require('../utils/telegramAnnounce');

const ERRORS = {
  INVALID: [400, 'Score must be from 1 to 5'],
  NOT_FOUND: [404, 'Lesson not found'],
  ALREADY: [409, 'You already rated this lesson'],
  TOO_SOON: [429, 'You can rate a lesson once a week'],
};

// --- Student ------------------------------------------------------------------------

// "How were the lessons this week?": the lesson to rate, or null.
const getPending = async (req, res) => {
  try {
    res.json({ lesson: await findPendingLesson(req.user.id) });
  } catch (error) {
    handleDbError(error, res);
  }
};

const rateLesson = async (req, res) => {
  const { lessonId, score, comment } = req.body;
  if (!isUuid(lessonId)) return res.status(400).json({ message: 'Invalid lesson' });

  const result = await saveRating(req.user.id, lessonId, score, comment);
  if (result.error) {
    const [status, message] = ERRORS[result.error];
    return res.status(status).json({ message, code: result.error });
  }
  res.status(201).json({ message: 'Thank you' });
};

// --- Reading the answers ---------------------------------------------------------------
// Neither query selects student_id, so a name can never reach the browser.

const toAnswer = (r) => ({
  date: r.lesson.date,
  topic: r.lesson.topic,
  groupName: r.lesson.group?.name ?? null,
  score: r.score,
  comment: r.comment,
});

const RATING_COLUMNS = 'score, comment, created_at, lesson:lessons!inner(date, topic, group_id, teacher_id, group:groups!lessons_group_id_fkey(name))';

const summarize = (answers) => ({
  count: answers.length,
  average: answers.length ? Math.round((answers.reduce((sum, a) => sum + a.score, 0) / answers.length) * 10) / 10 : null,
});

// Teacher: answers about own lessons.
const listMine = async (req, res) => {
  const { data, error } = await supabase
    .from('lesson_ratings')
    .select(RATING_COLUMNS)
    .eq('lesson.teacher_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return handleDbError(error, res);

  const answers = data.map(toAnswer);
  res.json({ ...summarize(answers), answers });
};

// Academic manager and admin: answers of the whole school. Filters: ?groupId ?teacherId.
const listAll = async (req, res) => {
  const { groupId, teacherId } = req.query;
  if ((groupId && !isUuid(groupId)) || (teacherId && !isUuid(teacherId))) return res.status(400).json({ message: 'Invalid filter' });

  let query = supabase
    .from('lesson_ratings')
    .select(RATING_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(300);
  if (groupId) query = query.eq('lesson.group_id', groupId);
  if (teacherId) query = query.eq('lesson.teacher_id', teacherId);

  const { data, error } = await query;
  if (error) return handleDbError(error, res);

  const answers = data.map(toAnswer);
  res.json({ ...summarize(answers), answers });
};

// --- The weekly question -----------------------------------------------------------------

// Sends the weekly question to every active student who has a lesson to rate: a bell notification for all,
// and a Telegram message with the buttons 1-5 for students who connected the bot.
// Safe to press twice in a week: the notification has a key, and the question disappears once answered.
const sendPrompts = async (req, res) => {
  const { data: students, error } = await supabase
    .from('users').select('id').eq('role', 'Student').eq('status', 'active');
  if (error) return handleDbError(error, res);

  const week = tashkentNow().date.slice(0, 4) + '-' + Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  let sent = 0;
  for (const student of students) {
    const lesson = await findPendingLesson(student.id);
    if (!lesson) continue;
    await notify(student.id, 'lesson.rate', { topic: lesson.topic, groupName: lesson.groupName },
      { link: '/student', dedupeKey: `lesson.rate:${student.id}:${week}` });
    await sendRatingPrompt(student.id, lesson);
    sent += 1;
  }
  res.json({ sent });
};

module.exports = { getPending, rateLesson, listMine, listAll, sendPrompts };
