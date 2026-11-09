// A student's rank and experience (XP), earned by showing up and by winning battles.
const XP_PER_LESSON = 10;
const XP_PER_WIN = 25;

// The lowest XP of each rank, in order.
const RANKS = [
  { key: 'cadet', from: 0 },
  { key: 'pilot', from: 100 },
  { key: 'navigator', from: 300 },
  { key: 'commander', from: 700 },
];

const xpOf = ({ lessonsAttended, battlesWon }) => lessonsAttended * XP_PER_LESSON + battlesWon * XP_PER_WIN;

// Where this XP puts the student: the rank, the next rank, and the progress between them.
const rankFor = (xp) => {
  let index = 0;
  RANKS.forEach((rank, i) => { if (xp >= rank.from) index = i; });

  const current = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  return {
    key: current.key,
    xp,
    nextKey: next?.key ?? null,
    xpIntoRank: xp - current.from,
    xpForNext: next ? next.from - current.from : null, // null at the top rank
  };
};

module.exports = { XP_PER_LESSON, XP_PER_WIN, RANKS, xpOf, rankFor };
