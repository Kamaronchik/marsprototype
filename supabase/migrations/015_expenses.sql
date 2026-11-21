-- =============================================================================
-- MARS SPACE - EXPENSES of the school (rent, advertising ...). Financier and Admin only.
-- Run once in Supabase -> SQL Editor, AFTER 014_subjects.sql. Safe to run again.
-- Teacher salaries stay in teacher_salaries; the category 'salaries' here is for other staff.
-- =============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL CHECK (category IN ('rent', 'salaries', 'advertising', 'utilities', 'materials', 'other')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  comment TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category, expense_date DESC);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
