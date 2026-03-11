-- Sign-in fix: when account exists (same email) but auth_id is missing or stale,
-- link it to the current auth user instead of failing with 409.

CREATE OR REPLACE FUNCTION public.link_auth_to_existing_account(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid;
  v_account jsonb;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Link account to current auth user if it exists and auth_id is missing or different
  UPDATE public.account
  SET auth_user_id = v_auth_id,
      auth_id = v_auth_id
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
    AND (auth_id IS DISTINCT FROM v_auth_id OR auth_id IS NULL);

  -- Return account for this email when it is linked to current user (just linked or already was)
  SELECT to_jsonb(a) INTO v_account
  FROM public.account a
  WHERE LOWER(TRIM(a.email)) = LOWER(TRIM(p_email))
    AND a.auth_id = v_auth_id;
  RETURN v_account;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_auth_to_existing_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_auth_to_existing_account(text) TO service_role;
