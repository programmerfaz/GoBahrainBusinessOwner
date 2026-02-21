-- Run this in Supabase Dashboard → SQL Editor
-- Creates a sign_in function that bypasses RLS (needed when RLS blocks direct SELECT)

CREATE OR REPLACE FUNCTION public.sign_in(check_email text, check_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT to_json(a) INTO result
  FROM public.account a
  WHERE LOWER(TRIM(a.email)) = LOWER(TRIM(check_email))
    AND a.password = check_password
  LIMIT 1;
  RETURN result;
END;
$$;

-- Grant execute to anon so the client can call it
GRANT EXECUTE ON FUNCTION public.sign_in(text, text) TO anon;
