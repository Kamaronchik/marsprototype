-- =============================================================================
-- ATOMIC 2FA VERIFICATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.verify_2fa_code(
    p_user_id UUID,
    p_code_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_record RECORD;
BEGIN
    -- 1. Fetch the most recent unused code
    SELECT * INTO v_record
    FROM public.verification_codes
    WHERE user_id = p_user_id
      AND is_used = false
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    -- 2. Check if a valid code exists
    IF v_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'NO_CODE_OR_EXPIRED'
        );
    END IF;

    -- 3. Check attempt limit
    IF v_record.attempts >= 5 THEN
        UPDATE public.verification_codes
        SET is_used = true
        WHERE id = v_record.id;

        RETURN jsonb_build_object(
            'success', false,
            'error', 'TOO_MANY_ATTEMPTS'
        );
    END IF;

    -- 4. Compare provided HMAC hash
    IF v_record.code_hash = p_code_hash THEN

        -- SUCCESS: Mark code as used
        UPDATE public.verification_codes
        SET is_used = true
        WHERE id = v_record.id;

        RETURN jsonb_build_object('success', true);

    ELSE

        -- FAILURE: Increment attempts
        IF v_record.attempts + 1 >= 5 THEN

            UPDATE public.verification_codes
            SET attempts = attempts + 1,
                is_used = true
            WHERE id = v_record.id;

            RETURN jsonb_build_object(
                'success', false,
                'error', 'TOO_MANY_ATTEMPTS'
            );

        ELSE

            UPDATE public.verification_codes
            SET attempts = attempts + 1
            WHERE id = v_record.id;

            RETURN jsonb_build_object(
                'success', false,
                'error', 'INVALID_CODE'
            );

        END IF;
    END IF;
END;
$$;

-- =============================================================================
-- ACCESS CONTROL
-- =============================================================================

REVOKE ALL ON FUNCTION public.verify_2fa_code(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_2fa_code(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.verify_2fa_code(UUID, TEXT) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.verify_2fa_code(UUID, TEXT) TO service_role;
