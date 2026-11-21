-- =============================================================================
-- MARS SPACE - FINES: the audit system fines a worker by itself when a warning is ignored.
-- Run once in Supabase -> SQL Editor, AFTER 019_auditor_role.sql. Safe to run again.
-- =============================================================================

-- 1. How much a rule fines (in sum). 0 = the rule does not fine.
ALTER TABLE audit_rules ADD COLUMN IF NOT EXISTS fine_amount INTEGER NOT NULL DEFAULT 0 CHECK (fine_amount >= 0);
UPDATE audit_rules SET fine_amount = 50000 WHERE code = 'ATT_LATE' AND fine_amount = 0 AND updated_by IS NULL;

-- 2. FINES. One fine per violation.
-- issued    = made by the system, waiting for the CEO
-- deducted  = the CEO took it from the salary
-- cancelled = the CEO (or a false alarm) cancelled it
CREATE TABLE IF NOT EXISTS fines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  violation_id UUID NOT NULL UNIQUE REFERENCES violations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rule_code TEXT NOT NULL REFERENCES audit_rules(code) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'deducted', 'cancelled')),
  details JSONB NOT NULL DEFAULT '{}',
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  comment TEXT
);
CREATE INDEX IF NOT EXISTS idx_fines_status ON fines(status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_fines_user ON fines(user_id, issued_at DESC);

ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
