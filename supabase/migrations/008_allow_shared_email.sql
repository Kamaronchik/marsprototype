-- =============================================================================
-- MARS SPACE - ONE EMAIL FOR SEVERAL PEOPLE
-- Several accounts (for example a parent's children) may use the same email address.
-- Login is by username, and the email is only where the confirmation code is sent.
-- Run once in Supabase -> SQL Editor. Safe to run again.
-- =============================================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
