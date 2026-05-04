-- Admins can disable a business owner's profile (blocks same mutations as pending approval).

ALTER TABLE public.account
  ADD COLUMN IF NOT EXISTS owner_profile_disabled boolean NOT NULL DEFAULT false;

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
      AND a.account_type IS NOT DISTINCT FROM 'client'::public.account_type
      AND COALESCE(a.owner_profile_disabled, false) IS TRUE
  ) THEN
    RAISE EXCEPTION 'Your business profile has been disabled by an administrator. You cannot edit or publish until it is re-enabled.'
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
      AND a.account_type IS NOT DISTINCT FROM 'client'::public.account_type
      AND COALESCE(a.owner_profile_disabled, false) IS TRUE
  ) THEN
    RAISE EXCEPTION 'Your business profile has been disabled by an administrator. You cannot edit or publish until it is re-enabled.'
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
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins WHERE admin_id = v_uid) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
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

REVOKE ALL ON FUNCTION public.admin_set_owner_profile_disabled(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_owner_profile_disabled(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_owner_profile_disabled(uuid, boolean) TO service_role;

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
          (a.account_type IS NOT DISTINCT FROM 'client'::public.account_type
            AND (a.account_approved IS NOT TRUE OR COALESCE(a.owner_profile_disabled, false))) DESC NULLS LAST,
          c.business_name
      ),
      '[]'::jsonb
    )
    FROM public.client c
    INNER JOIN public.account a ON a.account_uuid = c.account_a_uuid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_clients_for_console() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_clients_for_console() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_clients_for_console() TO service_role;
