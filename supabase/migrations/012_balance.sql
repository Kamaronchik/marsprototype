-- =============================================================================
-- MARS SPACE - STUDENT BALANCE AND FREEZE
-- 1. users.status gets a third value: 'frozen' (student on pause: not marked, not charged).
-- 2. users.balance: money of a student, in sum. An admin tops it up.
-- 3. Every lesson mark takes 90 000 sum from the balance (once per lesson record).
-- Run once in Supabase -> SQL Editor. Safe to run again.
-- =============================================================================

-- 1. FROZEN STATUS
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%blocked%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'blocked', 'frozen'));

-- 2. BALANCE
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(14,0) NOT NULL DEFAULT 0;

-- Every change of a balance: kind 'topup' (+) or 'lesson' (-). amount is signed.
CREATE TABLE IF NOT EXISTS balance_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(14,0) NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('topup', 'lesson')),
  attendance_id UUID REFERENCES attendance(id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_tx_student ON balance_transactions(student_id, created_at DESC);
-- One lesson record can be charged only once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_tx_lesson_once ON balance_transactions(attendance_id) WHERE kind = 'lesson';

ALTER TABLE balance_transactions ENABLE ROW LEVEL SECURITY;

-- Changes the balance and writes the history in one step. Returns the new balance,
-- or NULL when this lesson was already charged.
CREATE OR REPLACE FUNCTION change_balance(
  p_student_id UUID, p_amount NUMERIC, p_kind TEXT, p_attendance_id UUID, p_note TEXT, p_by UUID
) RETURNS NUMERIC AS $$
DECLARE v_balance NUMERIC;
BEGIN
  IF p_kind = 'lesson' THEN
    INSERT INTO balance_transactions (student_id, amount, kind, attendance_id, note, created_by)
    VALUES (p_student_id, p_amount, p_kind, p_attendance_id, p_note, p_by)
    ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN RETURN NULL; END IF;
  ELSE
    INSERT INTO balance_transactions (student_id, amount, kind, note, created_by)
    VALUES (p_student_id, p_amount, p_kind, p_note, p_by);
  END IF;

  UPDATE users SET balance = balance + p_amount WHERE id = p_student_id RETURNING balance INTO v_balance;
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;
