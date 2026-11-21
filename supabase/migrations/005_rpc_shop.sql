-- =============================================================================
-- ATOMIC SHOP FUNCTIONS
-- Run in Supabase -> SQL Editor, AFTER schema_shop.sql.
-- Every function runs as ONE transaction: any error rolls everything back.
-- All of them return JSONB: {success: true, ...} or {success: false, error: 'CODE'}.
-- =============================================================================

-- 1. READ A BALANCE (creates the wallet on first use)
CREATE OR REPLACE FUNCTION public.get_wallet_balance(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    INSERT INTO public.wallets (student_id) VALUES (p_student_id) ON CONFLICT DO NOTHING;

    SELECT balance INTO v_balance FROM public.wallets WHERE student_id = p_student_id;
    RETURN v_balance;
END;
$$;

-- 2. TEACHER POOL: READ AND TOP UP
CREATE OR REPLACE FUNCTION public.get_teacher_balance(p_teacher_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    INSERT INTO public.teacher_wallets (teacher_id) VALUES (p_teacher_id) ON CONFLICT DO NOTHING;

    SELECT balance INTO v_balance FROM public.teacher_wallets WHERE teacher_id = p_teacher_id;
    RETURN v_balance;
END;
$$;

-- Admin gives coins to a teacher; the teacher hands them out to students with award_coins.
CREATE OR REPLACE FUNCTION public.grant_teacher_coins(
    p_teacher_id UUID,
    p_amount INTEGER,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users WHERE id = p_admin_id AND role = 'Admin' AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users WHERE id = p_teacher_id AND role = 'Teacher' AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'TEACHER_NOT_FOUND');
    END IF;

    PERFORM public.get_teacher_balance(p_teacher_id);

    UPDATE public.teacher_wallets
    SET balance = balance + p_amount, updated_at = NOW()
    WHERE teacher_id = p_teacher_id
    RETURNING balance INTO v_balance;

    INSERT INTO public.teacher_transactions (teacher_id, amount, type, created_by)
    VALUES (p_teacher_id, p_amount, 'Grant', p_admin_id);

    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (p_admin_id, 'coins.grant', 'teacher_wallet', p_teacher_id, jsonb_build_object('amount', p_amount));

    RETURN jsonb_build_object('success', true, 'pool_balance', v_balance);
END;
$$;

-- 3. GIVE COINS TO A STUDENT
-- Admin: any amount to any student.
-- Teacher: only to a student of their active group, at most 50 coins per student per month
-- (the month is counted in Tashkent time), and only from the teacher's own pool.
CREATE OR REPLACE FUNCTION public.award_coins(
    p_student_id UUID,
    p_amount INTEGER,
    p_actor_id UUID,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    c_teacher_monthly_limit CONSTANT INTEGER := 50;
    v_actor_role TEXT;
    v_month_start TIMESTAMPTZ;
    v_given INTEGER;
    v_remaining INTEGER;
    v_balance INTEGER;
    v_pool INTEGER;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
    END IF;

    SELECT role INTO v_actor_role
    FROM public.users
    WHERE id = p_actor_id AND status = 'active';

    IF v_actor_role IS NULL OR v_actor_role NOT IN ('Admin', 'Teacher') THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_student_id AND role = 'Student' AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'STUDENT_NOT_FOUND');
    END IF;

    -- Lock the wallet first: awards to one student are processed one by one,
    -- so parallel requests cannot beat the monthly limit.
    INSERT INTO public.wallets (student_id) VALUES (p_student_id) ON CONFLICT DO NOTHING;
    PERFORM 1 FROM public.wallets WHERE student_id = p_student_id FOR UPDATE;

    IF v_actor_role = 'Teacher' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.group_students gs
            JOIN public.groups g ON g.id = gs.group_id
            WHERE gs.student_id = p_student_id
              AND g.teacher_id = p_actor_id
              AND g.status = 'active'
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'NOT_YOUR_STUDENT');
        END IF;

        v_month_start := date_trunc('month', NOW() AT TIME ZONE 'Asia/Tashkent') AT TIME ZONE 'Asia/Tashkent';

        SELECT COALESCE(SUM(amount), 0) INTO v_given
        FROM public.transactions
        WHERE student_id = p_student_id
          AND created_by = p_actor_id
          AND type = 'Earn'
          AND created_at >= v_month_start;

        v_remaining := c_teacher_monthly_limit - v_given;

        IF p_amount > v_remaining THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'LIMIT_EXCEEDED',
                'remaining', GREATEST(v_remaining, 0)
            );
        END IF;

        v_remaining := v_remaining - p_amount;

        -- The coins come out of the teacher's pool.
        PERFORM public.get_teacher_balance(p_actor_id);

        SELECT balance INTO v_pool
        FROM public.teacher_wallets
        WHERE teacher_id = p_actor_id
        FOR UPDATE;

        IF v_pool < p_amount THEN
            RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_POOL', 'pool_balance', v_pool);
        END IF;

        UPDATE public.teacher_wallets
        SET balance = balance - p_amount, updated_at = NOW()
        WHERE teacher_id = p_actor_id
        RETURNING balance INTO v_pool;

        INSERT INTO public.teacher_transactions (teacher_id, amount, type, student_id, created_by)
        VALUES (p_actor_id, -p_amount, 'Award', p_student_id, p_actor_id);
    END IF;

    UPDATE public.wallets
    SET balance = balance + p_amount, updated_at = NOW()
    WHERE student_id = p_student_id
    RETURNING balance INTO v_balance;

    INSERT INTO public.transactions (student_id, amount, type, description, created_by)
    VALUES (p_student_id, p_amount, 'Earn', p_description, p_actor_id);

    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (p_actor_id, 'coins.award', 'wallet', p_student_id, jsonb_build_object('amount', p_amount));

    RETURN jsonb_build_object('success', true, 'balance', v_balance, 'remaining', v_remaining, 'pool_balance', v_pool);
END;
$$;

-- 4. PRICE A CART
-- Used by the two purchase functions below, so both count the same way.
-- Checks the shape of the cart (1-20 different products, 1-10 pieces each) and that every
-- product exists and is for sale. The price always comes from the products table.
CREATE OR REPLACE FUNCTION public.price_cart(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_count INTEGER;
    v_distinct INTEGER;
    v_valid_quantity INTEGER;
    v_for_sale INTEGER;
    v_total INTEGER;
    v_summary TEXT;
BEGIN
    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_ITEMS');
    END IF;

    SELECT COUNT(*),
           COUNT(DISTINCT c."productId"),
           COUNT(*) FILTER (WHERE c.quantity BETWEEN 1 AND 10),
           COUNT(*) FILTER (WHERE p.is_available AND NOT p.is_archived),
           COALESCE(SUM(p.price * c.quantity), 0),
           string_agg(c.quantity || ' x ' || p.name, ', ' ORDER BY p.name)
    INTO v_count, v_distinct, v_valid_quantity, v_for_sale, v_total, v_summary
    FROM jsonb_to_recordset(p_items) AS c("productId" UUID, quantity INTEGER)
    LEFT JOIN public.products p ON p.id = c."productId";

    IF v_count <> v_distinct OR v_count <> v_valid_quantity THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_ITEMS');
    END IF;

    IF v_count <> v_for_sale THEN
        RETURN jsonb_build_object('success', false, 'error', 'PRODUCT_UNAVAILABLE');
    END IF;

    RETURN jsonb_build_object('success', true, 'total', v_total, 'summary', v_summary);
END;
$$;

-- 5. START A PURCHASE
-- Checks the cart and the balance, then stores the hashed email code.
-- A student has one live code at a time and may ask for a new one once per minute.
CREATE OR REPLACE FUNCTION public.create_purchase_verification(
    p_student_id UUID,
    p_items JSONB,
    p_code_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_cart JSONB;
    v_balance INTEGER;
    v_last_sent TIMESTAMPTZ;
    v_wait INTEGER;
    v_verification RECORD;
BEGIN
    v_cart := public.price_cart(p_items);

    IF NOT (v_cart->>'success')::BOOLEAN THEN
        RETURN v_cart;
    END IF;

    v_balance := public.get_wallet_balance(p_student_id);

    IF v_balance < (v_cart->>'total')::INTEGER THEN
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_COINS');
    END IF;

    SELECT MAX(created_at) INTO v_last_sent
    FROM public.purchase_verifications
    WHERE student_id = p_student_id;

    v_wait := CEIL(60 - EXTRACT(EPOCH FROM (NOW() - v_last_sent)));

    IF v_wait > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'TOO_SOON', 'wait_seconds', v_wait);
    END IF;

    UPDATE public.purchase_verifications
    SET is_used = true
    WHERE student_id = p_student_id AND is_used = false;

    INSERT INTO public.purchase_verifications (student_id, items, code_hash, expires_at)
    VALUES (p_student_id, p_items, p_code_hash, NOW() + INTERVAL '5 minutes')
    RETURNING * INTO v_verification;

    RETURN jsonb_build_object(
        'success', true,
        'verification_id', v_verification.id,
        'expires_at', v_verification.expires_at,
        'summary', v_cart->>'summary',
        'total', (v_cart->>'total')::INTEGER
    );
END;
$$;

-- 6. CONFIRM A PURCHASE
-- Checks the code, then in the same transaction: re-reads the prices and the balance from the
-- database, takes the coins, creates the Pending order with its items and writes the Spend transaction.
-- Sending the same request again returns the same order and takes nothing twice.
CREATE OR REPLACE FUNCTION public.confirm_purchase(
    p_verification_id UUID,
    p_student_id UUID,
    p_code_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    c_max_attempts CONSTANT INTEGER := 5;
    v_verification RECORD;
    v_cart JSONB;
    v_total INTEGER;
    v_order_id UUID;
    v_balance INTEGER;
BEGIN
    -- 1. Lock this attempt: parallel confirms of the same code wait here
    SELECT * INTO v_verification
    FROM public.purchase_verifications
    WHERE id = p_verification_id AND student_id = p_student_id
    FOR UPDATE;

    IF v_verification IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VERIFICATION_NOT_FOUND');
    END IF;

    -- 2. Already confirmed: repeat the answer, do not charge again
    IF v_verification.is_used THEN
        SELECT id INTO v_order_id FROM public.orders WHERE verification_id = v_verification.id;

        IF v_order_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'already_done', true,
                'order_id', v_order_id,
                'balance', public.get_wallet_balance(p_student_id)
            );
        END IF;

        RETURN jsonb_build_object('success', false, 'error', 'CODE_USED');
    END IF;

    -- 3. Code checks
    IF v_verification.expires_at <= NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'CODE_EXPIRED');
    END IF;

    IF v_verification.attempts >= c_max_attempts THEN
        RETURN jsonb_build_object('success', false, 'error', 'TOO_MANY_ATTEMPTS');
    END IF;

    IF v_verification.code_hash <> p_code_hash THEN
        UPDATE public.purchase_verifications
        SET attempts = attempts + 1,
            is_used = (attempts + 1 >= c_max_attempts)
        WHERE id = v_verification.id;

        IF v_verification.attempts + 1 >= c_max_attempts THEN
            RETURN jsonb_build_object('success', false, 'error', 'TOO_MANY_ATTEMPTS');
        END IF;

        RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
    END IF;

    -- 4. Re-read the products (locked in a fixed order): the prices always come from the database
    PERFORM 1
    FROM public.products
    WHERE id IN (SELECT c."productId" FROM jsonb_to_recordset(v_verification.items) AS c("productId" UUID))
    ORDER BY id
    FOR SHARE;

    v_cart := public.price_cart(v_verification.items);

    IF NOT (v_cart->>'success')::BOOLEAN THEN
        RETURN v_cart;
    END IF;

    v_total := (v_cart->>'total')::INTEGER;

    -- 5. Lock the wallet and re-check the balance
    PERFORM public.get_wallet_balance(p_student_id);

    SELECT balance INTO v_balance
    FROM public.wallets
    WHERE student_id = p_student_id
    FOR UPDATE;

    IF v_balance < v_total THEN
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_COINS');
    END IF;

    -- 6. Take the coins, create the order, write the ledger
    UPDATE public.wallets
    SET balance = balance - v_total, updated_at = NOW()
    WHERE student_id = p_student_id
    RETURNING balance INTO v_balance;

    UPDATE public.purchase_verifications SET is_used = true WHERE id = v_verification.id;

    INSERT INTO public.orders (student_id, total, verification_id)
    VALUES (p_student_id, v_total, v_verification.id)
    RETURNING id INTO v_order_id;

    INSERT INTO public.order_items (order_id, product_id, product_name, product_image_url, unit_price, quantity)
    SELECT v_order_id, p.id, p.name, p.image_url, p.price, c.quantity
    FROM jsonb_to_recordset(v_verification.items) AS c("productId" UUID, quantity INTEGER)
    JOIN public.products p ON p.id = c."productId";

    INSERT INTO public.transactions (student_id, amount, type, description, order_id, created_by)
    VALUES (p_student_id, -v_total, 'Spend', v_cart->>'summary', v_order_id, p_student_id);

    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (p_student_id, 'order.create', 'order', v_order_id, jsonb_build_object('total', v_total));

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'balance', v_balance);
END;
$$;

-- 7. CONFIRM DELIVERY (Pending -> Completed)
CREATE OR REPLACE FUNCTION public.deliver_order(p_order_id UUID, p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_order RECORD;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.users WHERE id = p_admin_id AND role = 'Admin' AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
    END IF;

    IF v_order.status <> 'Pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_PENDING', 'status', v_order.status);
    END IF;

    UPDATE public.orders
    SET status = 'Completed', completed_at = NOW(), completed_by = p_admin_id
    WHERE id = p_order_id;

    INSERT INTO public.audit_log (actor_id, action, entity, entity_id)
    VALUES (p_admin_id, 'order.deliver', 'order', p_order_id);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. CANCEL AN ORDER (Pending -> Cancelled) AND REFUND THE COINS
-- An admin may cancel any Pending order; a student only their own.
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID, p_actor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_actor_role TEXT;
    v_order RECORD;
    v_summary TEXT;
BEGIN
    SELECT role INTO v_actor_role
    FROM public.users
    WHERE id = p_actor_id AND status = 'active';

    IF v_actor_role IS NULL OR v_actor_role NOT IN ('Admin', 'Student') THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

    -- A student must not learn that someone else's order exists
    IF v_order IS NULL OR (v_actor_role = 'Student' AND v_order.student_id <> p_actor_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
    END IF;

    IF v_order.status <> 'Pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_PENDING', 'status', v_order.status);
    END IF;

    SELECT string_agg(quantity || ' x ' || product_name, ', ' ORDER BY product_name) INTO v_summary
    FROM public.order_items
    WHERE order_id = p_order_id;

    UPDATE public.wallets
    SET balance = balance + v_order.total, updated_at = NOW()
    WHERE student_id = v_order.student_id;

    UPDATE public.orders
    SET status = 'Cancelled', cancelled_at = NOW(), cancelled_by = p_actor_id
    WHERE id = p_order_id;

    INSERT INTO public.transactions (student_id, amount, type, description, order_id, created_by)
    VALUES (v_order.student_id, v_order.total, 'Refund', v_summary, p_order_id, p_actor_id);

    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (p_actor_id, 'order.cancel', 'order', p_order_id, jsonb_build_object('refund', v_order.total));

    RETURN jsonb_build_object('success', true);
END;
$$;

-- =============================================================================
-- ACCESS CONTROL
-- =============================================================================

REVOKE ALL ON FUNCTION public.get_wallet_balance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_teacher_balance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_teacher_coins(UUID, INTEGER, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_coins(UUID, INTEGER, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.price_cart(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_purchase_verification(UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_purchase(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deliver_order(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_order(UUID, UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_teacher_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_teacher_coins(UUID, INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_coins(UUID, INTEGER, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.price_cart(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_purchase_verification(UUID, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_purchase(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.deliver_order(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, UUID) TO service_role;
