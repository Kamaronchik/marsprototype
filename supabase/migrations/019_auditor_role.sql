-- =============================================================================
-- MARS SPACE - AUDITOR ROLE: a person who reads the audit journal and the violations (read only).
-- The CEO (role 'Owner') creates auditors, admins and financiers in the CEO panel.
-- Run once in Supabase -> SQL Editor, AFTER 018_audit_system.sql. Safe to run again.
-- =============================================================================

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
  CHECK (role IN ('Admin', 'Teacher', 'Financier', 'Student', 'AcademicManager', 'Owner', 'Auditor'));
