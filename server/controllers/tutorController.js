const supabase = require('../config/supabase');
const { askGemini } = require('../services/gemini');
const { isUuid } = require('../utils/validate');
const { buildTutorPrompt } = require('../utils/tutorPrompt');

const LANGUAGES = ['ru', 'uz', 'en'];
const MAX_QUESTION = 2000;
const MAX_HISTORY = 12;

// Keeps only well-formed messages: the browser sends the conversation, so it cannot be trusted.
const cleanHistory = (history) => (Array.isArray(history) ? history : [])
  .filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim())
  .slice(-MAX_HISTORY)
  .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_QUESTION) }));

// The student asks the tutor. Nothing is stored on the server.
const ask = async (req, res) => {
  const { message, history, language, homeworkId } = req.body;
  const question = typeof message === 'string' ? message.trim() : '';
  if (!question) return res.status(400).json({ message: 'Write a question' });
  if (question.length > MAX_QUESTION) return res.status(400).json({ message: 'The question is too long' });

  const [{ data: student }, { data: memberships }] = await Promise.all([
    supabase.from('users').select('full_name').eq('id', req.user.id).maybeSingle(),
    supabase.from('group_students').select('group_id').eq('student_id', req.user.id),
  ]);

  // The student may attach a homework: the tutor then knows the task and gives hints, not the solution.
  let task = null;
  if (isUuid(homeworkId)) {
    const { data } = await supabase
      .from('homework').select('title, description, group_id').eq('id', homeworkId).eq('status', 'active').maybeSingle();
    if (data && (memberships ?? []).some((m) => m.group_id === data.group_id)) task = data;
  }

  const system = buildTutorPrompt({
    name: student?.full_name ?? '',
    language: LANGUAGES.includes(language) ? language : 'ru',
    task,
  });

  try {
    const answer = await askGemini({ system, history: cleanHistory(history), text: question, maxOutputTokens: 1000 });
    res.json({ answer });
  } catch (error) {
    console.error('Tutor error:', error.message);
    res.status(502).json({ message: 'The tutor is not available right now. Try again later.' });
  }
};

module.exports = { ask };
