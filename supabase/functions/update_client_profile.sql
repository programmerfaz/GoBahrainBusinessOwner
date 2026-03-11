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
  v_client_uuid uuid;
  result jsonb;
  v_rating numeric;
  v_lat numeric;
  v_long numeric;
  v_type_choice text;
  v_client_type public.client_type;
BEGIN
  v_type_choice := LOWER(TRIM(COALESCE(p_type_choice, '')));
  IF v_type_choice NOT IN ('restaurant', 'place', 'event_organizer') THEN
    RAISE EXCEPTION 'Invalid client type: % (allowed: restaurant, place, event_organizer)', p_type_choice;
  END IF;
  v_client_type := v_type_choice::public.client_type;

  v_client_uuid := (p_client->>'client_a_uuid')::uuid;

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
    client_type = v_client_type,
    client_image = NULLIF(TRIM(COALESCE(p_client->>'client_image','')), ''),
    lat = v_lat,
    long = v_long,
    timings = NULLIF(TRIM(COALESCE(p_client->>'timings','')), ''),
    tags = COALESCE(
      CASE WHEN jsonb_typeof(COALESCE(p_client->'tags','null'::jsonb)) = 'array' THEN p_client->'tags'
           WHEN TRIM(COALESCE(p_client->>'tags','')) != '' THEN (SELECT COALESCE(jsonb_agg(trimmed), '[]'::jsonb) FROM (SELECT trim(unnest(string_to_array(p_client->>'tags', ','))) AS trimmed) x WHERE trimmed != '')
           ELSE '[]'::jsonb END,
      '[]'::jsonb)
  WHERE client_a_uuid = v_client_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found: %', v_client_uuid;
  END IF;

  -- Update subtype
  IF v_type_choice = 'restaurant' AND p_restaurant IS NOT NULL THEN
    UPDATE public.restaurant_client SET
      cuisine = COALESCE(p_restaurant->>'cuisine', ''),
      meal_type = COALESCE(p_restaurant->>'meal_type', ''),
      food_type = COALESCE(p_restaurant->>'food_type', ''),
      speciality = COALESCE(p_restaurant->>'speciality', ''),
      isfoodtruck = COALESCE((p_restaurant->>'isfoodtruck')::boolean, false)
    WHERE a_uuid = v_client_uuid;
  ELSIF v_type_choice = 'place' AND (p_place_client IS NOT NULL OR p_place IS NOT NULL) THEN
    UPDATE public.place p SET
      name = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'name', p_place->>'place_name', '')), ''), p.name),
      description = NULLIF(TRIM(COALESCE(p_place->>'description', p_place->>'place_description', '')), p.description),
      opening_time = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'opening_time', '')), ''), p.opening_time),
      closing_time = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'closing_time', '')), ''), p.closing_time),
      entry_cost = (CASE WHEN TRIM(COALESCE(p_place->>'entry_cost','')) = '' THEN p.entry_cost ELSE (TRIM(p_place->>'entry_cost'))::numeric END),
      suitable_for = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'suitable_for', '')), ''), p.suitable_for),
      category = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'category', p_place_client->>'category', '')), ''), p.category),
      indoor_outdoor = (CASE WHEN TRIM(COALESCE(p_place->>'indoor_outdoor', p_place_client->>'indoor_outdoor', '')) != '' THEN (TRIM(COALESCE(p_place->>'indoor_outdoor', p_place_client->>'indoor_outdoor', '')))::public.indoor_outdoor ELSE p.indoor_outdoor END)
    WHERE p.client_uuid = v_client_uuid;
    IF NOT FOUND THEN
      INSERT INTO public.place (client_uuid, name, description, opening_time, closing_time, entry_cost, suitable_for, category, indoor_outdoor)
      VALUES (
        v_client_uuid,
        COALESCE(p_place->>'name', p_place->>'place_name', ''),
        NULLIF(TRIM(COALESCE(p_place->>'description', p_place->>'place_description', '')), ''),
        NULLIF(TRIM(COALESCE(p_place->>'opening_time', '')), ''),
        NULLIF(TRIM(COALESCE(p_place->>'closing_time', '')), ''),
        (CASE WHEN TRIM(COALESCE(p_place->>'entry_cost','')) = '' THEN NULL ELSE (TRIM(p_place->>'entry_cost'))::numeric END),
        NULLIF(TRIM(COALESCE(p_place->>'suitable_for', '')), ''),
        NULLIF(TRIM(COALESCE(p_place->>'category', p_place_client->>'category', '')), ''),
        (CASE WHEN TRIM(COALESCE(p_place->>'indoor_outdoor', p_place_client->>'indoor_outdoor', '')) != '' THEN (TRIM(COALESCE(p_place->>'indoor_outdoor', p_place_client->>'indoor_outdoor', '')))::public.indoor_outdoor ELSE NULL END)
      );
    END IF;
  ELSIF v_type_choice = 'event' AND p_event IS NOT NULL THEN
    -- event_type and indoor_outdoor updated on client above
    IF p_event->>'event_uuid' IS NOT NULL AND TRIM(p_event->>'event_uuid') != '' THEN
      UPDATE public.events SET
        event_name = COALESCE(NULLIF(TRIM(p_event->>'event_name'), ''), event_name),
        name = COALESCE(NULLIF(TRIM(p_event->>'name'), ''), name),
        status = COALESCE(NULLIF(TRIM(p_event->>'status'), ''), status),
        venue = COALESCE(p_event->>'venue', venue),
        image = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'image','')), ''), image),
        lat = CASE WHEN TRIM(COALESCE(p_event->>'lat','')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE lat END,
        "long" = CASE WHEN TRIM(COALESCE(p_event->>'long','')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE "long" END,
        start_date = CASE WHEN TRIM(COALESCE(p_event->>'start_date','')) != '' THEN (TRIM(p_event->>'start_date'))::date ELSE start_date END,
        end_date = CASE WHEN TRIM(COALESCE(p_event->>'end_date','')) != '' THEN (TRIM(p_event->>'end_date'))::date ELSE end_date END,
        start_time = CASE WHEN TRIM(COALESCE(p_event->>'start_time','')) != '' THEN (TRIM(p_event->>'start_time'))::time ELSE start_time END,
        end_time = CASE WHEN TRIM(COALESCE(p_event->>'end_time','')) != '' THEN (TRIM(p_event->>'end_time'))::time ELSE end_time END
      WHERE event_uuid = (p_event->>'event_uuid')::uuid AND client_a_uuid = v_client_uuid;
    ELSIF EXISTS (SELECT 1 FROM public.events WHERE client_a_uuid = v_client_uuid) THEN
      UPDATE public.events SET
        event_name = COALESCE(NULLIF(TRIM(p_event->>'event_name'), ''), event_name),
        name = COALESCE(NULLIF(TRIM(p_event->>'name'), ''), name),
        status = COALESCE(NULLIF(TRIM(p_event->>'status'), ''), status),
        venue = COALESCE(p_event->>'venue', venue),
        image = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'image','')), ''), image),
        lat = CASE WHEN TRIM(COALESCE(p_event->>'lat','')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE lat END,
        "long" = CASE WHEN TRIM(COALESCE(p_event->>'long','')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE "long" END,
        start_date = CASE WHEN TRIM(COALESCE(p_event->>'start_date','')) != '' THEN (TRIM(p_event->>'start_date'))::date ELSE start_date END,
        end_date = CASE WHEN TRIM(COALESCE(p_event->>'end_date','')) != '' THEN (TRIM(p_event->>'end_date'))::date ELSE end_date END,
        start_time = CASE WHEN TRIM(COALESCE(p_event->>'start_time','')) != '' THEN (TRIM(p_event->>'start_time'))::time ELSE start_time END,
        end_time = CASE WHEN TRIM(COALESCE(p_event->>'end_time','')) != '' THEN (TRIM(p_event->>'end_time'))::time ELSE end_time END
      WHERE client_a_uuid = v_client_uuid
      AND event_uuid = (SELECT event_uuid FROM public.events WHERE client_a_uuid = v_client_uuid LIMIT 1);
    ELSE
      INSERT INTO public.events (client_a_uuid, event_name, name, status, venue, image, lat, "long", start_date, end_date, start_time, end_time)
      VALUES (
        v_client_uuid,
        COALESCE(p_event->>'event_name', ''),
        COALESCE(p_event->>'name', p_event->>'event_name', ''),
        COALESCE(NULLIF(TRIM(p_event->>'status'), ''), 'coming_soon'),
        COALESCE(p_event->>'venue', ''),
        NULLIF(TRIM(COALESCE(p_event->>'image','')), ''),
        CASE WHEN TRIM(COALESCE(p_event->>'lat','')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE NULL END,
        CASE WHEN TRIM(COALESCE(p_event->>'long','')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE NULL END,
        CASE WHEN TRIM(COALESCE(p_event->>'start_date','')) != '' THEN (TRIM(p_event->>'start_date'))::date ELSE NULL END,
        CASE WHEN TRIM(COALESCE(p_event->>'end_date','')) != '' THEN (TRIM(p_event->>'end_date'))::date ELSE NULL END,
        CASE WHEN TRIM(COALESCE(p_event->>'start_time','')) != '' THEN (TRIM(p_event->>'start_time'))::time ELSE NULL END,
        CASE WHEN TRIM(COALESCE(p_event->>'end_time','')) != '' THEN (TRIM(p_event->>'end_time'))::time ELSE NULL END
      );
    END IF;
  END IF;

  SELECT to_jsonb(c) INTO result FROM public.client c WHERE c.client_a_uuid = v_client_uuid;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_client_profile(jsonb, text, jsonb, jsonb, jsonb, jsonb) TO anon;
