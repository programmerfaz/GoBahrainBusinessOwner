-- Run in Supabase Dashboard → SQL Editor
-- Fetches clients for an account (bypasses RLS)

CREATE OR REPLACE FUNCTION public.get_clients_for_account(p_account_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT COALESCE(json_agg(a ORDER BY a.business_name), '[]'::json)
  INTO result
  FROM public.client a
  WHERE a.account_a_uuid = p_account_uuid;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clients_for_account(uuid) TO anon;
