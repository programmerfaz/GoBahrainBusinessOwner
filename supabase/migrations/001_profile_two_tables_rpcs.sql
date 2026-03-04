-- =============================================================================
-- Profile RPCs: two tables per type (client + subtype only)
-- - Restaurant: client → restaurant_client
-- - Place: client → place (category, indoor_outdoor on place)
-- - Event organizer: client → events (event_type, indoor_outdoor on events)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- get_client_full: returns client + one subtype row (merged for Pinecone)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_client_full(p_client_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  c jsonb;
  rc jsonb;
  pl jsonb;
  ev jsonb;
  ev_arr jsonb;
  ctype text;
BEGIN
  SELECT to_jsonb(c0) INTO c FROM public.client c0 WHERE c0.client_a_uuid = p_client_uuid;
  IF c IS NULL THEN
    RETURN NULL;
  END IF;

  ctype := c->>'client_type';
  IF ctype = 'restaurant' THEN
    SELECT to_jsonb(rc0) INTO rc FROM public.restaurant_client rc0 WHERE rc0.a_uuid = p_client_uuid;
    result := c || COALESCE(rc, '{}'::jsonb) || jsonb_build_object('tags', COALESCE(c->'tags', '[]'::jsonb));
  ELSIF ctype = 'place' THEN
    SELECT to_jsonb(pl0) INTO pl FROM public.place pl0 WHERE pl0.a_uuid = p_client_uuid;
    result := c || COALESCE(pl, '{}'::jsonb) || jsonb_build_object(
      'place_uuid', pl->>'place_uuid',
      'place_name', pl->>'name',
      'name', pl->>'name',
      'place_description', pl->>'description',
      'opening_time', pl->>'opening_time',
      'closing_time', pl->>'closing_time',
      'entry_cost', pl->>'entry_cost',
      'suitable_for', pl->>'suitable_for',
      'category', pl->>'category',
      'indoor_outdoor', pl->>'indoor_outdoor',
      'tags', COALESCE(c->'tags', '[]'::jsonb)
    );
  ELSIF ctype = 'event_organizer' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(ev0) ORDER BY ev0.start_date NULLS LAST), '[]'::jsonb)
      INTO ev_arr FROM public.events ev0 WHERE ev0.client_a_uuid = p_client_uuid;
    SELECT to_jsonb(ev0) INTO ev FROM public.events ev0 WHERE ev0.client_a_uuid = p_client_uuid LIMIT 1;
    result := c || COALESCE(ev, '{}'::jsonb) || jsonb_build_object(
      'event_type', ev->>'event_type',
      'indoor_outdoor', ev->>'indoor_outdoor',
      'tags', COALESCE(c->'tags', '[]'::jsonb),
      'events', COALESCE(ev_arr, '[]'::jsonb)
    );
  ELSE
    result := c;
  END IF;

  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_client_full(uuid) TO anon;

-- -----------------------------------------------------------------------------
-- create_client_profile: INSERT client first, then subtype (one of three)
-- -----------------------------------------------------------------------------
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
  place_uuid_val uuid;
  event_uuid_val uuid;
BEGIN
  client_uuid := (p_client->>'client_a_uuid')::uuid;
  v_rating := CASE WHEN TRIM(COALESCE(p_client->>'rating','')) != ''
                  THEN (TRIM(p_client->>'rating'))::numeric ELSE NULL END;
  v_lat := CASE WHEN TRIM(COALESCE(p_client->>'lat','')) != ''
               THEN (TRIM(p_client->>'lat'))::numeric ELSE NULL END;
  v_long := CASE WHEN TRIM(COALESCE(p_client->>'long','')) != ''
                THEN (TRIM(p_client->>'long'))::numeric ELSE NULL END;

  -- 1. Always insert client first
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
    "long",
    timings,
    qrcode,
    tags
  ) VALUES (
    client_uuid,
    (p_client->>'account_a_uuid')::uuid,
    COALESCE(NULLIF(TRIM(p_client->>'business_name'), ''), ''),
    NULLIF(TRIM(COALESCE(p_client->>'description', '')), ''),
    v_rating,
    NULLIF(TRIM(p_client->>'price_range'), ''),
    CASE WHEN p_type_choice = 'none' OR p_type_choice = '' THEN 'client' ELSE p_type_choice END,
    NULLIF(TRIM(COALESCE(p_client->>'client_image', '')), ''),
    v_lat,
    v_long,
    NULLIF(TRIM(COALESCE(p_client->>'timings', '')), ''),
    client_uuid::text,
    COALESCE(
      CASE WHEN jsonb_typeof(COALESCE(p_client->'tags','null'::jsonb)) = 'array' THEN p_client->'tags'
           WHEN TRIM(COALESCE(p_client->>'tags','')) != '' THEN (SELECT COALESCE(jsonb_agg(trimmed), '[]'::jsonb) FROM (SELECT trim(unnest(string_to_array(p_client->>'tags', ','))) AS trimmed) x WHERE trimmed != '')
           ELSE '[]'::jsonb END,
      '[]'::jsonb)
  );

  -- 2. Insert subtype: restaurant_client | place | events (exactly one)
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
  ELSIF p_type_choice = 'place' AND (p_place IS NOT NULL OR p_place_client IS NOT NULL) THEN
    place_uuid_val := COALESCE((p_place->>'place_uuid')::uuid, gen_random_uuid());
    INSERT INTO public.place (
      place_uuid, a_uuid, name, description, opening_time, closing_time,
      entry_cost, suitable_for, category, indoor_outdoor
    )
    VALUES (
      place_uuid_val,
      client_uuid,
      COALESCE(p_place->>'name', p_place->>'place_name', ''),
      NULLIF(TRIM(COALESCE(p_place->>'description', p_place->>'place_description', '')), ''),
      COALESCE(NULLIF(TRIM(COALESCE(p_place->>'opening_time', '')), ''), ''),
      COALESCE(NULLIF(TRIM(COALESCE(p_place->>'closing_time', '')), ''), ''),
      (CASE WHEN TRIM(COALESCE(p_place->>'entry_cost','')) = '' THEN 0 ELSE (TRIM(p_place->>'entry_cost'))::numeric END),
      COALESCE(NULLIF(TRIM(COALESCE(p_place->>'suitable_for', '')), ''), ''),
      COALESCE(p_place->>'category', p_place_client->>'category', ''),
      COALESCE(p_place->>'indoor_outdoor', p_place_client->>'indoor_outdoor', '')
    );
  ELSIF p_type_choice = 'event_organizer' AND p_event IS NOT NULL THEN
    event_uuid_val := COALESCE((p_event->>'event_uuid')::uuid, gen_random_uuid());
    INSERT INTO public.events (
      event_uuid, client_a_uuid, event_name, name, status, venue, image,
      lat, "long", start_date, end_date, start_time, end_time,
      event_type, indoor_outdoor
    )
    VALUES (
      event_uuid_val,
      client_uuid,
      COALESCE(p_event->>'event_name', ''),
      COALESCE(p_event->>'name', p_event->>'event_name', ''),
      COALESCE(NULLIF(TRIM(COALESCE(p_event->>'status', '')), ''), 'coming_soon'),
      COALESCE(p_event->>'venue', ''),
      NULLIF(TRIM(COALESCE(p_event->>'image', '')), ''),
      CASE WHEN TRIM(COALESCE(p_event->>'lat','')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE NULL END,
      CASE WHEN TRIM(COALESCE(p_event->>'long','')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE NULL END,
      COALESCE(NULLIF(TRIM(COALESCE(p_event->>'start_date', '')), ''), ''),
      COALESCE(NULLIF(TRIM(COALESCE(p_event->>'end_date', '')), ''), ''),
      COALESCE(NULLIF(TRIM(COALESCE(p_event->>'start_time', '')), ''), ''),
      COALESCE(NULLIF(TRIM(COALESCE(p_event->>'end_time', '')), ''), ''),
      COALESCE(p_event->>'event_type', ''),
      COALESCE(p_event->>'indoor_outdoor', p_event->>'event_indoor_outdoor', '')
    );
  END IF;

  SELECT to_jsonb(c) INTO result FROM public.client c WHERE c.client_a_uuid = client_uuid;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_client_profile(jsonb, text, jsonb, jsonb, jsonb, jsonb) TO anon;

-- -----------------------------------------------------------------------------
-- update_client_profile: UPDATE client first, then subtype
-- -----------------------------------------------------------------------------
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

  -- 1. Always update client first
  UPDATE public.client SET
    business_name = COALESCE(NULLIF(TRIM(p_client->>'business_name'), ''), business_name),
    description = NULLIF(TRIM(COALESCE(p_client->>'description','')), ''),
    rating = v_rating,
    price_range = NULLIF(TRIM(COALESCE(p_client->>'price_range','')), price_range),
    client_type = CASE WHEN p_type_choice = 'none' OR p_type_choice = '' THEN 'client' ELSE p_type_choice END,
    client_image = NULLIF(TRIM(COALESCE(p_client->>'client_image','')), ''),
    lat = v_lat,
    "long" = v_long,
    timings = NULLIF(TRIM(COALESCE(p_client->>'timings','')), ''),
    tags = COALESCE(
      CASE WHEN jsonb_typeof(COALESCE(p_client->'tags','null'::jsonb)) = 'array' THEN p_client->'tags'
           WHEN TRIM(COALESCE(p_client->>'tags','')) != '' THEN (SELECT COALESCE(jsonb_agg(trimmed), '[]'::jsonb) FROM (SELECT trim(unnest(string_to_array(p_client->>'tags', ','))) AS trimmed) x WHERE trimmed != '')
           ELSE '[]'::jsonb END,
      tags)
  WHERE client_a_uuid = client_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found: %', client_uuid;
  END IF;

  -- 2. Update subtype: restaurant_client | place | events
  IF p_type_choice = 'restaurant' AND p_restaurant IS NOT NULL THEN
    UPDATE public.restaurant_client SET
      cuisine = COALESCE(p_restaurant->>'cuisine', ''),
      meal_type = COALESCE(p_restaurant->>'meal_type', ''),
      food_type = COALESCE(p_restaurant->>'food_type', ''),
      speciality = COALESCE(p_restaurant->>'speciality', ''),
      isfoodtruck = COALESCE((p_restaurant->>'isfoodtruck')::boolean, false)
    WHERE a_uuid = client_uuid;
    IF NOT FOUND THEN
      INSERT INTO public.restaurant_client (a_uuid, cuisine, meal_type, food_type, speciality, isfoodtruck)
      VALUES (
        client_uuid,
        COALESCE(p_restaurant->>'cuisine', ''),
        COALESCE(p_restaurant->>'meal_type', ''),
        COALESCE(p_restaurant->>'food_type', ''),
        COALESCE(p_restaurant->>'speciality', ''),
        COALESCE((p_restaurant->>'isfoodtruck')::boolean, false)
      );
    END IF;
  ELSIF p_type_choice = 'place' AND (p_place IS NOT NULL OR p_place_client IS NOT NULL) THEN
    UPDATE public.place SET
      name = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'name', p_place->>'place_name', '')), ''), name),
      description = NULLIF(TRIM(COALESCE(p_place->>'description', p_place->>'place_description', '')), description),
      opening_time = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'opening_time', '')), ''), opening_time),
      closing_time = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'closing_time', '')), ''), closing_time),
      entry_cost = (CASE WHEN TRIM(COALESCE(p_place->>'entry_cost','')) = '' THEN entry_cost ELSE (TRIM(p_place->>'entry_cost'))::numeric END),
      suitable_for = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'suitable_for', '')), ''), suitable_for),
      category = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'category', p_place_client->>'category', '')), ''), category),
      indoor_outdoor = COALESCE(NULLIF(TRIM(COALESCE(p_place->>'indoor_outdoor', p_place_client->>'indoor_outdoor', '')), ''), indoor_outdoor)
    WHERE a_uuid = client_uuid;
    IF NOT FOUND THEN
      INSERT INTO public.place (place_uuid, a_uuid, name, description, opening_time, closing_time, entry_cost, suitable_for, category, indoor_outdoor)
      VALUES (
        gen_random_uuid(),
        client_uuid,
        COALESCE(p_place->>'name', p_place->>'place_name', ''),
        NULLIF(TRIM(COALESCE(p_place->>'description', p_place->>'place_description', '')), ''),
        COALESCE(p_place->>'opening_time', ''),
        COALESCE(p_place->>'closing_time', ''),
        (CASE WHEN TRIM(COALESCE(p_place->>'entry_cost','')) = '' THEN 0 ELSE (TRIM(p_place->>'entry_cost'))::numeric END),
        COALESCE(p_place->>'suitable_for', ''),
        COALESCE(p_place->>'category', p_place_client->>'category', ''),
        COALESCE(p_place->>'indoor_outdoor', p_place_client->>'indoor_outdoor', '')
      );
    END IF;
  ELSIF p_type_choice = 'event_organizer' AND p_event IS NOT NULL THEN
    IF p_event->>'event_uuid' IS NOT NULL AND TRIM(COALESCE(p_event->>'event_uuid', '')) != '' THEN
      UPDATE public.events SET
        event_name = COALESCE(NULLIF(TRIM(p_event->>'event_name'), ''), event_name),
        name = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'name', '')), ''), name),
        status = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'status', '')), ''), status),
        venue = COALESCE(p_event->>'venue', venue),
        image = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'image', '')), ''), image),
        lat = CASE WHEN TRIM(COALESCE(p_event->>'lat','')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE lat END,
        "long" = CASE WHEN TRIM(COALESCE(p_event->>'long','')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE "long" END,
        start_date = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'start_date', '')), ''), start_date),
        end_date = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'end_date', '')), ''), end_date),
        start_time = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'start_time', '')), ''), start_time),
        end_time = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'end_time', '')), ''), end_time),
        event_type = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'event_type', '')), ''), event_type),
        indoor_outdoor = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'indoor_outdoor', p_event->>'event_indoor_outdoor', '')), ''), indoor_outdoor)
      WHERE event_uuid = (p_event->>'event_uuid')::uuid AND client_a_uuid = client_uuid;
    ELSIF EXISTS (SELECT 1 FROM public.events WHERE client_a_uuid = client_uuid) THEN
      UPDATE public.events SET
        event_name = COALESCE(NULLIF(TRIM(p_event->>'event_name'), ''), event_name),
        name = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'name', '')), ''), name),
        status = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'status', '')), ''), status),
        venue = COALESCE(p_event->>'venue', venue),
        image = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'image', '')), ''), image),
        lat = CASE WHEN TRIM(COALESCE(p_event->>'lat','')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE lat END,
        "long" = CASE WHEN TRIM(COALESCE(p_event->>'long','')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE "long" END,
        start_date = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'start_date', '')), ''), start_date),
        end_date = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'end_date', '')), ''), end_date),
        start_time = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'start_time', '')), ''), start_time),
        end_time = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'end_time', '')), ''), end_time),
        event_type = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'event_type', '')), ''), event_type),
        indoor_outdoor = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'indoor_outdoor', p_event->>'event_indoor_outdoor', '')), ''), indoor_outdoor)
      WHERE client_a_uuid = client_uuid
      AND event_uuid = (SELECT event_uuid FROM public.events WHERE client_a_uuid = client_uuid LIMIT 1);
    ELSE
      INSERT INTO public.events (event_uuid, client_a_uuid, event_name, name, status, venue, image, lat, "long", start_date, end_date, start_time, end_time, event_type, indoor_outdoor)
      VALUES (
        gen_random_uuid(),
        client_uuid,
        COALESCE(p_event->>'event_name', ''),
        COALESCE(p_event->>'name', p_event->>'event_name', ''),
        COALESCE(NULLIF(TRIM(COALESCE(p_event->>'status', '')), ''), 'coming_soon'),
        COALESCE(p_event->>'venue', ''),
        NULLIF(TRIM(COALESCE(p_event->>'image', '')), ''),
        CASE WHEN TRIM(COALESCE(p_event->>'lat','')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE NULL END,
        CASE WHEN TRIM(COALESCE(p_event->>'long','')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE NULL END,
        COALESCE(NULLIF(TRIM(COALESCE(p_event->>'start_date', '')), ''), ''),
        COALESCE(NULLIF(TRIM(COALESCE(p_event->>'end_date', '')), ''), ''),
        COALESCE(NULLIF(TRIM(COALESCE(p_event->>'start_time', '')), ''), ''),
        COALESCE(NULLIF(TRIM(COALESCE(p_event->>'end_time', '')), ''), ''),
        COALESCE(p_event->>'event_type', ''),
        COALESCE(p_event->>'indoor_outdoor', p_event->>'event_indoor_outdoor', '')
      );
    END IF;
  END IF;

  SELECT to_jsonb(c) INTO result FROM public.client c WHERE c.client_a_uuid = client_uuid;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_client_profile(jsonb, text, jsonb, jsonb, jsonb, jsonb) TO anon;

-- -----------------------------------------------------------------------------
-- delete_client_profile: only tables that exist (no place_client, event_organizer_client)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_client_profile(p_client_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.place WHERE a_uuid = p_client_uuid;
  DELETE FROM public.events WHERE client_a_uuid = p_client_uuid;
  DELETE FROM public.restaurant_client WHERE a_uuid = p_client_uuid;
  DELETE FROM public.posts WHERE client_a_uuid = p_client_uuid;
  DELETE FROM public.client WHERE client_a_uuid = p_client_uuid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_client_profile(uuid) TO anon;
