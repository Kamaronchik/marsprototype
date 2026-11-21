-- =============================================================================
-- MARS SPACE - PLATFORM 2.0: groups with rooms and time slots, attendance marks,
-- notifications, student payment status, teacher salaries.
-- Run once in Supabase -> SQL Editor, AFTER schema.sql and schema_academic.sql.
-- Safe to run again: everything uses IF NOT EXISTS / OR REPLACE.
-- =============================================================================

-- 1. STUDENT PAYMENT STATUS
-- 'debtor' = has not paid. An admin or financier switches it back to 'active' after a payment.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'active'
  CHECK (payment_status IN ('active', 'debtor'));

CREATE INDEX IF NOT EXISTS idx_users_payment_status ON users(payment_status);

-- 2. GROUPS: ROOM, WEEKDAYS, START TIME
-- room is A1..C4; weekdays are 1 (Monday) .. 7 (Sunday); start_time is the lesson start.
-- teacher_id (already in the table) is the head teacher of the group.
ALTER TABLE groups ADD COLUMN IF NOT EXISTS room TEXT CHECK (room ~ '^[A-C][1-4]$');
ALTER TABLE groups ADD COLUMN IF NOT EXISTS weekdays SMALLINT[] NOT NULL DEFAULT '{}';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS start_time TIME CHECK (start_time >= TIME '09:00' AND start_time < TIME '22:00');

-- Two active groups cannot have the same name (A and a count as the same).
-- An archived group frees its name.
DROP INDEX IF EXISTS idx_groups_name_unique;
CREATE UNIQUE INDEX idx_groups_name_unique ON groups (lower(name)) WHERE status = 'active';

-- A room or a teacher cannot be in two active groups at the same weekday and time.
-- The error text (ROOM_BUSY / TEACHER_BUSY) is read by the backend.
CREATE OR REPLACE FUNCTION check_group_schedule()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status <> 'active' OR NEW.start_time IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.room IS NOT NULL AND EXISTS (
        SELECT 1 FROM groups g
        WHERE g.id <> NEW.id AND g.status = 'active'
          AND g.room = NEW.room AND g.start_time = NEW.start_time AND g.weekdays && NEW.weekdays
    ) THEN
        RAISE EXCEPTION 'ROOM_BUSY';
    END IF;

    IF NEW.teacher_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM groups g
        WHERE g.id <> NEW.id AND g.status = 'active'
          AND g.teacher_id = NEW.teacher_id AND g.start_time = NEW.start_time AND g.weekdays && NEW.weekdays
    ) THEN
        RAISE EXCEPTION 'TEACHER_BUSY';
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS groups_schedule_check ON groups;
CREATE TRIGGER groups_schedule_check
BEFORE INSERT OR UPDATE ON groups
FOR EACH ROW EXECUTE PROCEDURE check_group_schedule();

-- 3. ATTENDANCE
-- One row per student per lesson day (table from schema_academic.sql). The teacher marks
-- 'present' (tick) or 'absent' (cross). If a student is absent, the Telegram bot asks for the reason.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS absence_reason TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS reason_requested_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS reason_received_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_attendance_modtime ON attendance;
CREATE TRIGGER update_attendance_modtime
BEFORE UPDATE ON attendance
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, lesson_date DESC);

-- 4. NOTIFICATIONS
-- type + data are turned into text by the frontend (so every language works).
-- dedupe_key stops the same reminder from being created twice.
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  dedupe_key TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- 5. TEACHER SALARIES
CREATE TABLE IF NOT EXISTS teacher_salaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  period TEXT NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),   -- month paid for, e.g. "2026-11"
  note TEXT,
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_salaries_teacher ON teacher_salaries(teacher_id, period DESC);

-- =============================================================================
-- SECURITY (Row Level Security)
-- =============================================================================

-- Only the backend (service_role) may touch these tables; anon key gets nothing.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_salaries ENABLE ROW LEVEL SECURITY;
