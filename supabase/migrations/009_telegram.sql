-- =============================================================================
-- MARS SPACE - TELEGRAM ASSISTANT: links, one-time link tokens, the message log
-- and the "why were you absent?" questions.
-- Run once in Supabase -> SQL Editor, AFTER schema_platform.sql.
-- Safe to run again: everything uses IF NOT EXISTS.
-- =============================================================================

-- 1. LINKS
-- One row per student who connected Telegram. chat_id is the private chat with the bot.
CREATE TABLE IF NOT EXISTS telegram_links (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL UNIQUE,
  language TEXT NOT NULL DEFAULT 'ru' CHECK (language IN ('ru', 'uz', 'en')),
  linked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. LINK TOKENS
-- The student presses "Connect Telegram" on the site and gets a link with a one-time token.
-- Only the hash is stored, like the sessions: a leaked table cannot be used to link an account.
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_telegram_tokens_user ON telegram_link_tokens(user_id);

-- 3. MESSAGE LOG
-- Everything said between a student and the bot. The admin reads it in the "Telegram" tab.
-- direction: 'in' = student to bot, 'out' = bot to student.
-- kind: 'text' (plain), 'ai' (answer written by the model), 'absence_question', 'absence_reason', 'system'.
CREATE TABLE IF NOT EXISTS telegram_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'ai', 'absence_question', 'absence_reason', 'system')),
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_user ON telegram_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_recent ON telegram_messages(created_at DESC);

-- 4. ABSENCE QUESTIONS
-- When a teacher marks a student absent, the bot asks why. The answer is stored here, copied to
-- attendance.absence_reason, and shown to the admin. One question per attendance record.
CREATE TABLE IF NOT EXISTS telegram_absences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attendance_id UUID NOT NULL UNIQUE REFERENCES attendance(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'asked' CHECK (status IN ('asked', 'answered', 'cancelled')),
  reason TEXT,
  asked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_telegram_absences_student ON telegram_absences(student_id, status);

-- 5. SECURITY: like every other table, only the server (service role) may touch these.
ALTER TABLE telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_absences ENABLE ROW LEVEL SECURITY;
