-- Profile disabled applies to every account type (not only business owners / `client`).
-- Pending approval remains limited to `account_type = client` (see 022).
-- Admins cannot disable platform admin accounts or their own account.

CREATE OR REPLACE FUNCTION public.require_owner_account_approved_for_client(p_client_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.client c
    INNER JOIN public.account a ON a.account_uuid = c.account_a_uuid
    WHERE c.client_a_uuid = p_client_uuid
      AND a.account_type IS NOT DISTINCT FROM 'client'::public.account_type
      AND a.account_approved IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Your account is pending admin approval. You cannot edit or publish until it is approved.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client c
    INNER JOIN public.account a ON a.account_uuid = c.account_a_uuid
    WHERE c.client_a_uuid = p_client_uuid
      AND COALESCE(a.owner_profile_disabled, false) IS TRUE
  ) THEN
    RAISE EXCEPTION 'Your profile has been disabled by an administrator. You cannot edit or publish until it is re-enabled.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_owner_account_approved_for_account(p_account_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.account a
    WHERE a.account_uuid = p_account_uuid
      AND a.account_type IS NOT DISTINCT FROM 'client'::public.account_type
      AND a.account_approved IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Your account is pending admin approval. You cannot edit or publish until it is approved.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.account a
    WHERE a.account_uuid = p_account_uuid
      AND COALESCE(a.owner_profile_disabled, false) IS TRUE
  ) THEN
    RAISE EXCEPTION 'Your profile has been disabled by an administrator. You cannot edit or publish until it is re-enabled.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_owner_profile_disabled(
  p_account_uuid uuid,
  p_disabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_n int;
  v_row jsonb;
  v_target_auth uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins WHERE admin_id = v_uid) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_disabled, false) THEN
    SELECT a.auth_user_id INTO v_target_auth
    FROM public.account a
    WHERE a.account_uuid = p_account_uuid;
    IF v_target_auth IS NULL THEN
      RAISE EXCEPTION 'Account not found';
    END IF;
    IF EXISTS (SELECT 1 FROM public.admins WHERE admin_id = v_target_auth) THEN
      RAISE EXCEPTION 'Cannot disable a platform administrator account'
        USING ERRCODE = '42501';
    END IF;
    IF v_target_auth = v_uid THEN
      RAISE EXCEPTION 'Cannot disable your own account while signed in'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.account
  SET owner_profile_disabled = COALESCE(p_disabled, false)
  WHERE account_uuid = p_account_uuid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  SELECT to_jsonb(a) INTO v_row FROM public.account a WHERE a.account_uuid = p_account_uuid;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_clients_for_console()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE admin_id = v_uid) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'client_a_uuid',           c.client_a_uuid,
          'account_a_uuid',          c.account_a_uuid,
          'business_name',           c.business_name,
          'description',             c.description,
          'client_type',             c.client_type,
          'client_image',            c.client_image,
          'rating',                  c.rating,
          'price_range',             c.price_range,
          'lat',                     c.lat,
          'long',                    c."long",
          'timings',                 c.timings,
          'qrcode',                  c.qrcode,
          'tags',                    c.tags,
          'account_email',           a.email,
          'account_user_name',       a.user_name,
          'account_phone',           a.phone,
          'account_approved',        COALESCE(a.account_approved, true),
          'owner_account_type',      a.account_type::text,
          'owner_profile_disabled',  COALESCE(a.owner_profile_disabled, false)
        )
        ORDER BY
          (
            COALESCE(a.owner_profile_disabled, false)
            OR (
              a.account_type IS NOT DISTINCT FROM 'client'::public.account_type
              AND a.account_approved IS NOT TRUE
            )
          ) DESC NULLS LAST,
          c.business_name
      ),
      '[]'::jsonb
    )
    FROM public.client c
    INNER JOIN public.account a ON a.account_uuid = c.account_a_uuid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_accounts_for_console()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE admin_id = v_uid) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'account_uuid',           a.account_uuid,
          'email',                  a.email,
          'user_name',              a.user_name,
          'phone',                  a.phone,
          'account_type',           a.account_type::text,
          'auth_id',                a.auth_id,
          'account_approved',       COALESCE(a.account_approved, true),
          'owner_profile_disabled', COALESCE(a.owner_profile_disabled, false),
          'is_platform_admin',      EXISTS (SELECT 1 FROM public.admins adm WHERE adm.admin_id = a.auth_user_id)
        )
        ORDER BY
          (
            COALESCE(a.owner_profile_disabled, false)
            OR (
              a.account_type IS NOT DISTINCT FROM 'client'::public.account_type
              AND a.account_approved IS NOT TRUE
            )
            OR EXISTS (SELECT 1 FROM public.admins adm WHERE adm.admin_id = a.auth_user_id)
          ) DESC NULLS LAST,
          a.email
      ),
      '[]'::jsonb
    )
    FROM public.account a
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_accounts_for_console() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts_for_console() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts_for_console() TO service_role;
