-- Run in Supabase SQL Editor
-- Updates client + subtype in a transaction, returns updated client

CREATE OR REPLACE FUNCTION public.update_client_profile(
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

  -- Update client
  UPDATE public.client SET
    business_name = COALESCE(p_client->>'business_name', business_name),
    description = NULLIF(TRIM(COALESCE(p_client->>'description','')), ''),
    rating = v_rating,
    price_range = NULLIF(TRIM(COALESCE(p_client->>'price_range','')), ''),
    client_type = CASE WHEN p_type_choice = 'none' THEN 'client' ELSE p_type_choice END,
    client_image = NULLIF(TRIM(COALESCE(p_client->>'client_image','')), ''),
    lat = v_lat,
    long = v_long,
    timings = NULLIF(TRIM(COALESCE(p_client->>'timings','')), ''),
    tags = COALESCE(
      CASE WHEN jsonb_typeof(COALESCE(p_client->'tags','null'::jsonb)) = 'array' THEN p_client->'tags'
           WHEN TRIM(COALESCE(p_client->>'tags','')) != '' THEN (SELECT COALESCE(jsonb_agg(trimmed), '[]'::jsonb) FROM (SELECT trim(unnest(string_to_array(p_client->>'tags', ','))) AS trimmed) x WHERE trimmed != '')
           ELSE '[]'::jsonb END,
      '[]'::jsonb)
  WHERE client_a_uuid = client_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found: %', client_uuid;
  END IF;

  -- Update subtype
  IF p_type_choice = 'restaurant' AND p_restaurant IS NOT NULL THEN
    UPDATE public.restaurant_client SET
      cuisine = COALESCE(p_restaurant->>'cuisine', ''),
      meal_type = COALESCE(p_restaurant->>'meal_type', ''),
      food_type = COALESCE(p_restaurant->>'food_type', ''),
      speciality = COALESCE(p_restaurant->>'speciality', ''),
      isfoodtruck = COALESCE((p_restaurant->>'isfoodtruck')::boolean, false)
    WHERE a_uuid = client_uuid;
  ELSIF p_type_choice = 'place' AND p_place_client IS NOT NULL AND p_place IS NOT NULL THEN
    UPDATE public.place_client SET
      category = COALESCE(p_place_client->>'category', ''),
      indoor_outdoor = COALESCE(p_place_client->>'indoor_outdoor', '')
    WHERE a_uuid = client_uuid;
    UPDATE public.place SET
      name = COALESCE(p_place->>'name', ''),
      description = NULLIF(TRIM(COALESCE(p_place->>'description','')), ''),
      opening_time = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'opening_time','')), ''), opening_time),
      closing_time = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'closing_time','')), ''), closing_time),
      entry_cost = (CASE WHEN TRIM(COALESCE(p_place->>'entry_cost','')) = '' THEN 0 ELSE (TRIM(p_place->>'entry_cost'))::numeric END),
      suitable_for = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'suitable_for','')), ''), suitable_for)
    WHERE a_uuid = client_uuid;
  ELSIF p_type_choice = 'event_organizer' AND p_event IS NOT NULL THEN
    UPDATE public.event_clients SET
      event_type = COALESCE(p_event->>'event_type', ''),
      indoor_outdoor = COALESCE(p_event->>'indoor_outdoor', '')
    WHERE a_uuid = client_uuid;
    IF p_event->>'event_uuid' IS NOT NULL AND TRIM(p_event->>'event_uuid') != '' THEN
      UPDATE public.events SET
        event_name = COALESCE(NULLIF(TRIM(p_event->>'event_name'), ''), event_name),
        venue = COALESCE(p_event->>'venue', venue),
        start_date = CASE WHEN TRIM(COALESCE(p_event->>'start_date','')) != '' THEN (TRIM(p_event->>'start_date'))::date ELSE start_date END,
        end_date = CASE WHEN TRIM(COALESCE(p_event->>'end_date','')) != '' THEN (TRIM(p_event->>'end_date'))::date ELSE end_date END,
        start_time = CASE WHEN TRIM(COALESCE(p_event->>'start_time','')) != '' THEN (TRIM(p_event->>'start_time'))::time ELSE start_time END,
        end_time = CASE WHEN TRIM(COALESCE(p_event->>'end_time','')) != '' THEN (TRIM(p_event->>'end_time'))::time ELSE end_time END
      WHERE event_uuid = (p_event->>'event_uuid')::uuid AND client_a_uuid = client_uuid;
    ELSIF EXISTS (SELECT 1 FROM public.events WHERE client_a_uuid = client_uuid) THEN
      UPDATE public.events SET
        event_name = COALESCE(NULLIF(TRIM(p_event->>'event_name'), ''), event_name),
        venue = COALESCE(p_event->>'venue', venue),
        start_date = CASE WHEN TRIM(COALESCE(p_event->>'start_date','')) != '' THEN (TRIM(p_event->>'start_date'))::date ELSE start_date END,
        end_date = CASE WHEN TRIM(COALESCE(p_event->>'end_date','')) != '' THEN (TRIM(p_event->>'end_date'))::date ELSE end_date END,
        start_time = CASE WHEN TRIM(COALESCE(p_event->>'start_time','')) != '' THEN (TRIM(p_event->>'start_time'))::time ELSE start_time END,
        end_time = CASE WHEN TRIM(COALESCE(p_event->>'end_time','')) != '' THEN (TRIM(p_event->>'end_time'))::time ELSE end_time END
      WHERE client_a_uuid = client_uuid
      AND event_uuid = (SELECT event_uuid FROM public.events WHERE client_a_uuid = client_uuid LIMIT 1);
    ELSE
      INSERT INTO public.events (client_a_uuid, event_name, venue, start_date, end_date, start_time, end_time)
      VALUES (
        client_uuid,
        COALESCE(p_event->>'event_name', ''),
        COALESCE(p_event->>'venue', ''),
        CASE WHEN TRIM(COALESCE(p_event->>'start_date','')) != '' THEN (TRIM(p_event->>'start_date'))::date ELSE NULL END,
        CASE WHEN TRIM(COALESCE(p_event->>'end_date','')) != '' THEN (TRIM(p_event->>'end_date'))::date ELSE NULL END,
        CASE WHEN TRIM(COALESCE(p_event->>'start_time','')) != '' THEN (TRIM(p_event->>'start_time'))::time ELSE NULL END,
        CASE WHEN TRIM(COALESCE(p_event->>'end_time','')) != '' THEN (TRIM(p_event->>'end_time'))::time ELSE NULL END
      );
    END IF;
  END IF;

  SELECT to_jsonb(c) INTO result FROM public.client c WHERE c.client_a_uuid = client_uuid;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_client_profile(jsonb, text, jsonb, jsonb, jsonb, jsonb) TO anon;
