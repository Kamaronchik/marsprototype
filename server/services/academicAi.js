const { askGemini } = require('./gemini');
const { studentFacts, groupFacts, teacherStats } = require('../utils/academicStats');

// The AI of the academic manager. The code counts everything (utils/academicStats.js); the AI only
// explains the numbers and writes texts. Rules kept here:
//   - No names, phones or emails go to Gemini: only ids, numbers, topics and the text of reviews.
//     The text says {{NAME}}, and the server puts the real name in after the answer (see fillName).
//   - The AI never sends anything: it writes a draft, a person sends it.

const LANGUAGE_NAMES = { ru: 'Russian', uz: 'Uzbek (Latin script)', en: 'English' };
const LANGUAGES = Object.keys(LANGUAGE_NAMES);
const NAME_MARK = '{{NAME}}';

const rules = (language) => [
  `Write the answer in ${LANGUAGE_NAMES[language] ?? 'Russian'}. Plain text, no markdown.`,
  `Refer to the person or group only as ${NAME_MARK}. Never invent a name, phone number or email.`,
  'Use only the facts given. Never invent numbers, dates or grades. If a fact is missing, say so.',
].join(' ');

// The real name goes in after the answer came back.
const fillName = (text, name) => text.split(NAME_MARK).join(name);

// 2-3 sentences about what the student should improve, then 3 exercises on the recent topics.
const summarizeStudent = async ({ studentId, language, ask = askGemini }) => {
  const facts = await studentFacts(studentId);
  const system = [
    'You help an academic manager of a programming school (HTML, CSS, JavaScript, React).',
    rules(language),
    `Write 2-3 sentences: what ${NAME_MARK} should improve. Then give exactly 3 short practice exercises on the recent lesson topics.`,
  ].join('\n');
  const text = [
    `Student id: ${studentId}`,
    `Last 30 days: ${facts.present30} lessons on time, ${facts.late30} late, ${facts.absences30} missed.`,
    `Latest marks (percent): ${facts.grades.map((g) => `${g.title} (${g.kind}) ${g.percent}%`).join('; ') || 'none'}`,
    `Recent lesson topics: ${facts.recentTopics.join('; ') || 'none'}`,
  ].join('\n');
  return ask({ system, text, maxOutputTokens: 800 });
};

// The strong and weak sides of a teacher from the numbers and the anonymous comments.
const summarizeTeacher = async ({ teacherId, language, ask = askGemini }) => {
  const stats = (await teacherStats()).find((t) => t.teacherId === teacherId);
  if (!stats) throw new Error('Teacher not found');
  const system = [
    'You help an academic manager of a programming school.',
    rules(language),
    `Summarize the strong and the weak sides of ${NAME_MARK}'s lessons in two short lists. Be fair and specific. Do not judge the person, only the lessons.`,
    'The reviews are anonymous students\' words: never guess who wrote them.',
  ].join('\n');
  const text = [
    `Teacher id: ${teacherId}`,
    `Average lesson rating: ${stats.averageRating ?? 'no ratings'} of 5 (${stats.ratingCount} ratings)`,
    `Checked homework: ${stats.checkedHomeworkPercent ?? 'n/a'}%`,
    `Lessons in the last 30 days without a topic: ${stats.lessonsWithoutTopic}`,
    `Reviews: ${stats.reviews.map((r) => `${r.score}/5 "${r.comment}" (topic ${r.topic})`).join('; ') || 'none'}`,
  ].join('\n');
  return ask({ system, text, maxOutputTokens: 800 });
};

// Homework flags. Two of them are plain counting (done here, no AI): the same homework given several times,
// and a lesson without homework. The AI only looks for homework clearly NOT about the lesson topic.
// Returns [{ kind: 'repeated' | 'missing' | 'off_topic', title, date }].
const checkHomework = async ({ groupId, ask = askGemini }) => {
  const { lessons, homework } = await groupFacts(groupId);
  const flags = [];

  const seen = {};
  for (const h of homework) {
    const key = h.title.trim().toLowerCase();
    seen[key] = (seen[key] ?? 0) + 1;
  }
  for (const [title, count] of Object.entries(seen)) {
    if (count > 1) flags.push({ kind: 'repeated', title, count });
  }

  const withHomework = new Set(homework.map((h) => h.lesson_id).filter(Boolean));
  for (const lesson of lessons) {
    if (!withHomework.has(lesson.id)) flags.push({ kind: 'missing', title: lesson.topic, date: lesson.date });
  }

  const pairs = homework
    .filter((h) => h.lesson_id)
    .map((h) => ({ homework: h.title, topic: lessons.find((l) => l.id === h.lesson_id)?.topic }))
    .filter((p) => p.topic);
  if (pairs.length) {
    const answer = await ask({
      system: 'You check school homework. Reply with a JSON array of the numbers of homeworks that are CLEARLY not about the lesson topic. Reply [] when unsure. Nothing else.',
      text: pairs.map((p, i) => `${i}. lesson topic: ${p.topic} | homework: ${p.homework}`).join('\n'),
      maxOutputTokens: 200,
    });
    try {
      const numbers = JSON.parse(answer.replace(/```(json)?/g, '').trim());
      for (const n of Array.isArray(numbers) ? numbers : []) {
        if (pairs[n]) flags.push({ kind: 'off_topic', title: pairs[n].homework, topic: pairs[n].topic });
      }
    } catch {
      // The AI did not answer in the expected form: no off-topic flags, the counted flags stay.
    }
  }
  return flags;
};

// A short view of a group: the numbers explained, and the homework flags.
const summarizeGroup = async ({ groupId, language, ask = askGemini }) => {
  const facts = await groupFacts(groupId);
  const flags = await checkHomework({ groupId, ask });
  const system = [
    'You help an academic manager of a programming school.',
    rules(language),
    `Write 2-3 sentences about how ${NAME_MARK} is doing. Do not rate the teacher.`,
  ].join('\n');
  const text = [
    `Group id: ${groupId}`,
    `Attendance in 30 days: ${facts.attendancePercent ?? 'n/a'}%`,
    `Average mark: ${facts.averageGradePercent ?? 'n/a'}%`,
    `Latest topics: ${facts.lessons.map((l) => l.topic).join('; ') || 'none'}`,
    `Homework notes: ${flags.map((f) => `${f.kind} - ${f.title}`).join('; ') || 'none'}`,
  ].join('\n');
  const summary = await ask({ system, text, maxOutputTokens: 600 });
  return { summary, flags };
};

// A draft of a message for a person to edit and send. It is built only from the saved report of that target:
// a student gets a message from the student's report, a group from the group's report, never from a teacher's.
const KIND_HELP = {
  student: 'a short, warm message to a student with advice and the exercises',
  teacher: 'a short, polite, constructive message to a teacher about their lessons',
  group: 'a short message to all students of a group about how the group is doing',
};
const draftMessage = async ({ type, reportText, language, ask = askGemini }) => {
  const system = [
    'You write a draft for an academic manager of a programming school. A human will edit it and send it.',
    rules(language),
    `Write ${KIND_HELP[type]}. Start with a greeting to ${NAME_MARK}. Do not promise anything and do not mention other people.`,
  ].join('\n');
  return ask({ system, text: `Analysis:\n${reportText}`, maxOutputTokens: 600 });
};

module.exports = { LANGUAGES, NAME_MARK, fillName, summarizeStudent, summarizeTeacher, summarizeGroup, checkHomework, draftMessage };
