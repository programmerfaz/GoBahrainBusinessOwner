-- Run this in Supabase SQL Editor to debug "500 on signup" / "Database error saving new user".
-- 1) List roles that might run the trigger (add INSERT policy for the one that exists):
SELECT rolname FROM pg_roles
WHERE rolname IN ('postgres', 'supabase_auth_admin', 'authenticator', 'auth')
   OR rolname LIKE '%auth%'
ORDER BY rolname;

-- 2) Check account_type enum values (trigger uses 'client'::public.account_type):
SELECT t.typname, e.enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'account_type'
ORDER BY e.enumsortorder;

-- 3) If your trigger runs as a role other than postgres/supabase_auth_admin, add a policy manually, e.g.:
--    Replace YOUR_AUTH_ROLE with the role name from query 1 (e.g. authenticator):
-- DROP POLICY IF EXISTS "Allow auth role insert account" ON public.account;
-- CREATE POLICY "Allow auth role insert account"
--   ON public.account FOR INSERT TO YOUR_AUTH_ROLE
--   WITH CHECK (auth_id IS NOT NULL);
