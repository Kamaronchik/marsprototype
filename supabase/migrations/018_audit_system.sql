-- =============================================================================
-- MARS SPACE - AUDIT SYSTEM: Owner role, a stronger audit_log, rules, violations.
-- Run once in Supabase -> SQL Editor, AFTER 017_audit_indexes.sql. Safe to run again.
-- =============================================================================

-- 1. NEW ROLE: 'Owner'
-- Same trick as in 013: find every CHECK on users that mentions "role", drop it, add a new one.
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
  CHECK (role IN ('Admin', 'Teacher', 'Financier', 'Student', 'AcademicManager', 'Owner'));

-- 2. AUDIT LOG: more fields. Who (role at that moment), from where, before and after, why.
-- created_at already comes from the database clock (DEFAULT NOW()), never from the browser.
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS old_value JSONB,
  ADD COLUMN IF NOT EXISTS new_value JSONB,
  ADD COLUMN IF NOT EXISTS reason_code TEXT,
  ADD COLUMN IF NOT EXISTS reason_comment TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_role ON audit_log(actor_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ip ON audit_log(ip_address, created_at DESC);

-- The role of the actor is written by the database itself, so the server cannot forget it.
CREATE OR REPLACE FUNCTION audit_fill_actor_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.actor_role IS NULL AND NEW.actor_id IS NOT NULL THEN
    SELECT role INTO NEW.actor_role FROM users WHERE id = NEW.actor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_fill_role ON audit_log;
CREATE TRIGGER audit_log_fill_role
BEFORE INSERT ON audit_log
FOR EACH ROW EXECUTE PROCEDURE audit_fill_actor_role();

-- 3. THE LOG CANNOT BE CHANGED, BY ANYONE.
-- 004 already blocks UPDATE and DELETE with a trigger. Here: TRUNCATE too, and the rights are taken away.
DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
CREATE TRIGGER audit_log_no_truncate
BEFORE TRUNCATE ON audit_log
FOR EACH STATEMENT EXECUTE PROCEDURE forbid_ledger_change();

REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM anon, authenticated, service_role;

-- 4. TRIGGERS ON ATTENDANCE AND GRADES
-- Every change of a mark creates a log row by itself, even if the application forgets to log it
-- (or someone changes the table directly). The action starts with "db." - only the Owner reads these.
CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS TRIGGER AS $$
DECLARE
  old_j JSONB;
  new_j JSONB;
  src JSONB;
  who UUID;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_j := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_j := to_jsonb(NEW); END IF;

  -- An update that changed nothing but the timestamp is not a change.
  IF TG_OP = 'UPDATE' AND (new_j - 'updated_at') = (old_j - 'updated_at') THEN
    RETURN NULL;
  END IF;

  src := COALESCE(new_j, old_j);
  who := COALESCE(src->>'marked_by', src->>'teacher_id')::uuid;

  INSERT INTO audit_log (actor_id, action, entity, entity_id, old_value, new_value)
  VALUES (who, 'db.' || TG_TABLE_NAME || '.' || lower(TG_OP), TG_TABLE_NAME, (src->>'id')::uuid, old_j, new_j);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attendance_audit ON attendance;
CREATE TRIGGER attendance_audit
AFTER INSERT OR UPDATE OR DELETE ON attendance
FOR EACH ROW EXECUTE PROCEDURE audit_row_change();

DROP TRIGGER IF EXISTS grades_audit ON grades;
CREATE TRIGGER grades_audit
AFTER INSERT OR UPDATE OR DELETE ON grades
FOR EACH ROW EXECUTE PROCEDURE audit_row_change();

-- 5. RULES
-- levels: who is told and when. afterMinutes is counted from the start of the lesson.
-- Example: [{"afterMinutes":15,"to":["Teacher"]},{"afterMinutes":45,"to":["AcademicManager"]}]
-- The first level is also the moment the violation is found.
CREATE TABLE IF NOT EXISTS audit_rules (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  levels JSONB NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO audit_rules (code, title, severity, levels) VALUES (
  'ATT_LATE',
  'Attendance is not marked after the lesson started',
  'medium',
  '[{"afterMinutes":15,"to":["Teacher"]},{"afterMinutes":45,"to":["AcademicManager"]},{"afterMinutes":1440,"to":["Owner"]}]'
) ON CONFLICT (code) DO NOTHING;

-- 6. VIOLATIONS
-- dedupe_key keeps one violation per rule, group and day. level = the last level that was told (-1 = none yet).
CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_code TEXT NOT NULL REFERENCES audit_rules(code) ON DELETE RESTRICT,
  dedupe_key TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity TEXT,
  entity_id UUID,
  subject_date DATE,
  details JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'escalated', 'resolved', 'dismissed')),
  level SMALLINT NOT NULL DEFAULT -1,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_comment TEXT,
  reaction_seconds INTEGER
);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_user ON violations(user_id, detected_at DESC);

-- 7. VIOLATION EVENTS: the chain "rule -> warning -> reaction -> closing", and who was told through which channel.
-- kind: detected, notified, escalated, acknowledged, resolved, dismissed
CREATE TABLE IF NOT EXISTS violation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  violation_id UUID NOT NULL REFERENCES violations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('detected', 'notified', 'escalated', 'acknowledged', 'resolved', 'dismissed')),
  level SMALLINT,
  recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
  channel TEXT CHECK (channel IN ('bell', 'telegram')),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_violation_events_violation ON violation_events(violation_id, created_at);

-- 8. SECURITY: the browser never reads these tables, only our server (service_role).
ALTER TABLE audit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_events ENABLE ROW LEVEL SECURITY;
