-- =============================================================================
-- Fix: admin listing RPCs were marked STABLE + SECURITY DEFINER which lets
-- Postgres cache/inline them without the caller's JWT session, causing
-- auth.uid() to return NULL inside and is_platform_admin() to silently
-- return false → empty array with no error visible in the frontend.
--
-- Fix: change both functions to VOLATILE so every call gets fresh session state.
-- Run in SQL Editor for your project.
-- =============================================================================

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
          'client_a_uuid',       c.client_a_uuid,
          'account_a_uuid',      c.account_a_uuid,
          'business_name',       c.business_name,
          'description',         c.description,
          'client_type',         c.client_type,
          'client_image',        c.client_image,
          'rating',              c.rating,
          'price_range',         c.price_range,
          'lat',                 c.lat,
          'long',                c."long",
          'timings',             c.timings,
          'qrcode',              c.qrcode,
          'tags',                c.tags,
          'account_email',       a.email,
          'account_user_name',   a.user_name,
          'account_phone',       a.phone
        )
        ORDER BY c.business_name
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
          'account_uuid',  a.account_uuid,
          'email',         a.email,
          'user_name',     a.user_name,
          'phone',         a.phone,
          'account_type',  a.account_type::text,
          'auth_id',       a.auth_id
        )
        ORDER BY a.email
      ),
      '[]'::jsonb
    )
    FROM public.account a
  );
END;
$$;

-- Also update is_platform_admin to VOLATILE to be safe
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
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
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.admins WHERE admin_id = v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_clients_for_console() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_accounts_for_console() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_clients_for_console() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts_for_console() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_clients_for_console() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts_for_console() TO service_role;
