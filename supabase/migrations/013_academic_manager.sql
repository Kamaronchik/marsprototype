-- =============================================================================
-- MARS SPACE - ACADEMIC MANAGER: lessons with topics, schedule, lesson ratings, AI reports.
-- Run once in Supabase -> SQL Editor, AFTER schema_learning.sql and schema_telegram.sql.
-- Safe to run again: everything uses IF NOT EXISTS / DROP IF EXISTS.
-- =============================================================================

-- 1. NEW ROLE: 'AcademicManager'
-- The constraint on users.role was made inline in schema.sql, so its name is not guaranteed.
-- We find every CHECK on users that mentions "role", drop it, and add a new one.
DO $$
DECLARE
  old_name TEXT;
BEGIN
  FOR old_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', old_name);
  END LOOP;
END $$;

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Admin', 'Teacher', 'Financier', 'Student', 'AcademicManager'));

-- 2. SCHEDULE: when a group has lessons (weekday 1 = Monday .. 7 = Sunday).
CREATE TABLE IF NOT EXISTS schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (end_time > start_time),
  UNIQUE (group_id, weekday, start_time)
);

-- 3. LESSONS: a lesson that took place. The topic is required.
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  topic TEXT NOT NULL CHECK (length(btrim(topic)) > 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (group_id, date)
);

-- 4. Attendance and homework can point to the lesson. Nullable: old rows stay as they are.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE homework ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;

-- 5. LESSON RATINGS: 1-5 from a student. One rating per student per lesson.
-- Anonymity: the backend never sends student_id to teachers or to the academic manager.
CREATE TABLE IF NOT EXISTS lesson_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (lesson_id, student_id)
);

-- 6. AI REPORTS: saved summaries, so Gemini is not called on every page open.
-- period is the day the report was made, e.g. "2026-11-12"; one report per target per day.
CREATE TABLE IF NOT EXISTS ai_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('student', 'teacher', 'group')),
  target_id UUID NOT NULL,
  period TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (type, target_id, period)
);

CREATE INDEX IF NOT EXISTS idx_schedule_group ON schedule(group_id);
CREATE INDEX IF NOT EXISTS idx_lessons_group_date ON lessons(group_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher ON lessons(teacher_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_lesson ON attendance(lesson_id);
CREATE INDEX IF NOT EXISTS idx_homework_lesson ON homework(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_ratings_student ON lesson_ratings(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_reports_target ON ai_reports(type, target_id, created_at DESC);

-- Only the backend (service_role) may touch these tables; the anon key gets nothing.
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;
