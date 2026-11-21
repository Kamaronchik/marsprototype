const crypto = require('crypto');

// The rules of the Battle Arena, in one place. The reward and the daily limit are also in
// settle_battle (supabase/migrations/007_battle.sql): change them in both places.
const COURSES = ['html', 'css', 'js', 'react'];
const LEVELS = ['intern', 'junior', 'middle', 'senior'];
const QUESTIONS_PER_BATTLE = 6;
const QUESTION_SECONDS = 20;
const GRACE_MS = 1500;                 // network delay allowed after the 20 seconds
const FINISH_GRACE_MS = 3 * 60 * 1000; // an opponent who walked away loses after this
const CHALLENGE_TTL_MS = 30 * 60 * 1000;
const REWARD = 5;
const DAILY_LIMIT = 20;

// How well each bot level answers, and how fast (milliseconds per question).
const BOT = {
  intern: { accuracy: 0.45, ms: [9000, 18000] },
  junior: { accuracy: 0.6, ms: [7000, 15000] },
  middle: { accuracy: 0.75, ms: [5000, 12000] },
  senior: { accuracy: 0.88, ms: [4000, 9000] },
};

// Fair shuffle (Fisher-Yates) with a secure random source.
const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Picks the questions of one battle and the order in which the 4 options of each are shown.
// order[position] = index of the option in the bank; index 0 is the right answer.
const pickRounds = (questionIds) =>
  shuffle(questionIds).slice(0, QUESTIONS_PER_BATTLE).map((id) => ({ questionId: id, order: shuffle([0, 1, 2, 3]) }));

const between = (min, max) => min + Math.random() * (max - min);

// The bot's answers are decided when the battle starts. Its accuracy moves up and down a little
// from battle to battle, so two battles at the same level never end the same way.
const simulateBot = (level) => {
  const { accuracy, ms } = BOT[level];
  const today = Math.min(0.97, Math.max(0.2, accuracy + between(-0.12, 0.12)));
  return Array.from({ length: QUESTIONS_PER_BATTLE }, () => ({
    correct: Math.random() < today,
    ms: Math.round(between(ms[0], ms[1])),
  }));
};

const deadlineFor = (startedAt) =>
  new Date(startedAt.getTime() + QUESTIONS_PER_BATTLE * QUESTION_SECONDS * 1000 + FINISH_GRACE_MS);

module.exports = {
  COURSES, LEVELS, QUESTIONS_PER_BATTLE, QUESTION_SECONDS, GRACE_MS, CHALLENGE_TTL_MS, REWARD, DAILY_LIMIT,
  pickRounds, simulateBot, deadlineFor,
};
