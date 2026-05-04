-- =============================================================================
-- Link admin Auth users → public.admins (NO service role key required)
-- =============================================================================
--
-- IMPORTANT: This SQL does NOT create users in Authentication.
-- It only inserts into public.admins for emails that ALREADY exist in auth.users.
-- If Authentication → Users is empty, use "Add user" first, then run this file.
--
-- Prerequisite A — migrations applied (SQL Editor): run once if not already:
--   migrations/017_admins_table.sql
--   migrations/018_platform_settings_and_admin_rpcs.sql
--
-- Prerequisite B — users exist in Supabase Auth (Dashboard only), SAME project
-- as your app (check VITE_SUPABASE_URL / default in src/config/api.js):
--   Authentication → Users → "Add user"
--   - Email examples: Admin_fazil@gmail.com , admin_esmail@gmail.com
--   - Set password, enable "Auto Confirm User" (or complete email confirmation)
--
-- Then run THIS file in SQL Editor. It is idempotent (ON CONFLICT DO NOTHING).
--
-- For a single new admin email, you can instead run:
--   supabase/grant_admin_access_one_email.sql
-- (edit the email in that file once).
--
-- Full printable checklist (no keys): from project root run:
--   npm run admin:setup-help
-- =============================================================================

-- Ensure site settings row exists (admins need this table for the admin UI save/load).
INSERT INTO public.platform_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admins (admin_id, display_name, role)
SELECT u.id,
       COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
       'super_admin'
FROM auth.users u
WHERE lower(trim(u.email)) IN (
  lower(trim('Admin_fazil@gmail.com')),
  lower(trim('admin_fazil@gmail.com')),
  lower(trim('Admin_esmail@gmail.com')),
  lower(trim('admin_esmail@gmail.com'))
)
ON CONFLICT (admin_id) DO NOTHING;
