-- Link admin_esmail@gmail.com → public.admins (after the user exists in Authentication → Users).
-- Run in Supabase SQL Editor. Prerequisite: migrations 017 + 018.

INSERT INTO public.platform_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admins (admin_id, display_name, role)
SELECT u.id,
       COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
       'super_admin'
FROM auth.users u
WHERE lower(trim(u.email)) = lower(trim('admin_esmail@gmail.com'))
ON CONFLICT (admin_id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  updated_at = now();
