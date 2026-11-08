// Puts the question bank (database/battleQuestions.js) into the database.
// Run after schema_battle.sql:  npm run seed-battle
// Safe to run again: questions that are already there are skipped.
const supabase = require('../config/supabase');
const questions = require('../database/battleQuestions');

const LEVELS = ['intern', 'junior', 'middle', 'senior'];
const COURSES = ['html', 'css', 'js', 'react'];

const fail = (message) => {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
};

// A broken line in the bank (a missing option, the same answer twice) must be caught before the insert.
const problems = questions.flatMap((q, i) => {
  const found = [];
  if (!COURSES.includes(q.course) || !LEVELS.includes(q.level)) found.push('unknown course or level');
  if (q.options.length !== 4) found.push('needs exactly 4 options');
  if (new Set(q.options).size !== 4) found.push('has two equal options');
  return found.map((p) => `#${i + 1} "${q.text.slice(0, 40)}": ${p}`);
});

(async () => {
  if (problems.length) return fail(`the question bank has problems:\n  ${problems.join('\n  ')}`);

  const { data: existing, error: readError } = await supabase.from('battle_questions').select('course, level, text');
  if (readError) return fail(`cannot read battle_questions (did you run schema_battle.sql?): ${readError.message}`);

  const known = new Set(existing.map((q) => `${q.course}|${q.level}|${q.text}`));
  const fresh = questions.filter((q) => !known.has(`${q.course}|${q.level}|${q.text}`));

  if (fresh.length) {
    const { error } = await supabase.from('battle_questions').insert(fresh);
    if (error) return fail(error.message);
  }
  console.log(`Added ${fresh.length} questions, ${questions.length - fresh.length} were already there.`);

  const { data: all } = await supabase.from('battle_questions').select('course, level').eq('is_active', true);
  for (const course of COURSES) {
    const counts = LEVELS.map((level) => `${level} ${all.filter((q) => q.course === course && q.level === level).length}`);
    console.log(`${course.padEnd(6)} ${counts.join(', ')}`);
  }
  return undefined;
})();
