// End-to-end check of the Battle Arena against the real database.
// Run AFTER schema_battle.sql and  npm run seed-battle :   npm run test-battle
// Test accounts are the fixed "zz_test_*" ones. Finished battles stay (a reward row points at them).
const {
  supabase, check, markFailed, ensureUser, openSession, startServer, call, finish, minutesFromNow,
} = require('./testKit');
const { tashkentNow } = require('../utils/schedule');
const { QUESTIONS_PER_BATTLE } = require('../utils/battles');

const TOTAL = QUESTIONS_PER_BATTLE;

const bellTypes = async (who) => (await call('GET', '/api/notifications', who)).body.notifications.map((n) => n.type);

const earnedToday = async (student) => {
  const { data } = await supabase.from('transactions').select('amount')
    .eq('student_id', student.id).eq('type', 'Earn').not('battle_id', 'is', null)
    .gte('created_at', `${tashkentNow().date}T00:00:00+05:00`);
  return data.reduce((sum, row) => sum + row.amount, 0);
};

const rewardFor = (earned) => Math.max(0, Math.min(5, 20 - earned));

// The right position of every round is known only to the database; the test reads it there.
const rightPositions = async (battleId) => {
  const { data } = await supabase.from('battles').select('rounds').eq('id', battleId).single();
  return data.rounds.map((round) => round.order.indexOf(0));
};

// The bot's whole battle, decided by the test: every answer right or wrong, at a given speed.
const fixBot = (battleId, correct, ms) => supabase.from('battles')
  .update({ bot_results: Array.from({ length: TOTAL }, () => ({ correct, ms })) }).eq('id', battleId);

// Plays a whole battle through the API. right = true answers everything correctly.
const play = async (who, battleId, right) => {
  const positions = await rightPositions(battleId);
  let last;
  for (let round = 0; round < TOTAL; round += 1) {
    const shown = await call('GET', `/api/battles/${battleId}`, who);
    if (!shown.body.question) return shown;
    const position = right ? positions[round] : (positions[round] + 1) % 4;
    last = await call('POST', `/api/battles/${battleId}/answer`, who, { round, position });
  }
  return last;
};

const newAiBattle = async (who, course = 'js', level = 'intern') =>
  (await call('POST', '/api/battles/ai', who, { course, level })).body.battleId;

// --- test groups -----------------------------------------------------------

const testAccess = async ({ admin, teacher, studentA }) => {
  console.log('\nAccess and options');
  check('no session -> 401', (await call('GET', '/api/battles/options')).status === 401);
  check('teacher cannot play -> 403', (await call('GET', '/api/battles/options', teacher)).status === 403);
  check('student cannot see admin stats -> 403', (await call('GET', '/api/battles/stats', studentA)).status === 403);
  check('admin sees the stats', (await call('GET', '/api/battles/stats', admin)).status === 200);

  const options = (await call('GET', '/api/battles/options', studentA)).body;
  check('4 courses, 4 levels, reward 5, daily limit 20', options.courses.length === 4 && options.levels.length === 4 && options.reward === 5 && options.dailyLimit === 20, options);
  check('remaining today is what is left of 20', options.remainingToday === 20 - (await earnedToday(studentA)), options);
  check('unknown course -> 400', (await call('POST', '/api/battles/ai', studentA, { course: 'python', level: 'intern' })).status === 400);
  check('unknown level -> 400', (await call('POST', '/api/battles/ai', studentA, { course: 'js', level: 'god' })).status === 400);

  const bank = (await call('GET', '/api/battles/stats', admin)).body.bank;
  check('every course and level has enough questions', bank.every((c) => c.levels.every((l) => l.questions >= TOTAL)), bank);
};

const testAiBattle = async ({ studentA }) => {
  console.log('\nBattle against the bot');
  const battleId = await newAiBattle(studentA);
  check('battle starts at once', !!battleId);

  const shown = await call('GET', `/api/battles/${battleId}`, studentA);
  const question = shown.body.question;
  check('the first question has 4 shuffled options and a timer', question?.round === 0 && question.total === TOTAL && question.options.length === 4 && !!question.endsAt, shown.body);
  check('the right answer is NOT sent with the question', !JSON.stringify(shown.body).match(/correct|right|answerIndex/i), shown.body);
  check('the same question comes back after a reload with the same time', (await call('GET', `/api/battles/${battleId}`, studentA)).body.question.endsAt === question.endsAt);

  check('answering a later round first -> WRONG_ROUND', (await call('POST', `/api/battles/${battleId}/answer`, studentA, { round: 3, position: 0 })).body.code === 'WRONG_ROUND');
  check('position 7 -> 400', (await call('POST', `/api/battles/${battleId}/answer`, studentA, { round: 0, position: 7 })).status === 400);

  const [right] = await rightPositions(battleId);
  const first = await call('POST', `/api/battles/${battleId}/answer`, studentA, { round: 0, position: right });
  check('right answer is confirmed', first.status === 200 && first.body.correct === true && first.body.correctPosition === right, first.body);
  check('the same round twice -> refused', (await call('POST', `/api/battles/${battleId}/answer`, studentA, { round: 0, position: right })).status === 409);

  const wrongBattle = await newAiBattle(studentA);
  await call('GET', `/api/battles/${wrongBattle}`, studentA);
  const [rightWrong] = await rightPositions(wrongBattle);
  const wrong = await call('POST', `/api/battles/${wrongBattle}/answer`, studentA, { round: 0, position: (rightWrong + 1) % 4 });
  check('wrong answer shows the right position', wrong.body.correct === false && wrong.body.correctPosition === rightWrong, wrong.body);
};

const testResults = async ({ studentA }) => {
  console.log('\nResults, rewards and the daily limit');

  // A win: the bot answers everything wrong.
  const winId = await newAiBattle(studentA);
  await fixBot(winId, false, 9000);
  const earnedBefore = await earnedToday(studentA);
  const balanceBefore = (await call('GET', '/api/wallet', studentA)).body.balance;
  const won = await play(studentA, winId, true);
  const expected = rewardFor(earnedBefore);
  check('all right against a bot that fails -> win', won.body.result?.outcome === 'win' && won.body.result.myScore === TOTAL && won.body.result.opponentScore === 0, won.body);
  check('the reward is 5 coins, or what is left of 20 today', won.body.result?.reward === expected, { expected, got: won.body.result?.reward });
  check('the coins reach the wallet', (await call('GET', '/api/wallet', studentA)).body.balance === balanceBefore + expected);
  check('the result lists every question with the right answer', won.body.result?.review.length === TOTAL && won.body.result.review.every((r) => r.isCorrect && r.correctAnswer && r.yourAnswer === r.correctAnswer), won.body.result?.review);
  check('opening a finished battle shows the same result', (await call('GET', `/api/battles/${winId}`, studentA)).body.result?.reward === expected);
  check('answering a finished battle is refused', (await call('POST', `/api/battles/${winId}/answer`, studentA, { round: 0, position: 0 })).status === 409);

  // A loss: the bot answers everything right.
  const lossId = await newAiBattle(studentA);
  await fixBot(lossId, true, 9000);
  const lost = await play(studentA, lossId, false);
  check('all wrong against a perfect bot -> loss, no coins', lost.body.result?.outcome === 'loss' && lost.body.result.reward === 0, lost.body);

  // The same score is decided by time.
  const fastBotId = await newAiBattle(studentA);
  await fixBot(fastBotId, true, 1);
  const slowWin = await play(studentA, fastBotId, true);
  check('the same score, a faster bot -> loss', slowWin.body.result?.outcome === 'loss' && slowWin.body.result.myScore === TOTAL && slowWin.body.result.opponentScore === TOTAL, slowWin.body);

  const slowBotId = await newAiBattle(studentA);
  await fixBot(slowBotId, true, 20000);
  const fastWin = await play(studentA, slowBotId, true);
  check('the same score, a slower bot -> win', fastWin.body.result?.outcome === 'win', fastWin.body);

  // The daily limit: five more wins can never push the day above 20 coins.
  const before = await earnedToday(studentA);
  for (let i = 0; i < 5; i += 1) {
    const id = await newAiBattle(studentA);
    await fixBot(id, false, 9000);
    await play(studentA, id, true);
  }
  check('at most 20 coins a day from battles', (await earnedToday(studentA)) === Math.min(20, before + 25), { before, after: await earnedToday(studentA) });

  // Different battles of one level end differently.
  const rows = [];
  for (let i = 0; i < 12; i += 1) {
    const id = await newAiBattle(studentA, 'css', 'junior');
    rows.push(JSON.stringify((await supabase.from('battles').select('bot_results').eq('id', id).single()).data.bot_results.map((r) => r.correct)));
  }
  check('the bot does not answer the same way every time', new Set(rows).size > 3, [...new Set(rows)].length);
};

const testTimeouts = async ({ studentA }) => {
  console.log('\nTime limits');
  const battleId = await newAiBattle(studentA, 'html', 'intern');
  await call('GET', `/api/battles/${battleId}`, studentA);
  await supabase.from('battle_answers').update({ started_at: minutesFromNow(-1) }).eq('battle_id', battleId).eq('player_id', studentA.id);

  const next = await call('GET', `/api/battles/${battleId}`, studentA);
  check('a question that ran out of time is closed and the next one is shown', next.body.question?.round === 1, next.body);
  const { data: closed } = await supabase.from('battle_answers').select('is_correct, chosen_position').eq('battle_id', battleId).eq('player_id', studentA.id).eq('round_index', 0).single();
  check('the missed question counts as wrong', closed.is_correct === false && closed.chosen_position === null, closed);

  await supabase.from('battle_answers').update({ started_at: minutesFromNow(-1) }).eq('battle_id', battleId).eq('player_id', studentA.id).eq('round_index', 1);
  const [, right] = await rightPositions(battleId);
  const late = await call('POST', `/api/battles/${battleId}/answer`, studentA, { round: 1, position: right });
  check('a right answer after 20 seconds does not count', late.status === 200 && late.body.correct === false, late.body);

  const abandoned = await newAiBattle(studentA, 'html', 'intern');
  await fixBot(abandoned, false, 9000);
  await supabase.from('battles').update({ deadline_at: minutesFromNow(-1) }).eq('id', abandoned);
  const ended = await call('GET', `/api/battles/${abandoned}`, studentA);
  check('a battle left after its deadline is finished with zero points', ended.body.result?.myScore === 0 && ended.body.battle.status === 'finished', ended.body);
};

const testChallenges = async ({ studentA, studentB, studentC }) => {
  console.log('\nChallenges between students');
  const challenge = await call('POST', '/api/battles/challenges', studentA, { course: 'html', level: 'junior' });
  check('a student opens a challenge', challenge.status === 201, challenge.body);
  const id = challenge.body.battleId;

  check('a second open challenge -> ALREADY_OPEN', (await call('POST', '/api/battles/challenges', studentA, { course: 'css', level: 'intern' })).body.code === 'ALREADY_OPEN');

  const seenByB = (await call('GET', '/api/battles/challenges', studentB)).body.challenges.find((c) => c.id === id);
  check('another student sees it on the Battle Arena list', seenByB?.course === 'html' && seenByB.level === 'junior' && seenByB.mine === false && seenByB.creatorName === 'ZZ Test student_a', seenByB);
  check('the author sees it as their own', (await call('GET', '/api/battles/challenges', studentA)).body.challenges.find((c) => c.id === id)?.mine === true);
  check('nobody can accept their own challenge', (await call('POST', `/api/battles/challenges/${id}/accept`, studentA)).body.code === 'CHALLENGE_TAKEN');
  check('only the author can cancel it', (await call('DELETE', `/api/battles/challenges/${id}`, studentB)).status === 404);

  const accepted = await call('POST', `/api/battles/challenges/${id}/accept`, studentB);
  check('another student accepts it', accepted.status === 200 && accepted.body.battleId === id, accepted.body);
  check('the author is told', (await bellTypes(studentA)).includes('battle.accepted'));
  check('a third student cannot take it any more', (await call('POST', `/api/battles/challenges/${id}/accept`, studentC)).body.code === 'CHALLENGE_TAKEN');
  check('a stranger cannot open the battle -> 404', (await call('GET', `/api/battles/${id}`, studentC)).status === 404);

  // Both play; the author is perfect, the opponent is always wrong.
  const author = await play(studentA, id, true);
  check('the first to finish waits for the other', author.body.finished === true && !author.body.result, author.body);
  check('the waiting screen has no result yet', (await call('GET', `/api/battles/${id}`, studentA)).body.waiting === true);

  const earnedBefore = await earnedToday(studentA);
  const opponent = await play(studentB, id, false);
  check('when the second player finishes the battle is settled', opponent.body.result?.outcome === 'loss' && opponent.body.result.opponentScore === TOTAL, opponent.body);
  const seenByA = (await call('GET', `/api/battles/${id}`, studentA)).body.result;
  check('the winner sees the win and the reward', seenByA?.outcome === 'win' && seenByA.reward >= 0 && seenByA.myScore === TOTAL, seenByA);
  check('the reward was paid once and within the limit', (await earnedToday(studentA)) === earnedBefore + seenByA.reward);
  check('the first player is told the battle ended', (await bellTypes(studentA)).includes('battle.finished'));

  // Two students press Accept at the same moment: one wins.
  const second = (await call('POST', '/api/battles/challenges', studentA, { course: 'css', level: 'middle' })).body.battleId;
  const both = await Promise.all([
    call('POST', `/api/battles/challenges/${second}/accept`, studentB),
    call('POST', `/api/battles/challenges/${second}/accept`, studentC),
  ]);
  check('two accepts at once -> exactly one succeeds', both.filter((r) => r.status === 200).length === 1 && both.filter((r) => r.status === 409).length === 1, both.map((r) => r.status));

  // A challenge nobody accepts, and an old one.
  const lonely = (await call('POST', '/api/battles/challenges', studentC, { course: 'js', level: 'senior' })).body.battleId;
  check('the author cancels an open challenge', (await call('DELETE', `/api/battles/challenges/${lonely}`, studentC)).status === 200);
  check('a cancelled challenge is not listed', !(await call('GET', '/api/battles/challenges', studentA)).body.challenges.some((c) => c.id === lonely));
  const old = (await call('POST', '/api/battles/challenges', studentC, { course: 'react', level: 'intern' })).body.battleId;
  await supabase.from('battles').update({ created_at: minutesFromNow(-40) }).eq('id', old);
  check('a challenge older than 30 minutes disappears', !(await call('GET', '/api/battles/challenges', studentA)).body.challenges.some((c) => c.id === old));
  check('and cannot be accepted', (await call('POST', `/api/battles/challenges/${old}/accept`, studentB)).body.code === 'CHALLENGE_TAKEN');

  // An opponent who walks away loses when the deadline passes.
  const walkChallenge = await call('POST', '/api/battles/challenges', studentB, { course: 'js', level: 'intern' });
  check('a student opens a challenge to test walking away', walkChallenge.status === 201, walkChallenge.body);
  const walk = walkChallenge.body.battleId;
  await call('POST', `/api/battles/challenges/${walk}/accept`, studentA);
  await play(studentA, walk, true);
  await supabase.from('battles').update({ deadline_at: minutesFromNow(-1) }).eq('id', walk);
  const forfeit = (await call('GET', `/api/battles/${walk}`, studentA)).body.result;
  check('an opponent who never answered loses', forfeit?.outcome === 'win' && forfeit.opponentScore === 0, forfeit);
};

const testHistory = async ({ admin, studentA }) => {
  console.log('\nHistory and admin numbers');
  const history = (await call('GET', '/api/battles/history', studentA)).body;
  check('the history lists finished battles with the result', history.battles.length >= 5 && history.battles.every((b) => ['win', 'loss', 'draw'].includes(b.outcome)), history.battles.length);
  check('the numbers add up', history.stats.wins + history.stats.losses + history.stats.draws === history.battles.length);
  check('coins in the history are the rewards', history.stats.coins === history.battles.reduce((sum, b) => sum + b.reward, 0));
  check('an AI battle has no opponent name', history.battles.some((b) => b.mode === 'ai' && b.opponentName === null));
  check('a student battle has the opponent name', history.battles.some((b) => b.mode === 'pvp' && !!b.opponentName));

  const stats = (await call('GET', '/api/battles/stats', admin)).body;
  check('admin sees totals and recent battles', stats.totals.battles >= history.battles.length && stats.recent.length > 0 && stats.byCourse.length === 4, stats.totals);
};

// --- run -------------------------------------------------------------------

const cleanup = async (users) => {
  const ids = users.map((u) => u.id);
  await supabase.from('battles').update({ status: 'cancelled' }).in('creator_id', ids).eq('status', 'open');
  await supabase.from('sessions').delete().in('user_id', ids);
  await supabase.from('notifications').delete().in('user_id', ids);
  await supabase.from('users').update({ status: 'blocked', payment_status: 'active' }).in('id', ids);
};

(async () => {
  const server = startServer();
  let users = [];

  try {
    const { error: missing } = await supabase.from('battle_questions').select('id').limit(1);
    if (missing) throw new Error('Run schema_battle.sql in Supabase first, then npm run seed-battle.');

    const raw = {
      admin: await ensureUser('admin', 'Admin'),
      teacher: await ensureUser('teacher', 'Teacher'),
      studentA: await ensureUser('student_a', 'Student'),
      studentB: await ensureUser('student_b', 'Student'),
      studentC: await ensureUser('student_c', 'Student'),
    };
    users = Object.values(raw);
    await supabase.from('battles').update({ status: 'cancelled' }).in('creator_id', users.map((u) => u.id)).eq('status', 'open');
    await supabase.from('notifications').delete().in('user_id', users.map((u) => u.id));

    const people = {};
    for (const [key, user] of Object.entries(raw)) people[key] = await openSession(user);

    await testAccess(people);
    await testAiBattle(people);
    await testResults(people);
    await testTimeouts(people);
    await testChallenges(people);
    await testHistory(people);
  } catch (error) {
    markFailed();
    console.error('\nTest run stopped:', error.message);
  } finally {
    if (users.length) await cleanup(users);
    finish(server);
  }
})();
