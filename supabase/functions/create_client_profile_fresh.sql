-- Run in Supabase SQL Editor - DROP old function then CREATE fresh
-- Fixes: "column openclosed_state does not exist"

DROP FUNCTION IF EXISTS public.create_client_profile(jsonb, text, jsonb, jsonb, jsonb, jsonb);

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
BEGIN
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
    tags
  ) VALUES (
    client_uuid,
    (p_client->>'account_a_uuid')::uuid,
    p_client->>'business_name',
    NULLIF(p_client->>'description', ''),
    v_rating,
    NULLIF(p_client->>'price_range', ''),
    CASE WHEN p_type_choice = 'none' THEN 'client' ELSE p_type_choice END,
    NULLIF(p_client->>'client_image', ''),
    v_lat,
    v_long,
    NULLIF(p_client->>'timings', ''),
    COALESCE(
      CASE WHEN jsonb_typeof(COALESCE(p_client->'tags','null'::jsonb)) = 'array' THEN p_client->'tags'
           WHEN TRIM(COALESCE(p_client->>'tags','')) != '' THEN (SELECT COALESCE(jsonb_agg(trimmed), '[]'::jsonb) FROM (SELECT trim(unnest(string_to_array(p_client->>'tags', ','))) AS trimmed) x WHERE trimmed != '')
           ELSE '[]'::jsonb END,
      '[]'::jsonb)
  );

  IF p_type_choice = 'restaurant' AND p_restaurant IS NOT NULL THEN
    INSERT INTO public.restaurant_client (a_uuid, cuisine, meal_type, food_type, speciality, isfoodtruck)
    VALUES (
      client_uuid,
      COALESCE(p_restaurant->>'cuisine', ''),
      COALESCE(p_restaurant->>'meal_type', ''),
      COALESCE(p_restaurant->>'food_type', ''),
      COALESCE(p_restaurant->>'speciality', ''),
      COALESCE((p_restaurant->>'isfoodtruck')::boolean, false)
    );
  ELSIF p_type_choice = 'place' AND p_place_client IS NOT NULL AND p_place IS NOT NULL THEN
    INSERT INTO public.place_client (a_uuid, category, indoor_outdoor)
    VALUES (
      client_uuid,
      COALESCE(p_place_client->>'category', ''),
      COALESCE(p_place_client->>'indoor_outdoor', '')
    );
    INSERT INTO public.place (place_uuid, a_uuid, name, description, opening_time, closing_time, entry_cost, suitable_for)
    VALUES (
      (p_place->>'place_uuid')::uuid,
      client_uuid,
      COALESCE(p_place->>'name', ''),
      NULLIF(p_place->>'description', ''),
      COALESCE(NULLIF(p_place->>'opening_time', ''), ''),
      COALESCE(NULLIF(p_place->>'closing_time', ''), ''),
      (CASE WHEN TRIM(COALESCE(p_place->>'entry_cost','')) = '' THEN 0 ELSE (TRIM(p_place->>'entry_cost'))::numeric END),
      COALESCE(NULLIF(p_place->>'suitable_for', ''), '')
    );
  ELSIF p_type_choice = 'event_organizer' AND p_event IS NOT NULL THEN
    INSERT INTO public.event_organizer_client (a_uuid, event_type, indoor_outdoor)
    VALUES (
      client_uuid,
      COALESCE(p_event->>'event_type', ''),
      COALESCE(p_event->>'indoor_outdoor', '')
    );
    INSERT INTO public.events (event_uuid, client_a_uuid, event_name, name, status, venue, lat, "long", start_date, end_date, start_time, end_time)
    VALUES (
      COALESCE((p_event->>'event_uuid')::uuid, gen_random_uuid()),
      client_uuid,
      COALESCE(p_event->>'event_name', ''),
      COALESCE(p_event->>'name', p_event->>'event_name', ''),
      COALESCE(NULLIF(TRIM(p_event->>'status'), ''), 'coming_soon'),
      COALESCE(p_event->>'venue', ''),
      CASE WHEN TRIM(COALESCE(p_event->>'lat','')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE NULL END,
      CASE WHEN TRIM(COALESCE(p_event->>'long','')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE NULL END,
      CASE WHEN TRIM(COALESCE(p_event->>'start_date','')) != '' THEN (TRIM(p_event->>'start_date'))::date ELSE NULL END,
      CASE WHEN TRIM(COALESCE(p_event->>'end_date','')) != '' THEN (TRIM(p_event->>'end_date'))::date ELSE NULL END,
      CASE WHEN TRIM(COALESCE(p_event->>'start_time','')) != '' THEN (TRIM(p_event->>'start_time'))::time ELSE NULL END,
      CASE WHEN TRIM(COALESCE(p_event->>'end_time','')) != '' THEN (TRIM(p_event->>'end_time'))::time ELSE NULL END
    );
  END IF;

  SELECT to_jsonb(c) INTO result FROM public.client c WHERE c.client_a_uuid = client_uuid;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_client_profile(jsonb, text, jsonb, jsonb, jsonb, jsonb) TO anon;
