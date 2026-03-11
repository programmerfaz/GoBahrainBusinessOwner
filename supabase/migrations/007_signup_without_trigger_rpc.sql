-- Fix 500 on signup: stop using trigger on auth.users; create account+client via RPC after signup.
-- 1) Drop the trigger so Auth signup returns 200.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2) RPC: create account (account_type = 'client') and client for the currently authenticated user.
--    p_client_type: 'place' | 'restaurant' | 'event_organizer' (from dropdown). Creates subtype row when needed.
--    If you get "type public.client_type does not exist", change public.client_type to your enum type (e.g. client_type).
CREATE OR REPLACE FUNCTION public.create_my_account_and_client(
  p_email text,
  p_name text DEFAULT '',
  p_phone text DEFAULT '',
  p_client_type text DEFAULT 'client'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid;
  v_account_uuid uuid;
  v_client_uuid uuid;
  v_account jsonb;
  v_type_text text;
  v_client_type_enum public.client_type;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_type_text := CASE
    WHEN LOWER(TRIM(p_client_type)) IN ('place', 'restaurant', 'event_organizer') THEN LOWER(TRIM(p_client_type))
    ELSE 'client'
  END;
  v_client_type_enum := v_type_text::public.client_type;

  INSERT INTO public.account (email, user_name, phone, account_type, auth_user_id, auth_id)
  VALUES (
    COALESCE(TRIM(p_email), ''),
    COALESCE(TRIM(p_name), ''),
    COALESCE(TRIM(p_phone), ''),
    'client'::public.account_type,
    v_auth_id,
    v_auth_id
  )
  RETURNING account_uuid INTO v_account_uuid;

  INSERT INTO public.client (account_a_uuid, business_name, client_type, event_type, indoor_outdoor)
  VALUES (
    v_account_uuid,
    COALESCE(NULLIF(TRIM(p_name), ''), 'My business'),
    v_client_type_enum,
    CASE WHEN v_type_text = 'event_organizer' THEN '' ELSE NULL END,
    CASE WHEN v_type_text = 'event_organizer' THEN '' ELSE NULL END
  )
  RETURNING client_a_uuid INTO v_client_uuid;

  IF v_type_text = 'restaurant' THEN
    INSERT INTO public.restaurant_client (a_uuid, cuisine, meal_type, food_type, speciality, isfoodtruck)
    VALUES (v_client_uuid, '', '', '', '', false);
  ELSIF v_type_text = 'place' THEN
    INSERT INTO public.place (client_uuid, name, description, opening_time, closing_time, entry_cost, suitable_for, category, indoor_outdoor)
    VALUES (v_client_uuid, COALESCE(NULLIF(TRIM(p_name), ''), 'My place'), NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  END IF;
  -- event_organizer: profile lives on client (event_type, indoor_outdoor); individual events go in public.events

  SELECT to_jsonb(a) INTO v_account FROM public.account a WHERE a.account_uuid = v_account_uuid;
  RETURN v_account;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_my_account_and_client(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_my_account_and_client(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_my_account_and_client(text, text, text, text) TO service_role;
