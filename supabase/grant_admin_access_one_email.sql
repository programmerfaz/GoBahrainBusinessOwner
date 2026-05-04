-- =============================================================================
-- One-shot: platform_settings singleton + link ONE Auth user → public.admins
-- Run in Supabase SQL Editor (same project as your app).
-- Prerequisites: migrations 017_admins_table.sql and 018_platform_settings_and_admin_rpcs.sql
-- =============================================================================

-- 1) Singleton site copy (shared by the whole app). No per-user row here.
INSERT INTO public.platform_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2) Console access: edit the email below to match Authentication → Users exactly.
INSERT INTO public.admins (admin_id, display_name, role)
SELECT u.id,
       COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
       'super_admin'
FROM auth.users u
WHERE lower(trim(u.email)) = lower(trim('admin_fazil@gmail.com'))
ON CONFLICT (admin_id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  updated_at = now();

-- Verify:
-- SELECT * FROM public.admins;
-- SELECT id, left(privacy_policy, 40) AS privacy_preview FROM public.platform_settings;
