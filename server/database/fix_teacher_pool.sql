-- =============================================================================
-- FIX: "50 coins per student per month" was meant to refill the TEACHER's pool
-- (so a teacher with 10 students gets 500 coins a month to hand out as they like),
-- not a cap on how much one student can receive. This migration:
--   1. Removes the per-student monthly cap from award_coins (the pool itself is
--      still the only limit: a teacher can never hand out more than they have).
--   2. Adds the monthly top-up the admin runs by hand: +50 coins per active
--      student to every active teacher's pool, once per calendar month.
-- Run in Supabase -> SQL Editor, AFTER rpc_shop.sql. Safe to run again.
-- =============================================================================

-- 1. award_coins: same as before, minus the LIMIT_EXCEEDED check and its bookkeeping.
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
    v_actor_role TEXT;
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

        -- The coins come out of the teacher's pool. No per-student cap: the pool itself
        -- (refilled monthly, see top_up_teacher_pools below) is the only limit.
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

    RETURN jsonb_build_object('success', true, 'balance', v_balance, 'pool_balance', v_pool);
END;
$$;

-- 2. One row per calendar month the top-up was run, so a second click in the same
-- month is refused instead of silently doubling every teacher's pool.
CREATE TABLE IF NOT EXISTS teacher_pool_topups (
  month TEXT PRIMARY KEY, -- 'YYYY-MM', in Tashkent time
  coins_per_student INTEGER NOT NULL,
  teacher_count INTEGER NOT NULL,
  total_coins INTEGER NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
ALTER TABLE teacher_pool_topups ENABLE ROW LEVEL SECURITY;

-- 3. What the top-up WOULD do, without changing anything: one row per active teacher,
-- their active student count and the coins they would receive. The admin sees this
-- before pressing the real button.
CREATE OR REPLACE FUNCTION public.preview_teacher_pool_topup(p_coins_per_student INTEGER DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_month TEXT := to_char(NOW() AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM');
    v_rows JSONB;
    v_already RECORD;
BEGIN
    SELECT * INTO v_already FROM public.teacher_pool_topups WHERE month = v_month;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'teacherId', t.id,
        'teacherName', t.full_name,
        'students', t.student_count,
        'coins', t.student_count * p_coins_per_student
    ) ORDER BY t.full_name), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT u.id, u.full_name, COUNT(DISTINCT gs.student_id) AS student_count
        FROM public.users u
        JOIN public.groups g ON g.teacher_id = u.id AND g.status = 'active'
        JOIN public.group_students gs ON gs.group_id = g.id
        WHERE u.role = 'Teacher' AND u.status = 'active'
        GROUP BY u.id, u.full_name
        HAVING COUNT(DISTINCT gs.student_id) > 0
    ) t;

    RETURN jsonb_build_object(
        'success', true,
        'month', v_month,
        'coinsPerStudent', p_coins_per_student,
        'alreadyDone', v_already IS NOT NULL,
        'doneAt', v_already.created_at,
        'teachers', v_rows,
        'totalCoins', (SELECT COALESCE(SUM((t->>'coins')::INTEGER), 0) FROM jsonb_array_elements(v_rows) t)
    );
END;
$$;

-- 4. The real thing: +coins_per_student x (active students) to every active teacher's
-- pool, once per calendar month. Refused if already run this month.
CREATE OR REPLACE FUNCTION public.top_up_teacher_pools(
    p_admin_id UUID,
    p_coins_per_student INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_month TEXT := to_char(NOW() AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM');
    v_actor_role TEXT;
    v_teacher RECORD;
    v_count INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    SELECT role INTO v_actor_role FROM public.users WHERE id = p_admin_id AND status = 'active';
    IF v_actor_role IS DISTINCT FROM 'Admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
    END IF;

    IF p_coins_per_student IS NULL OR p_coins_per_student <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
    END IF;

    IF EXISTS (SELECT 1 FROM public.teacher_pool_topups WHERE month = v_month) THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALREADY_DONE', 'month', v_month);
    END IF;

    FOR v_teacher IN
        SELECT u.id, COUNT(DISTINCT gs.student_id) AS student_count
        FROM public.users u
        JOIN public.groups g ON g.teacher_id = u.id AND g.status = 'active'
        JOIN public.group_students gs ON gs.group_id = g.id
        WHERE u.role = 'Teacher' AND u.status = 'active'
        GROUP BY u.id
        HAVING COUNT(DISTINCT gs.student_id) > 0
    LOOP
        INSERT INTO public.teacher_wallets (teacher_id) VALUES (v_teacher.id) ON CONFLICT DO NOTHING;

        UPDATE public.teacher_wallets
        SET balance = balance + v_teacher.student_count * p_coins_per_student, updated_at = NOW()
        WHERE teacher_id = v_teacher.id;

        INSERT INTO public.teacher_transactions (teacher_id, amount, type, created_by)
        VALUES (v_teacher.id, v_teacher.student_count * p_coins_per_student, 'Grant', p_admin_id);

        v_count := v_count + 1;
        v_total := v_total + v_teacher.student_count * p_coins_per_student;
    END LOOP;

    INSERT INTO public.teacher_pool_topups (month, coins_per_student, teacher_count, total_coins, created_by)
    VALUES (v_month, p_coins_per_student, v_count, v_total, p_admin_id);

    INSERT INTO public.audit_log (actor_id, action, entity, details)
    VALUES (p_admin_id, 'coins.monthly_topup', 'teacher_wallet', jsonb_build_object('month', v_month, 'teachers', v_count, 'total', v_total));

    RETURN jsonb_build_object('success', true, 'month', v_month, 'teacherCount', v_count, 'totalCoins', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_coins(UUID, INTEGER, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.preview_teacher_pool_topup(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.top_up_teacher_pools(UUID, INTEGER) TO service_role;
