-- =============================================================================
-- MARS SPACE - SUBJECTS: one group = one subject.
-- Run once in Supabase -> SQL Editor, AFTER 013_academic_manager.sql. Safe to run again.
-- =============================================================================

-- name is the main title; name_ru / name_uz / name_en are optional translations.
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  name_ru TEXT,
  name_uz TEXT,
  name_en TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Two subjects cannot have the same name (A and a count as the same).
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_name_unique ON subjects (lower(name));

-- The subject of a group. Nullable: old groups have none until someone picks one.
-- If a subject is deleted, its groups stay and simply have no subject.
ALTER TABLE groups ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_groups_subject ON groups(subject_id);

-- Only the backend (service_role) may touch this table; the anon key gets nothing.
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
