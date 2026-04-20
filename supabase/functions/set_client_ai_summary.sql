-- Run in Supabase SQL Editor if you use manual RPC deploys (same as migrations/015_set_client_ai_summary_rpc.sql)

CREATE OR REPLACE FUNCTION public.set_client_ai_summary(
  p_client_uuid uuid,
  p_summary text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.client
  SET ai_summary = NULLIF(TRIM(p_summary), '')
  WHERE client_a_uuid = p_client_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found: %', p_client_uuid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_client_ai_summary(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.set_client_ai_summary(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_client_ai_summary(uuid, text) TO service_role;
