-- =============================================================================
-- MARS SPACE - indexes for the Audit Logs page (filter by user, action, date).
-- Run once in Supabase -> SQL Editor, AFTER 016_careers.sql. Safe to run again.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, created_at DESC);
