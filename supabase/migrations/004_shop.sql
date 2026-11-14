-- =============================================================================
-- MARS SPACE - COINS & REWARDS SHOP TABLES
-- Run once in Supabase -> SQL Editor, AFTER schema.sql and schema_academic.sql.
-- Then run rpc_shop.sql.
-- =============================================================================

-- 1. WALLETS
-- One balance per student. Changed only by the SQL functions in rpc_shop.sql.
CREATE TABLE IF NOT EXISTS wallets (
  student_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PRODUCTS
-- Archived instead of deleted, so old orders keep a valid link.
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  price INTEGER NOT NULL CHECK (price > 0),
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PURCHASE VERIFICATIONS
-- One row per checkout attempt: a hashed email code bound to a student and to the cart.
-- items is [{"productId": "...", "quantity": 2}]; prices are never stored here, they are read at confirm time.
-- Its id doubles as the idempotency key of the purchase.
CREATE TABLE IF NOT EXISTS purchase_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ORDERS
-- One order = one checkout (one or more products). total is the sum of its items.
-- verification_id is UNIQUE: one confirmed attempt can never create two orders.
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total INTEGER NOT NULL CHECK (total > 0),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Cancelled')),
  verification_id UUID NOT NULL UNIQUE REFERENCES purchase_verifications(id),
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 4b. ORDER ITEMS
-- Name, image and price are copied from the product at purchase time.
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

-- 5. TRANSACTIONS
-- Append-only ledger of every coin movement. amount is signed: Spend is negative.
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  type TEXT NOT NULL CHECK (type IN ('Earn', 'Spend', 'Refund')),
  description TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. AUDIT LOG
-- Who did what: awards, purchases, deliveries, refunds, product changes.
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TEACHER WALLETS
-- The coins a teacher can hand out. An admin tops it up; every award to a student takes from it.
CREATE TABLE IF NOT EXISTS teacher_wallets (
  teacher_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. TEACHER TRANSACTIONS
-- Append-only ledger of the teacher pool. Grant is positive, Award is negative.
CREATE TABLE IF NOT EXISTS teacher_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  type TEXT NOT NULL CHECK (type IN ('Grant', 'Award')),
  student_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR OPTIMIZATION
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_student ON orders(student_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_student ON transactions(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_giver ON transactions(created_by, student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_verifications_student ON purchase_verifications(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_transactions_teacher ON teacher_transactions(teacher_id, created_at DESC);

-- =============================================================================
-- AUTOMATION (Triggers)
-- =============================================================================

DROP TRIGGER IF EXISTS update_product_modtime ON products;
CREATE TRIGGER update_product_modtime
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- The ledger and the audit log can never be edited or deleted.
CREATE OR REPLACE FUNCTION forbid_ledger_change()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS transactions_append_only ON transactions;
CREATE TRIGGER transactions_append_only
BEFORE UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE PROCEDURE forbid_ledger_change();

DROP TRIGGER IF EXISTS teacher_transactions_append_only ON teacher_transactions;
CREATE TRIGGER teacher_transactions_append_only
BEFORE UPDATE OR DELETE ON teacher_transactions
FOR EACH ROW EXECUTE PROCEDURE forbid_ledger_change();

DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
CREATE TRIGGER audit_log_append_only
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE PROCEDURE forbid_ledger_change();

-- =============================================================================
-- SECURITY (Row Level Security)
-- =============================================================================

-- Only the backend (service_role) may touch these tables; anon key gets nothing.
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_transactions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STORAGE (product images)
-- =============================================================================

-- Public bucket: product pictures are shown to every student. Uploads go through the backend.
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-products', 'shop-products', true)
ON CONFLICT (id) DO NOTHING;
