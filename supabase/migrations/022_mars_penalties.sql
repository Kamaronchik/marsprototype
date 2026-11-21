-- =============================================================================
-- MARS SPACE - PENALTIES: the rules of Mars for mentors (version 27.04.2026), picked by an auditor by hand.
-- A penalty is a violation with details.source = 'audit'; no new table is needed.
-- The server also adds these rows by itself (penaltyController.ensureMarsRules), so this file is for a fresh database.
-- Run once in Supabase -> SQL Editor, AFTER 021_applications_form.sql. Safe to run again.
-- =============================================================================

INSERT INTO audit_rules (code, title, severity, levels, fine_amount) VALUES
  ('MARS_1_1', 'Mars rule 1.1', 'low', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_1_2', 'Mars rule 1.2', 'low', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_1_3', 'Mars rule 1.3', 'low', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_2_1', 'Mars rule 2.1', 'medium', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_2_2', 'Mars rule 2.2', 'medium', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_2_3', 'Mars rule 2.3', 'medium', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_2_4', 'Mars rule 2.4', 'medium', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_2_5', 'Mars rule 2.5', 'medium', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_2_6', 'Mars rule 2.6', 'medium', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_2_7', 'Mars rule 2.7', 'medium', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_3_1', 'Mars rule 3.1', 'high', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_3_2', 'Mars rule 3.2', 'high', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_3_3', 'Mars rule 3.3', 'high', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_3_4', 'Mars rule 3.4', 'high', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_3_5', 'Mars rule 3.5', 'high', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_3_6', 'Mars rule 3.6', 'high', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_3_7', 'Mars rule 3.7', 'high', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_3_8', 'Mars rule 3.8', 'high', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_3_9', 'Mars rule 3.9', 'high', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_3_10', 'Mars rule 3.10', 'high', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_3_11', 'Mars rule 3.11', 'high', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_4_1', 'Mars rule 4.1', 'critical', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_4_2', 'Mars rule 4.2', 'critical', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_4_3', 'Mars rule 4.3', 'critical', '[{"afterMinutes":0,"to":["Owner"]}]', 0),
  ('MARS_4_4', 'Mars rule 4.4', 'critical', '[{"afterMinutes":0,"to":["Owner"]}]', 0)
ON CONFLICT (code) DO NOTHING;

-- The list of penalties filters by details->>source.
CREATE INDEX IF NOT EXISTS idx_violations_source ON violations ((details->>'source'), detected_at DESC);
