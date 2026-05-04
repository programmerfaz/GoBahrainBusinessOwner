-- Platform admins: one row per Supabase Auth user granted console access.
-- admin_id is the primary key and references auth.users(id).

CREATE TABLE IF NOT EXISTS public.admins (
  admin_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin'
    CHECK (role IN ('super_admin', 'admin', 'moderator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admins_role_idx ON public.admins (role);

CREATE OR REPLACE FUNCTION public.set_admins_updated_at()
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

DROP TRIGGER IF EXISTS admins_updated_at ON public.admins;
CREATE TRIGGER admins_updated_at
  BEFORE UPDATE ON public.admins
  FOR EACH ROW EXECUTE PROCEDURE public.set_admins_updated_at();

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER avoids RLS recursion when policies reference the same table.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins a WHERE a.admin_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- Each signed-in admin can read their own row.
DROP POLICY IF EXISTS admins_select_self ON public.admins;
CREATE POLICY admins_select_self
  ON public.admins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = admin_id);

-- Any user who already has an admins row can list all admins (for team UIs).
DROP POLICY IF EXISTS admins_select_all_when_admin ON public.admins;
CREATE POLICY admins_select_all_when_admin
  ON public.admins
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

GRANT SELECT ON TABLE public.admins TO authenticated;
GRANT ALL ON TABLE public.admins TO service_role;

COMMENT ON TABLE public.admins IS 'SiyahaBH platform admins; rows reference Supabase Auth users.';
