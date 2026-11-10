-- =============================================================================
-- MARS SPACE - LEARNING: homework, grades (the AI tutor needs no tables).
-- Run once in Supabase -> SQL Editor, AFTER schema_academic.sql and schema_platform.sql.
-- Safe to run again: everything uses IF NOT EXISTS.
-- =============================================================================

-- 1. HOMEWORK: a task a teacher gives to one group.
CREATE TABLE IF NOT EXISTS homework (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date DATE,
  max_score INTEGER NOT NULL DEFAULT 10 CHECK (max_score BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SUBMISSIONS: one answer per student per homework; the student may resend until it is graded.
CREATE TABLE IF NOT EXISTS homework_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  homework_id UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer TEXT NOT NULL DEFAULT '',
  link TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  score INTEGER CHECK (score >= 0),
  feedback TEXT,
  graded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  graded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (homework_id, student_id)
);

-- 3. GRADES: every mark of a student. A graded homework writes its mark here too (submission_id),
-- a teacher can also add marks for a lesson, a test or a project.
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('homework', 'lesson', 'test', 'project')),
  title TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  max_score INTEGER NOT NULL DEFAULT 10 CHECK (max_score BETWEEN 1 AND 100),
  comment TEXT,
  submission_id UUID UNIQUE REFERENCES homework_submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (score <= max_score)
);

CREATE INDEX IF NOT EXISTS idx_homework_group ON homework(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_homework ON homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON homework_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grades_group ON grades(group_id);

-- Only the backend (service_role) may touch these tables; the anon key gets nothing.
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
