-- Fix: "column event_type of relation client does not exist"
-- Run this in Supabase SQL Editor if you already applied an older 007 that inserted event_type on client.
-- Replaces create_my_account_and_client so signup only uses columns that exist on a minimal public.client table.

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
    ELSE 'restaurant'
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

  INSERT INTO public.client (account_a_uuid, business_name, client_type)
  VALUES (
    v_account_uuid,
    COALESCE(NULLIF(TRIM(p_name), ''), 'My business'),
    v_client_type_enum
  )
  RETURNING client_a_uuid INTO v_client_uuid;

  IF v_type_text = 'restaurant' THEN
    INSERT INTO public.restaurant_client (a_uuid, cuisine, meal_type, food_type, speciality, isfoodtruck)
    VALUES (v_client_uuid, '', '', '', '', false);
  ELSIF v_type_text = 'place' THEN
    INSERT INTO public.place (client_uuid, name, description, opening_time, closing_time, entry_cost, suitable_for, category, indoor_outdoor)
    VALUES (v_client_uuid, COALESCE(NULLIF(TRIM(p_name), ''), 'My place'), NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  END IF;

  SELECT to_jsonb(a) INTO v_account FROM public.account a WHERE a.account_uuid = v_account_uuid;
  RETURN v_account;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_my_account_and_client(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_my_account_and_client(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_my_account_and_client(text, text, text, text) TO service_role;
