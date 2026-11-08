const supabase = require('../config/supabase');
const { handleDbError, sendRpcError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { notify } = require('../utils/notify');
const { tashkentNow } = require('../utils/schedule');
const {
  COURSES, LEVELS, QUESTIONS_PER_BATTLE, QUESTION_SECONDS, GRACE_MS, CHALLENGE_TTL_MS, REWARD, DAILY_LIMIT,
  pickRounds, simulateBot, deadlineFor,
} = require('../utils/battles');

const BATTLE_COLUMNS = `*, creator:users!battles_creator_id_fkey(full_name), opponent:users!battles_opponent_id_fkey(full_name)`;
const QUESTION_MS = QUESTION_SECONDS * 1000;

const fail = (res, code) => sendRpcError(res, { error: code });

const validCourseAndLevel = ({ course, level }) => COURSES.includes(course) && LEVELS.includes(level);

// --- reading a battle -------------------------------------------------------

const loadBattle = async (id) => {
  const { data } = await supabase.from('battles').select(BATTLE_COLUMNS).eq('id', id).maybeSingle();
  return data;
};

const sideOf = (battle, userId) => {
  if (battle.creator_id === userId) return 'creator';
  if (battle.opponent_id === userId) return 'opponent';
  return null;
};

// Coins won in battles since the start of today (Tashkent time).
const earnedToday = async (userId) => {
  const { data } = await supabase
    .from('transactions')
    .select('amount')
    .eq('student_id', userId)
    .eq('type', 'Earn')
    .not('battle_id', 'is', null)
    .gte('created_at', `${tashkentNow().date}T00:00:00+05:00`);
  return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
};

// win, loss or draw, seen by one player.
const outcomeFor = (battle, side) => {
  if (battle.winner_side === 'draw') return 'draw';
  return battle.winner_side === side ? 'win' : 'loss';
};

const settle = async (battleId) => {
  const { data, error } = await supabase.rpc('settle_battle', { p_battle_id: battleId });
  return error ? { success: false, error: 'DATABASE' } : data;
};

// The result screen: scores, coins and every question with the right answer.
const buildResult = async (battle, userId) => {
  const side = sideOf(battle, userId);
  const ids = battle.rounds.map((r) => r.questionId);

  const [{ data: questions }, { data: answers }] = await Promise.all([
    supabase.from('battle_questions').select('id, text, options').in('id', ids),
    supabase.from('battle_answers').select('round_index, chosen_position, is_correct').eq('battle_id', battle.id).eq('player_id', userId),
  ]);

  return {
    outcome: outcomeFor(battle, side),
    myScore: side === 'creator' ? battle.creator_score : battle.opponent_score,
    opponentScore: side === 'creator' ? battle.opponent_score : battle.creator_score,
    reward: battle.winner_side === side ? battle.reward : 0,
    total: battle.rounds.length,
    review: battle.rounds.map((round, index) => {
      const question = questions.find((q) => q.id === round.questionId);
      const mine = answers.find((a) => a.round_index === index);
      return {
        text: question.text,
        correctAnswer: question.options[0],
        yourAnswer: mine?.chosen_position == null ? null : question.options[round.order[mine.chosen_position]],
        isCorrect: !!mine?.is_correct,
      };
    }),
  };
};

const summaryOf = (battle, userId) => {
  const side = sideOf(battle, userId);
  const other = side === 'creator' ? battle.opponent : battle.creator;
  return {
    id: battle.id,
    course: battle.course,
    level: battle.level,
    mode: battle.mode,
    status: battle.status,
    total: battle.rounds.length,
    opponentName: battle.mode === 'ai' ? null : other?.full_name ?? null,
  };
};

// --- the questions of a running battle ---------------------------------------

// Shows the next question to this player and starts their 20 seconds. A question whose time
// ran out is closed as a wrong answer. Returns null when the player has answered everything.
const nextQuestion = async (battle, userId) => {
  const { data: rows } = await supabase
    .from('battle_answers').select('*').eq('battle_id', battle.id).eq('player_id', userId);

  let index = rows.filter((r) => r.answered_at).length;
  while (index < battle.rounds.length) {
    let row = rows.find((r) => r.round_index === index);
    if (!row) {
      await supabase.from('battle_answers').upsert(
        { battle_id: battle.id, player_id: userId, round_index: index },
        { onConflict: 'battle_id,player_id,round_index', ignoreDuplicates: true },
      );
      ({ data: row } = await supabase
        .from('battle_answers').select('*').eq('battle_id', battle.id).eq('player_id', userId).eq('round_index', index).single());
    }

    const endsAt = new Date(row.started_at).getTime() + QUESTION_MS;
    if (Date.now() > endsAt + GRACE_MS) {
      await supabase.from('battle_answers')
        .update({ answered_at: new Date(endsAt).toISOString(), is_correct: false, time_ms: QUESTION_MS })
        .eq('id', row.id).is('answered_at', null);
      index += 1;
    } else {
      const round = battle.rounds[index];
      const { data: question } = await supabase.from('battle_questions').select('text, options').eq('id', round.questionId).single();
      return {
        round: index,
        total: battle.rounds.length,
        text: question.text,
        options: round.order.map((optionIndex, position) => ({ position, text: question.options[optionIndex] })),
        endsAt: new Date(endsAt).toISOString(),
        // The server's own clock: the browser measures the 20 seconds against it, not against its own.
        now: new Date().toISOString(),
      };
    }
  }
  return null;
};

// Called when a player has answered everything: pays the winner if the battle can end now.
const finishIfReady = async (battle, userId) => {
  const settled = await settle(battle.id);
  if (!settled.success) return null;

  const done = await loadBattle(battle.id);
  if (!settled.already_done && done.mode === 'pvp') {
    const side = sideOf(done, userId);
    const otherId = side === 'creator' ? done.opponent_id : done.creator_id;
    const otherSide = side === 'creator' ? 'opponent' : 'creator';
    await notify(otherId, 'battle.finished', {
      course: done.course, level: done.level, outcome: outcomeFor(done, otherSide), reward: done.winner_side === otherSide ? done.reward : 0,
    }, { link: `/student/battle/${done.id}` });
  }
  return done;
};

// --- handlers -----------------------------------------------------------------

// What the Battle Arena page needs to draw its forms and the daily coin limit.
const getOptions = async (req, res) => {
  const earned = await earnedToday(req.user.id);
  res.json({
    courses: COURSES,
    levels: LEVELS,
    questionsPerBattle: QUESTIONS_PER_BATTLE,
    questionSeconds: QUESTION_SECONDS,
    reward: REWARD,
    dailyLimit: DAILY_LIMIT,
    earnedToday: earned,
    remainingToday: Math.max(0, DAILY_LIMIT - earned),
  });
};

const pickQuestionIds = async (course, level) => {
  const { data } = await supabase.from('battle_questions').select('id').eq('course', course).eq('level', level).eq('is_active', true);
  return data.map((q) => q.id);
};

const createBattle = async (req, res, mode) => {
  const { course, level } = req.body;
  if (!validCourseAndLevel({ course, level })) return res.status(400).json({ message: 'Choose a course and a level' });

  const ids = await pickQuestionIds(course, level);
  if (ids.length < QUESTIONS_PER_BATTLE) return fail(res, 'NOT_ENOUGH_QUESTIONS');

  const now = new Date();
  const fields = { course, level, mode, creator_id: req.user.id, rounds: pickRounds(ids) };
  const row = mode === 'ai'
    ? { ...fields, status: 'active', started_at: now.toISOString(), deadline_at: deadlineFor(now).toISOString(), bot_results: simulateBot(level) }
    : { ...fields, status: 'open' };

  const { data, error } = await supabase.from('battles').insert(row).select('id').single();
  if (error?.code === '23505') return fail(res, 'ALREADY_OPEN');
  if (error) return handleDbError(error, res);
  res.status(201).json({ battleId: data.id });
};

const createAiBattle = (req, res) => createBattle(req, res, 'ai');
const createChallenge = (req, res) => createBattle(req, res, 'pvp');

// Open challenges of other students, and my own open challenge.
const listChallenges = async (req, res) => {
  await supabase.from('battles').update({ status: 'expired' })
    .eq('mode', 'pvp').eq('status', 'open').lt('created_at', new Date(Date.now() - CHALLENGE_TTL_MS).toISOString());

  const { data, error } = await supabase
    .from('battles')
    .select('id, course, level, creator_id, created_at, creator:users!battles_creator_id_fkey(full_name)')
    .eq('mode', 'pvp').eq('status', 'open').order('created_at', { ascending: false }).limit(50);
  if (error) return handleDbError(error, res);

  res.json({
    challenges: data.map((b) => ({
      id: b.id, course: b.course, level: b.level, creatorName: b.creator.full_name, createdAt: b.created_at, mine: b.creator_id === req.user.id,
    })),
  });
};

const cancelChallenge = async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Invalid battle id' });

  const { data, error } = await supabase.from('battles').update({ status: 'cancelled' })
    .eq('id', req.params.id).eq('creator_id', req.user.id).eq('status', 'open').select('id').maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return fail(res, 'BATTLE_NOT_FOUND');
  res.json({ message: 'Done' });
};

// One UPDATE with conditions: when two students press Accept at once, only one gets the row.
const acceptChallenge = async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Invalid battle id' });

  const now = new Date();
  const { data, error } = await supabase.from('battles')
    .update({ opponent_id: req.user.id, status: 'active', started_at: now.toISOString(), deadline_at: deadlineFor(now).toISOString() })
    .eq('id', req.params.id).eq('mode', 'pvp').eq('status', 'open').neq('creator_id', req.user.id)
    .gte('created_at', new Date(Date.now() - CHALLENGE_TTL_MS).toISOString())
    .select('id, creator_id, course, level, opponent:users!battles_opponent_id_fkey(full_name)')
    .maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return fail(res, 'CHALLENGE_TAKEN');

  await notify(data.creator_id, 'battle.accepted', { opponentName: data.opponent.full_name, course: data.course, level: data.level }, { link: `/student/battle/${data.id}` });
  res.json({ battleId: data.id });
};

// The state of one battle for a player: waiting, the current question, or the result.
const getBattle = async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Invalid battle id' });

  let battle = await loadBattle(req.params.id);
  // Someone else's battle looks like a missing one.
  if (!battle || !sideOf(battle, req.user.id)) return fail(res, 'BATTLE_NOT_FOUND');

  if (battle.status === 'active' && Date.now() > new Date(battle.deadline_at).getTime()) {
    await settle(battle.id);
    battle = await loadBattle(battle.id);
  }

  const summary = summaryOf(battle, req.user.id);
  if (battle.status === 'finished') return res.json({ battle: summary, result: await buildResult(battle, req.user.id) });
  if (battle.status !== 'active') return res.json({ battle: summary });

  const question = await nextQuestion(battle, req.user.id);
  if (question) return res.json({ battle: summary, question });

  const done = await finishIfReady(battle, req.user.id);
  if (done) return res.json({ battle: summaryOf(done, req.user.id), result: await buildResult(done, req.user.id) });
  res.json({ battle: summary, waiting: true });
};

const answerQuestion = async (req, res) => {
  const { round, position } = req.body;
  if (!isUuid(req.params.id) || !Number.isInteger(round) || !Number.isInteger(position) || position < 0 || position > 3) {
    return res.status(400).json({ message: 'Invalid answer' });
  }

  const battle = await loadBattle(req.params.id);
  if (!battle || !sideOf(battle, req.user.id)) return fail(res, 'BATTLE_NOT_FOUND');
  if (battle.status !== 'active') return fail(res, 'BATTLE_NOT_ACTIVE');

  const { data: rows } = await supabase
    .from('battle_answers').select('*').eq('battle_id', battle.id).eq('player_id', req.user.id).order('round_index');
  const answered = rows.filter((r) => r.answered_at).length;
  if (round !== answered) return fail(res, 'WRONG_ROUND');

  const row = rows.find((r) => r.round_index === round);
  if (!row) return fail(res, 'NOT_STARTED');

  const elapsed = Date.now() - new Date(row.started_at).getTime();
  const late = elapsed > QUESTION_MS + GRACE_MS;
  const order = battle.rounds[round].order;
  const correct = !late && order[position] === 0;

  const { data: saved, error } = await supabase.from('battle_answers')
    .update({
      answered_at: new Date().toISOString(),
      chosen_position: late ? null : position,
      is_correct: correct,
      time_ms: Math.min(elapsed, QUESTION_MS),
    })
    .eq('id', row.id).is('answered_at', null).select('id').maybeSingle();
  if (error) return handleDbError(error, res);
  if (!saved) return fail(res, 'ALREADY_ANSWERED');

  const reply = { correct, correctPosition: order.indexOf(0), finished: false };
  if (answered + 1 === battle.rounds.length) {
    const done = await finishIfReady(battle, req.user.id);
    reply.finished = true;
    if (done) reply.result = await buildResult(done, req.user.id);
  }
  res.json(reply);
};

// My finished battles and my numbers.
const getHistory = async (req, res) => {
  const { data, error } = await supabase
    .from('battles')
    .select(BATTLE_COLUMNS)
    .eq('status', 'finished')
    .or(`creator_id.eq.${req.user.id},opponent_id.eq.${req.user.id}`)
    .order('finished_at', { ascending: false })
    .limit(100);
  if (error) return handleDbError(error, res);

  const battles = data.map((b) => {
    const side = sideOf(b, req.user.id);
    const other = side === 'creator' ? b.opponent : b.creator;
    return {
      id: b.id,
      course: b.course,
      level: b.level,
      mode: b.mode,
      opponentName: b.mode === 'ai' ? null : other?.full_name ?? null,
      outcome: outcomeFor(b, side),
      myScore: side === 'creator' ? b.creator_score : b.opponent_score,
      opponentScore: side === 'creator' ? b.opponent_score : b.creator_score,
      total: b.rounds.length,
      reward: b.winner_side === side ? b.reward : 0,
      finishedAt: b.finished_at,
    };
  });

  res.json({
    battles,
    stats: {
      wins: battles.filter((b) => b.outcome === 'win').length,
      losses: battles.filter((b) => b.outcome === 'loss').length,
      draws: battles.filter((b) => b.outcome === 'draw').length,
      coins: battles.reduce((sum, b) => sum + b.reward, 0),
    },
  });
};

// Admin: numbers about the competitions and the size of the question bank.
const getAdminStats = async (req, res) => {
  const [battlesQuery, bankQuery, recentQuery] = await Promise.all([
    supabase.from('battles').select('course, mode, status').limit(5000),
    supabase.from('battle_questions').select('course, level').eq('is_active', true).limit(5000),
    supabase.from('battles').select(BATTLE_COLUMNS).eq('status', 'finished').order('finished_at', { ascending: false }).limit(20),
  ]);
  const failed = [battlesQuery, bankQuery, recentQuery].find((r) => r.error);
  if (failed) return handleDbError(failed.error, res);

  const all = battlesQuery.data;
  res.json({
    totals: {
      battles: all.length,
      finished: all.filter((b) => b.status === 'finished').length,
      ai: all.filter((b) => b.mode === 'ai').length,
      pvp: all.filter((b) => b.mode === 'pvp').length,
    },
    byCourse: COURSES.map((course) => ({ course, battles: all.filter((b) => b.course === course).length })),
    bank: COURSES.map((course) => ({
      course,
      levels: LEVELS.map((level) => ({ level, questions: bankQuery.data.filter((q) => q.course === course && q.level === level).length })),
    })),
    recent: recentQuery.data.map((b) => ({
      id: b.id,
      course: b.course,
      level: b.level,
      mode: b.mode,
      creatorName: b.creator.full_name,
      opponentName: b.mode === 'ai' ? null : b.opponent?.full_name ?? null,
      winnerSide: b.winner_side,
      score: `${b.creator_score}:${b.opponent_score}`,
      reward: b.reward,
      finishedAt: b.finished_at,
    })),
  });
};

module.exports = {
  getOptions, createAiBattle, createChallenge, listChallenges, cancelChallenge, acceptChallenge,
  getBattle, answerQuestion, getHistory, getAdminStats,
};
