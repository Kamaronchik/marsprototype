// Puts the question bank (database/battleQuestions.js, with its .uz and .en translations) into the database.
// Run after schema_battle.sql:  npm run seed-battle
// Safe to run again: questions that are already there are skipped.
const supabase = require('../config/supabase');
const questions = require('../database/battleQuestions');
const questionsUz = require('../database/battleQuestions.uz');
const questionsEn = require('../database/battleQuestions.en');

const LEVELS = ['intern', 'junior', 'middle', 'senior'];

// The other languages of one question: {uz: {text, options}, en: {text, options}} (right answer first).
const translationsOf = (index) => {
  const pack = ([text, ...options]) => ({ text, options });
  return { uz: pack(questionsUz[index]), en: pack(questionsEn[index]) };
};
const withTranslations = questions.map((q, index) => ({ ...q, i18n: translationsOf(index) }));
const COURSES = ['html', 'css', 'js', 'react'];

const fail = (message) => {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
};

// A broken line in the bank (a missing option, the same answer twice) must be caught before the insert.
const problems = withTranslations.flatMap((q, i) => {
  const found = [];
  if (!COURSES.includes(q.course) || !LEVELS.includes(q.level)) found.push('unknown course or level');
  if (q.options.length !== 4) found.push('needs exactly 4 options');
  if (new Set(q.options).size !== 4) found.push('has two equal options');
  for (const [code, version] of Object.entries(q.i18n)) {
    if (version.options.length !== 4 || new Set(version.options).size !== 4) found.push(`${code} version needs 4 different options`);
  }
  return found.map((p) => `#${i + 1} "${q.text.slice(0, 40)}": ${p}`);
});

(async () => {
  if (problems.length) return fail(`the question bank has problems:\n  ${problems.join('\n  ')}`);

  const { data: existing, error: readError } = await supabase.from('battle_questions').select('course, level, text, i18n');
  if (readError) return fail(`cannot read battle_questions (did you run schema_battle.sql?): ${readError.message}`);

  const known = new Map(existing.map((q) => [`${q.course}|${q.level}|${q.text}`, q]));
  const fresh = withTranslations.filter((q) => !known.has(`${q.course}|${q.level}|${q.text}`));

  if (fresh.length) {
    const { error } = await supabase.from('battle_questions').insert(fresh);
    if (error) return fail(error.message);
  }

  // Questions that were added before their translations existed get them now.
  let updated = 0;
  for (const q of withTranslations.filter((x) => known.has(`${x.course}|${x.level}|${x.text}`))) {
    const stored = known.get(`${q.course}|${q.level}|${q.text}`);
    if (JSON.stringify(stored.i18n) !== JSON.stringify(q.i18n)) {
      const { error } = await supabase.from('battle_questions').update({ i18n: q.i18n })
        .eq('course', q.course).eq('level', q.level).eq('text', q.text);
      if (error) return fail(error.message);
      updated += 1;
    }
  }
  console.log(`Added ${fresh.length} questions, updated ${updated}, ${questions.length - fresh.length - updated} were up to date.`);

  const { data: all } = await supabase.from('battle_questions').select('course, level').eq('is_active', true);
  for (const course of COURSES) {
    const counts = LEVELS.map((level) => `${level} ${all.filter((q) => q.course === course && q.level === level).length}`);
    console.log(`${course.padEnd(6)} ${counts.join(', ')}`);
  }
  return undefined;
})();
