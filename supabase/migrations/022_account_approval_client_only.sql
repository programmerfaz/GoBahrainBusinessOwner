-- Approval gates apply only to business-owner accounts (account_type = 'client' in this schema).
-- Other account types (e.g. 'user') default to approved and skip require_* checks.

ALTER TABLE public.account
  ALTER COLUMN account_approved SET DEFAULT true;

UPDATE public.account
SET account_approved = true
WHERE account_type IS DISTINCT FROM 'client'::public.account_type;

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
END;
$$;

-- Admin client list: include account row type so UI only prompts approval for business owners.
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
          'client_a_uuid',         c.client_a_uuid,
          'account_a_uuid',        c.account_a_uuid,
          'business_name',         c.business_name,
          'description',           c.description,
          'client_type',           c.client_type,
          'client_image',          c.client_image,
          'rating',                c.rating,
          'price_range',           c.price_range,
          'lat',                   c.lat,
          'long',                  c."long",
          'timings',               c.timings,
          'qrcode',                c.qrcode,
          'tags',                  c.tags,
          'account_email',         a.email,
          'account_user_name',     a.user_name,
          'account_phone',         a.phone,
          'account_approved',      COALESCE(a.account_approved, true),
          'owner_account_type',    a.account_type::text
        )
        ORDER BY
          (a.account_type IS NOT DISTINCT FROM 'client'::public.account_type AND a.account_approved IS NOT TRUE) DESC NULLS LAST,
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
