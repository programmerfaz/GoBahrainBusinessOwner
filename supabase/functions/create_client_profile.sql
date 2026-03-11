-- Run in Supabase Dashboard → SQL Editor
-- Creates profile (client + type-specific) bypassing RLS

CREATE OR REPLACE FUNCTION public.create_client_profile(
  p_client jsonb,
  p_type_choice text,
  p_restaurant jsonb DEFAULT NULL,
  p_place_client jsonb DEFAULT NULL,
  p_place jsonb DEFAULT NULL,
  p_event jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_uuid uuid;
  result jsonb;
  v_rating numeric;
  v_lat numeric;
  v_long numeric;
  v_type_choice text;
  v_client_type public.client_type;
BEGIN
  v_type_choice := LOWER(TRIM(COALESCE(p_type_choice, '')));
  IF v_type_choice = 'event_organizer' THEN
    v_type_choice := 'event';
  END IF;
  IF v_type_choice NOT IN ('restaurant', 'place', 'event') THEN
    RAISE EXCEPTION 'Invalid client type: % (allowed: restaurant, place, event)', p_type_choice;
  END IF;
  v_client_type := v_type_choice::public.client_type;

  client_uuid := (p_client->>'client_a_uuid')::uuid;
  v_rating := CASE WHEN TRIM(COALESCE(p_client->>'rating','')) != ''
                  THEN (TRIM(p_client->>'rating'))::numeric ELSE NULL END;
  v_lat := CASE WHEN TRIM(COALESCE(p_client->>'lat','')) != ''
               THEN (TRIM(p_client->>'lat'))::numeric ELSE NULL END;
  v_long := CASE WHEN TRIM(COALESCE(p_client->>'long','')) != ''
                THEN (TRIM(p_client->>'long'))::numeric ELSE NULL END;

  INSERT INTO public.client (
    client_a_uuid,
    account_a_uuid,
    business_name,
    description,
    rating,
    price_range,
    client_type,
    client_image,
    lat,
    long,
    timings,
    qrcode,
    event_type,
    indoor_outdoor
  ) VALUES (
    client_uuid,
    (p_client->>'account_a_uuid')::uuid,
    p_client->>'business_name',
    NULLIF(p_client->>'description', ''),
    v_rating,
    NULLIF(p_client->>'price_range', ''),
    v_client_type,
    NULLIF(p_client->>'client_image', ''),
    v_lat,
    v_long,
    NULLIF(p_client->>'timings', ''),
    client_uuid::text,
    CASE WHEN v_type_choice = 'event' THEN COALESCE(p_event->>'event_type', '') ELSE NULL END,
    CASE WHEN v_type_choice = 'event' THEN COALESCE(p_event->>'indoor_outdoor', '') ELSE NULL END
  );

  IF v_type_choice = 'restaurant' AND p_restaurant IS NOT NULL THEN
    INSERT INTO public.restaurant_client (a_uuid, cuisine, meal_type, food_type, speciality, isfoodtruck)
    VALUES (
      client_uuid,
      COALESCE(p_restaurant->>'cuisine', ''),
      COALESCE(p_restaurant->>'meal_type', ''),
      COALESCE(p_restaurant->>'food_type', ''),
      COALESCE(p_restaurant->>'speciality', ''),
      COALESCE((p_restaurant->>'isfoodtruck')::boolean, false)
    );
  ELSIF v_type_choice = 'place' AND (p_place_client IS NOT NULL OR p_place IS NOT NULL) THEN
    INSERT INTO public.place (client_uuid, name, description, opening_time, closing_time, entry_cost, suitable_for, category, indoor_outdoor)
    VALUES (
      client_uuid,
      COALESCE(p_place->>'name', p_place->>'place_name', ''),
      NULLIF(TRIM(COALESCE(p_place->>'description', p_place->>'place_description', '')), ''),
      NULLIF(TRIM(COALESCE(p_place->>'opening_time', '')), ''),
      NULLIF(TRIM(COALESCE(p_place->>'closing_time', '')), ''),
      (CASE WHEN TRIM(COALESCE(p_place->>'entry_cost','')) = '' THEN NULL ELSE (TRIM(p_place->>'entry_cost'))::numeric END),
      NULLIF(TRIM(COALESCE(p_place->>'suitable_for', '')), ''),
      NULLIF(TRIM(COALESCE(p_place->>'category', p_place_client->>'category', '')), ''),
      (CASE WHEN TRIM(COALESCE(p_place->>'indoor_outdoor', p_place_client->>'indoor_outdoor', '')) != '' THEN (TRIM(COALESCE(p_place->>'indoor_outdoor', p_place_client->>'indoor_outdoor', '')))::public.indoor_outdoor ELSE NULL END)
    );
  -- event: profile stored on client (event_type, indoor_outdoor) above; use public.events for individual events
  END IF;

  SELECT to_jsonb(c) INTO result FROM public.client c WHERE c.client_a_uuid = client_uuid;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_client_profile(jsonb, text, jsonb, jsonb, jsonb, jsonb) TO anon;
