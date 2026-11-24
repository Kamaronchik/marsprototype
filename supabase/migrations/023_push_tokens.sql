-- MARS SPACE - PUSH NOTIFICATIONS (Firebase Cloud Messaging)
-- One row = one browser that agreed to get push notifications.
-- language = the site language in that browser, so the push text is in the same language.

CREATE TABLE IF NOT EXISTS push_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'ru' CHECK (language IN ('ru', 'uz', 'en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens (user_id);

-- Only the server (secret key) reads and writes this table.
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
