-- =============================================================================
-- MARS SPACE - JOB APPLICATIONS from the (future) Careers site, handled inside the CRM.
-- Run once in Supabase -> SQL Editor, AFTER 015_expenses.sql. Safe to run again.
-- =============================================================================

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL CHECK (length(btrim(full_name)) > 0),
  contact TEXT NOT NULL CHECK (length(btrim(contact)) > 0),  -- phone, Telegram or e-mail
  position TEXT NOT NULL CHECK (length(btrim(position)) > 0), -- the vacancy
  message TEXT,
  resume_path TEXT,                                           -- file inside the private "resumes" bucket
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'interview', 'accepted', 'rejected')),
  account_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- the account made after "accepted"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS application_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  text TEXT NOT NULL CHECK (length(btrim(text)) > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_created ON job_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_application_notes_app ON application_notes(application_id, created_at);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_notes ENABLE ROW LEVEL SECURITY;

-- Private bucket for the resumes: nobody can read a file without a signed link made by the server.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('resumes', 'resumes', false, 5242880)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880;
