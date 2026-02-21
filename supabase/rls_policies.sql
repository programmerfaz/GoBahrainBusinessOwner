-- ALTERNATIVE: If you prefer not to use the sign_in RPC, run this instead.
-- Run in Supabase Dashboard → SQL Editor
-- Allows anon to SELECT and INSERT on account (for sign in / sign up)

ALTER TABLE public.account ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select account"
  ON public.account FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert account"
  ON public.account FOR INSERT
  TO anon
  WITH CHECK (true);
