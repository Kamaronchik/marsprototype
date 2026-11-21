-- =============================================================================
-- MARS SPACE - APPLICATION FORM on the site: e-mail of the candidate, the language
-- of the form, and which decision the candidate was already told by e-mail.
-- Run once in Supabase -> SQL Editor, AFTER 020_fines.sql. Safe to run again.
-- =============================================================================

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'ru' CHECK (language IN ('ru', 'uz', 'en')),
  -- 'accepted' or 'rejected' once the letter about that decision went out; NULL = no letter yet.
  ADD COLUMN IF NOT EXISTS decision_emailed TEXT CHECK (decision_emailed IN ('accepted', 'rejected'));
