-- =============================================================================
-- MARS SPACE - BATTLE ARENA: question bank, battles, answers, coin rewards,
-- and the translation overrides that the admin edits in Settings.
-- Run once in Supabase -> SQL Editor, AFTER schema_shop.sql.
-- Safe to run again: everything uses IF NOT EXISTS / OR REPLACE.
-- Then fill the bank:  npm run seed-battle
-- =============================================================================

-- 1. QUESTION BANK
-- options is a list of 4 texts. The FIRST one is the right answer: the server shuffles
-- the options for every battle and never sends the right one to the browser before the answer.
CREATE TABLE IF NOT EXISTS battle_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course TEXT NOT NULL CHECK (course IN ('html', 'css', 'js', 'react')),
  level TEXT NOT NULL CHECK (level IN ('intern', 'junior', 'middle', 'senior')),
  text TEXT NOT NULL,
  options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- The same question in other languages: {"uz": {"text": "...", "options": [4 texts, right answer first]}, "en": {...}}
  i18n JSONB NOT NULL DEFAULT '{}',
  UNIQUE (course, level, text)
);

-- For a database where the table already exists without that column
ALTER TABLE battle_questions ADD COLUMN IF NOT EXISTS i18n JSONB NOT NULL DEFAULT '{}';

-- 2. BATTLES
-- mode 'ai': against the bot, starts at once. mode 'pvp': an open challenge until a second student accepts.
-- rounds = [{"questionId": "...", "order": [2, 0, 3, 1]}]: which questions, and in which order the options are shown.
-- bot_results = [{"correct": true, "ms": 8200}] decided when the battle is created.
CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course TEXT NOT NULL CHECK (course IN ('html', 'css', 'js', 'react')),
  level TEXT NOT NULL CHECK (level IN ('intern', 'junior', 'middle', 'senior')),
  mode TEXT NOT NULL CHECK (mode IN ('ai', 'pvp')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'finished', 'cancelled', 'expired')),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opponent_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  rounds JSONB NOT NULL,
  bot_results JSONB,
  creator_score INTEGER,
  opponent_score INTEGER,
  winner_side TEXT CHECK (winner_side IN ('creator', 'opponent', 'bot', 'draw')),
  reward INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  deadline_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE
);

-- A student has at most one open challenge at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_battles_one_open_per_student
  ON battles (creator_id) WHERE status = 'open' AND mode = 'pvp';

-- 3. ANSWERS
-- A row is created when a player is shown a question (started_at) and filled when they answer.
-- A timeout is stored as an answer with is_correct = false and no chosen position.
CREATE TABLE IF NOT EXISTS battle_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_index INTEGER NOT NULL CHECK (round_index >= 0),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMP WITH TIME ZONE,
  chosen_position INTEGER CHECK (chosen_position BETWEEN 0 AND 3),
  is_correct BOOLEAN,
  time_ms INTEGER,
  UNIQUE (battle_id, player_id, round_index)
);

-- 4. COIN REWARDS
-- A battle reward is an 'Earn' transaction with battle_id set. The daily limit counts these rows.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS battle_id UUID REFERENCES battles(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_battle_questions_pick ON battle_questions(course, level) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_battles_open ON battles(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_battles_creator ON battles(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_battles_opponent ON battles(opponent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_battle_answers_player ON battle_answers(battle_id, player_id);
CREATE INDEX IF NOT EXISTS idx_transactions_battle ON transactions(student_id, created_at) WHERE battle_id IS NOT NULL;

-- =============================================================================
-- SETTLE A BATTLE
-- Counts the score, finds the winner and pays the reward in ONE transaction.
-- Winner: more right answers; the same score: less total time; the same time: a draw.
-- Reward: 5 coins for a win, but a student gets at most 20 coins per day from battles (Tashkent time).
-- Safe to call again: a finished battle just returns its result.
-- If a player has not finished and the deadline has not come yet, nothing happens.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.settle_battle(p_battle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    c_reward CONSTANT INTEGER := 5;
    c_daily_limit CONSTANT INTEGER := 20;
    c_question_ms CONSTANT INTEGER := 20000;
    v_battle RECORD;
    v_rounds INTEGER;
    v_player UUID;
    v_open INTEGER;
    v_creator_score INTEGER;
    v_creator_ms BIGINT;
    v_opponent_score INTEGER;
    v_opponent_ms BIGINT;
    v_side TEXT;
    v_winner UUID;
    v_earned INTEGER;
    v_reward INTEGER := 0;
    v_day_start TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id FOR UPDATE;

    IF v_battle IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'BATTLE_NOT_FOUND');
    END IF;

    IF v_battle.status = 'finished' THEN
        RETURN jsonb_build_object('success', true, 'already_done', true, 'winner_side', v_battle.winner_side, 'reward', v_battle.reward);
    END IF;

    IF v_battle.status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'BATTLE_NOT_ACTIVE');
    END IF;

    v_rounds := jsonb_array_length(v_battle.rounds);

    FOREACH v_player IN ARRAY ARRAY[v_battle.creator_id, v_battle.opponent_id] LOOP
        CONTINUE WHEN v_player IS NULL;

        -- Questions a player has not answered: closed as wrong once the deadline has passed
        SELECT v_rounds - COUNT(*) INTO v_open
        FROM public.battle_answers
        WHERE battle_id = p_battle_id AND player_id = v_player AND answered_at IS NOT NULL;

        IF v_open > 0 THEN
            IF NOW() < v_battle.deadline_at THEN
                RETURN jsonb_build_object('success', false, 'error', 'NOT_FINISHED');
            END IF;

            INSERT INTO public.battle_answers (battle_id, player_id, round_index, started_at, answered_at, is_correct, time_ms)
            SELECT p_battle_id, v_player, r, v_battle.deadline_at, v_battle.deadline_at, false, c_question_ms
            FROM generate_series(0, v_rounds - 1) AS r
            ON CONFLICT (battle_id, player_id, round_index) DO NOTHING;

            UPDATE public.battle_answers
            SET answered_at = v_battle.deadline_at, is_correct = false, time_ms = c_question_ms
            WHERE battle_id = p_battle_id AND player_id = v_player AND answered_at IS NULL;
        END IF;
    END LOOP;

    SELECT COUNT(*) FILTER (WHERE is_correct), COALESCE(SUM(time_ms), 0)
    INTO v_creator_score, v_creator_ms
    FROM public.battle_answers WHERE battle_id = p_battle_id AND player_id = v_battle.creator_id;

    IF v_battle.mode = 'ai' THEN
        SELECT COUNT(*) FILTER (WHERE (e->>'correct')::BOOLEAN), COALESCE(SUM((e->>'ms')::INTEGER), 0)
        INTO v_opponent_score, v_opponent_ms
        FROM jsonb_array_elements(v_battle.bot_results) AS e;
    ELSE
        SELECT COUNT(*) FILTER (WHERE is_correct), COALESCE(SUM(time_ms), 0)
        INTO v_opponent_score, v_opponent_ms
        FROM public.battle_answers WHERE battle_id = p_battle_id AND player_id = v_battle.opponent_id;
    END IF;

    IF v_creator_score > v_opponent_score OR (v_creator_score = v_opponent_score AND v_creator_ms < v_opponent_ms) THEN
        v_side := 'creator';
        v_winner := v_battle.creator_id;
    ELSIF v_opponent_score > v_creator_score OR (v_creator_score = v_opponent_score AND v_opponent_ms < v_creator_ms) THEN
        v_side := CASE WHEN v_battle.mode = 'ai' THEN 'bot' ELSE 'opponent' END;
        v_winner := v_battle.opponent_id;
    ELSE
        v_side := 'draw';
    END IF;

    -- Reward the winner, within the daily limit
    IF v_winner IS NOT NULL THEN
        v_day_start := date_trunc('day', NOW() AT TIME ZONE 'Asia/Tashkent') AT TIME ZONE 'Asia/Tashkent';

        PERFORM public.get_wallet_balance(v_winner);
        PERFORM 1 FROM public.wallets WHERE student_id = v_winner FOR UPDATE;

        SELECT COALESCE(SUM(amount), 0) INTO v_earned
        FROM public.transactions
        WHERE student_id = v_winner AND battle_id IS NOT NULL AND type = 'Earn' AND created_at >= v_day_start;

        v_reward := GREATEST(0, LEAST(c_reward, c_daily_limit - v_earned));

        IF v_reward > 0 THEN
            UPDATE public.wallets SET balance = balance + v_reward, updated_at = NOW() WHERE student_id = v_winner;

            INSERT INTO public.transactions (student_id, amount, type, description, created_by, battle_id)
            VALUES (v_winner, v_reward, 'Earn', 'Battle Arena', v_winner, p_battle_id);
        END IF;
    END IF;

    UPDATE public.battles
    SET status = 'finished', finished_at = NOW(), creator_score = v_creator_score, opponent_score = v_opponent_score,
        winner_side = v_side, reward = v_reward
    WHERE id = p_battle_id;

    RETURN jsonb_build_object(
        'success', true,
        'winner_side', v_side,
        'reward', v_reward,
        'creator_score', v_creator_score,
        'opponent_score', v_opponent_score
    );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_battle(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_battle(UUID) TO service_role;

-- =============================================================================
-- TRANSLATION OVERRIDES
-- The texts of the site live in the frontend files (ru, uz, en). When the admin changes a word in
-- Settings -> Translations, the new text is saved here and wins over the file. Everyone can read
-- them (the login page needs them too); only an admin can write, through the backend.
-- =============================================================================
CREATE TABLE IF NOT EXISTS translations (
  lang TEXT NOT NULL CHECK (lang IN ('ru', 'uz', 'en')),
  key TEXT NOT NULL CHECK (char_length(key) <= 200),
  value TEXT NOT NULL CHECK (char_length(value) <= 2000),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (lang, key)
);

-- =============================================================================
-- SECURITY (Row Level Security)
-- =============================================================================

-- Only the backend (service_role) may touch these tables; anon key gets nothing.
-- The right answers live in battle_questions: they must never be readable from the browser.
ALTER TABLE battle_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;
