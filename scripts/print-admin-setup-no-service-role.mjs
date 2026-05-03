#!/usr/bin/env node
/**
 * Prints setup steps for admin login without any service role key or local secrets.
 * Run: npm run admin:setup-help
 */

const steps = `
SiyahaBH admin setup (no service role key)
==========================================

Order matters: create Auth users FIRST, then run the link SQL.

0) Same Supabase project everywhere
   - Your app uses the URL in .env VITE_SUPABASE_URL (or the default in src/config/api.js).
   - The Sign-in page shows that host — open Supabase Dashboard for THAT project only.
   - If you add users in a different project, Authentication will look "empty" for the app.

1) SQL Editor — run migrations once if not already:
   - supabase/migrations/017_admins_table.sql
   - supabase/migrations/018_platform_settings_and_admin_rpcs.sql

2) Authentication → Users → "Add user" (this creates the login; SQL cannot do this)
   - Do NOT rely on "Invite user" alone — invited users have no password until they finish the link flow.
   - Email: Admin_fazil@gmail.com   (and/or Admin_esmail@gmail.com)
   - Password: choose one and remember it for the app sign-in
   - Turn ON "Auto Confirm User" (or confirm via email link)

   Verify in SQL Editor (same project):
   select id, email, email_confirmed_at, created_at from auth.users order by created_at desc;

3) SQL Editor — run ONE of:
   - supabase/grant_admin_access_one_email.sql  (edit the email at the bottom; also ensures platform_settings row)
   - OR supabase/seed_admins_link_auth_users.sql  (preset emails + platform_settings row)
   These do NOT create Auth users; they only link existing auth.users → public.admins.

4) Sign in on the app with the same email + password from step 2.

If Users is still empty after "Add user":
   - Confirm you are in the correct organization + project (match the host on Sign-in).
   - Try refreshing the Users table; check you are under Authentication → Users (not Table Editor).

Optional (service role only in your own .env — never paste into chat):
  npm run seed:admins
`

console.log(steps)
