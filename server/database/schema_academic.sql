-- =============================================================================
-- MARS SPACE - ACADEMIC TABLES (groups, attendance, payments, announcements)
-- Run once in Supabase -> SQL Editor, AFTER schema.sql.
-- =============================================================================

-- Groups (a class led by one teacher)
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  schedule TEXT,                                   -- e.g. "Mon/Wed/Fri 18:00"
  monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Which students are in which group
CREATE TABLE IF NOT EXISTS group_students (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (group_id, student_id)
);

-- One row per student per lesson day
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (group_id, student_id, lesson_date)
);

-- Student payments (kept even if a group is deleted)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  period TEXT NOT NULL,                            -- month paid for, e.g. "2026-11"
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'card', 'transfer')),
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Announcements shown to users
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'Teacher', 'Financier', 'Student')),
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_teacher ON groups(teacher_id);
CREATE INDEX IF NOT EXISTS idx_group_students_student ON group_students(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_group_date ON attendance(group_id, lesson_date);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);

-- Only the backend (service_role) may touch these tables; anon key gets nothing.
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
