const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { logAction } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { announceText } = require('../utils/telegramAnnounce');
const { tashkentNow } = require('../utils/schedule');
const ai = require('../services/academicAi');

const TYPES = ['student', 'teacher', 'group'];
const MAX_MESSAGE = 1500;

const FLAG_TEXTS = {
  ru: { repeated: 'Одно и то же ДЗ дано несколько раз', missing: 'Урок без ДЗ', off_topic: 'ДЗ не по теме урока' },
  uz: { repeated: "Bir xil uy vazifasi bir necha marta berilgan", missing: 'Uy vazifasiz dars', off_topic: "Uy vazifasi dars mavzusiga mos emas" },
  en: { repeated: 'The same homework was given several times', missing: 'Lesson without homework', off_topic: 'Homework is not about the lesson topic' },
};

// The name of the target, used to replace {{NAME}} in a saved text.
const nameOf = async (type, id) => {
  const table = type === 'group' ? 'groups' : 'users';
  const column = type === 'group' ? 'name' : 'full_name';
  let query = supabase.from(table).select(column).eq('id', id);
  if (type === 'student') query = query.eq('role', 'Student');
  if (type === 'teacher') query = query.eq('role', 'Teacher');
  const { data } = await query.maybeSingle();
  return data ? data[column] : null;
};

const toClient = (report, name) => ({
  type: report.type,
  targetId: report.target_id,
  period: report.period,
  createdAt: report.created_at,
  text: ai.fillName(report.summary_text, name ?? ''),
});

const checkParams = (type, id) => TYPES.includes(type) && isUuid(id);

// The newest saved analysis of a target. Does not call the AI: the page opens fast and works without it.
const getReport = async (req, res) => {
  const { type, id } = req.params;
  if (!checkParams(type, id)) return res.status(400).json({ message: 'Invalid request' });

  const name = await nameOf(type, id);
  if (!name) return res.status(404).json({ message: 'Not found' });

  const { data, error } = await supabase
    .from('ai_reports').select('type, target_id, period, summary_text, created_at')
    .eq('type', type).eq('target_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return handleDbError(error, res);
  res.json({ report: data ? toClient(data, name) : null });
};

// The "Update analysis" button: the code counts, the AI explains, the result is saved for today.
const refreshReport = async (req, res) => {
  const { type, id } = req.params;
  const language = ai.LANGUAGES.includes(req.body.language) ? req.body.language : 'ru';
  if (!checkParams(type, id)) return res.status(400).json({ message: 'Invalid request' });

  const name = await nameOf(type, id);
  if (!name) return res.status(404).json({ message: 'Not found' });

  let text;
  try {
    if (type === 'student') text = await ai.summarizeStudent({ studentId: id, language });
    if (type === 'teacher') text = await ai.summarizeTeacher({ teacherId: id, language });
    if (type === 'group') {
      const result = await ai.summarizeGroup({ groupId: id, language });
      const labels = FLAG_TEXTS[language];
      const lines = result.flags.map((f) => `- ${labels[f.kind]}: ${f.title}`);
      text = lines.length ? `${result.summary}\n\n${lines.join('\n')}` : result.summary;
    }
  } catch (error) {
    // Gemini is down, slow or out of quota: the rest of the cabinet keeps working.
    console.error('Academic AI error:', error.message);
    return res.status(502).json({ message: 'The AI analysis is not available right now. Try again later.', code: 'AI_UNAVAILABLE' });
  }

  const { data, error } = await supabase
    .from('ai_reports')
    .upsert({ type, target_id: id, period: tashkentNow().date, summary_text: text, created_at: new Date().toISOString() }, { onConflict: 'type,target_id,period' })
    .select('type, target_id, period, summary_text, created_at')
    .single();
  if (error) return handleDbError(error, res);

  res.json({ report: toClient(data, name) });
};

// "Write with AI": a draft built from the saved analysis of the same target. Nothing is sent.
const makeDraft = async (req, res) => {
  const { type, targetId } = req.body;
  const language = ai.LANGUAGES.includes(req.body.language) ? req.body.language : 'ru';
  if (!checkParams(type, targetId)) return res.status(400).json({ message: 'Invalid request' });

  const name = await nameOf(type, targetId);
  if (!name) return res.status(404).json({ message: 'Not found' });

  const { data: report } = await supabase
    .from('ai_reports').select('summary_text').eq('type', type).eq('target_id', targetId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!report) return res.status(409).json({ message: 'Update the analysis first', code: 'NO_REPORT' });

  try {
    const draft = await ai.draftMessage({ type, reportText: report.summary_text, language });
    res.json({ draft: ai.fillName(draft, name) });
  } catch (error) {
    console.error('Academic AI error:', error.message);
    res.status(502).json({ message: 'The AI analysis is not available right now. Try again later.', code: 'AI_UNAVAILABLE' });
  }
};

// The people who get a message: the student, the teacher, or every active student of the group.
const recipients = async (type, targetId) => {
  if (type === 'group') {
    const { data } = await supabase
      .from('group_students').select('student:users!group_students_student_id_fkey(id, status)').eq('group_id', targetId);
    return (data ?? []).filter((m) => m.student?.status === 'active').map((m) => ({ id: m.student.id, isStudent: true }));
  }
  return [{ id: targetId, isStudent: type === 'student' }];
};

// A person pressed "Send": the text goes to the bell and, for students with the bot, to Telegram.
const sendMessage = async (req, res) => {
  const { type, targetId, text } = req.body;
  if (!checkParams(type, targetId)) return res.status(400).json({ message: 'Invalid request' });
  const message = typeof text === 'string' ? text.trim() : '';
  if (!message) return res.status(400).json({ message: 'Write the message' });
  if (message.length > MAX_MESSAGE) return res.status(400).json({ message: 'The message is too long' });
  if (!(await nameOf(type, targetId))) return res.status(404).json({ message: 'Not found' });

  const people = await recipients(type, targetId);
  let telegram = 0;
  for (const person of people) {
    await notify(person.id, 'academic.message', { text: message }, { link: person.isStudent ? '/student' : '/teacher' });
    if (person.isStudent && (await announceText(person.id, message))) telegram += 1;
  }

  await logAction(req.user.id, 'academic.message', type, targetId, { recipients: people.length });
  res.json({ sent: people.length, telegram });
};

module.exports = { getReport, refreshReport, makeDraft, sendMessage };
