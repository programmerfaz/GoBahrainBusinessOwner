-- Site-wide copy: one row (id = 1), each field in its own column.
-- Requires 017_admins_table.sql (public.is_platform_admin()).

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id smallint NOT NULL PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  privacy_policy text NOT NULL DEFAULT '',
  about_us text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  default_language text NOT NULL DEFAULT 'en',
  bahrain_info text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_default_language_check CHECK (default_language IN ('en', 'ar'))
);

INSERT INTO public.platform_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_platform_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE PROCEDURE public.set_platform_settings_updated_at();

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_settings_public_read ON public.platform_settings;
CREATE POLICY platform_settings_public_read
  ON public.platform_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS platform_settings_admin_update ON public.platform_settings;
CREATE POLICY platform_settings_admin_update
  ON public.platform_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS platform_settings_admin_insert ON public.platform_settings;
CREATE POLICY platform_settings_admin_insert
  ON public.platform_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin() AND id = 1);

GRANT SELECT ON TABLE public.platform_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.platform_settings TO authenticated;

COMMENT ON TABLE public.platform_settings IS 'Singleton (id=1): privacy, about, contact, default language, Bahrain blurb for SiyahaBH.';

-- Admin-only listings (SECURITY DEFINER; does not require widening RLS on client/account).

CREATE OR REPLACE FUNCTION public.admin_list_clients_for_console()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.business_name), '[]'::jsonb)
    FROM (
      SELECT
        c.client_a_uuid,
        c.account_a_uuid,
        c.business_name,
        c.description,
        c.client_type,
        c.client_image,
        c.rating,
        c.price_range,
        c.lat,
        c."long" AS long,
        c.timings,
        c.qrcode,
        c.tags,
        a.email AS account_email,
        a.user_name AS account_user_name,
        a.phone AS account_phone
      FROM public.client c
      INNER JOIN public.account a ON a.account_uuid = c.account_a_uuid
    ) s
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_accounts_for_console()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.email), '[]'::jsonb)
    FROM (
      SELECT
        a.account_uuid,
        a.email,
        a.user_name,
        a.phone,
        a.account_type::text AS account_type,
        a.auth_id
      FROM public.account a
    ) s
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_clients_for_console() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_accounts_for_console() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_clients_for_console() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts_for_console() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_clients_for_console() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts_for_console() TO service_role;
