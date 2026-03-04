-- Account table already has: account_uuid, email, user_name, phone, account_type (enum), auth_user_id, auth_id.
-- RLS policies + trigger: on Auth sign-up, insert into account and client (account_type = 'client').
--
-- RLS: allow user to read their own account by auth_id
DROP POLICY IF EXISTS "Allow read own account by auth_id" ON public.account;
CREATE POLICY "Allow read own account by auth_id"
  ON public.account FOR SELECT
  USING (auth_id = auth.uid());

-- RLS: allow user to insert their own account (auth_id must match current user)
DROP POLICY IF EXISTS "Allow insert own account by auth_id" ON public.account;
CREATE POLICY "Allow insert own account by auth_id"
  ON public.account FOR INSERT
  WITH CHECK (auth_id = auth.uid());

-- RLS: allow trigger to insert new account row. Auth trigger often runs as supabase_auth_admin, not postgres.
DROP POLICY IF EXISTS "Allow service insert account for new user" ON public.account;
CREATE POLICY "Allow service insert account for new user"
  ON public.account FOR INSERT
  TO postgres
  WITH CHECK (auth_id IS NOT NULL);

-- Policy for supabase_auth_admin (role that runs trigger when Auth creates user). Skip if role missing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    DROP POLICY IF EXISTS "Allow supabase_auth_admin insert account" ON public.account;
    CREATE POLICY "Allow supabase_auth_admin insert account"
      ON public.account FOR INSERT
      TO supabase_auth_admin
      WITH CHECK (auth_id IS NOT NULL);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    DROP POLICY IF EXISTS "Allow authenticator insert account" ON public.account;
    CREATE POLICY "Allow authenticator insert account"
      ON public.account FOR INSERT
      TO authenticator
      WITH CHECK (auth_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_account_auth_id ON public.account(auth_id);

-- RLS on client: if client has RLS enabled, allow trigger to insert new row on signup
DROP POLICY IF EXISTS "Allow service insert client for new user" ON public.client;
CREATE POLICY "Allow service insert client for new user"
  ON public.client FOR INSERT
  TO postgres
  WITH CHECK (true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    DROP POLICY IF EXISTS "Allow supabase_auth_admin insert client" ON public.client;
    CREATE POLICY "Allow supabase_auth_admin insert client"
      ON public.client FOR INSERT
      TO supabase_auth_admin
      WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    DROP POLICY IF EXISTS "Allow authenticator insert client" ON public.client;
    CREATE POLICY "Allow authenticator insert client"
      ON public.client FOR INSERT
      TO authenticator
      WITH CHECK (true);
  END IF;
END $$;

-- Function: create account (account_type = 'client') and client row for a new Auth user.
-- Called by trigger on auth.users. account_type is always 'client'.
CREATE OR REPLACE FUNCTION public.create_account_and_client_for_auth_user(
  p_auth_user_id uuid,
  p_email text,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_account_uuid uuid;
  biz_name text;
BEGIN
  biz_name := COALESCE(NULLIF(TRIM(p_meta->>'name'), ''), 'My business');

  -- 1) Insert account (account_type always 'client')
  INSERT INTO public.account (email, user_name, phone, account_type, auth_user_id, auth_id)
  VALUES (
    COALESCE(TRIM(p_email), ''),
    COALESCE(TRIM(p_meta->>'name'), ''),
    COALESCE(TRIM(p_meta->>'phone'), ''),
    'client'::public.account_type,
    p_auth_user_id,
    p_auth_user_id
  )
  RETURNING account_uuid INTO new_account_uuid;

  -- 2) Insert client linked to that account (authenticated client record)
  INSERT INTO public.client (account_a_uuid, business_name, client_type)
  VALUES (new_account_uuid, biz_name, 'client');

  RETURN new_account_uuid;
END;
$$;

-- Trigger: on new Auth user, call function to create account + client
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  err_detail text;
  err_constraint text;
BEGIN
  PERFORM public.create_account_and_client_for_auth_user(
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err_detail = PG_EXCEPTION_DETAIL, err_constraint = CONSTRAINT_NAME;
    RAISE EXCEPTION '[handle_new_auth_user] % (detail: %, constraint: %)', SQLERRM, COALESCE(err_detail, 'none'), COALESCE(err_constraint, 'none');
END;
$$;

-- Ensure roles that run the trigger can execute the helper. Helper is SECURITY DEFINER so runs as owner.
GRANT EXECUTE ON FUNCTION public.create_account_and_client_for_auth_user(uuid, text, jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.create_account_and_client_for_auth_user(uuid, text, jsonb) TO service_role;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.create_account_and_client_for_auth_user(uuid, text, jsonb) TO supabase_auth_admin;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    GRANT EXECUTE ON FUNCTION public.create_account_and_client_for_auth_user(uuid, text, jsonb) TO authenticator;
  END IF;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();
