-- =============================================================================
-- GoBahrain Full Schema Duplicate (structure only, no data)
-- Covers: sign in / sign up (account), client profile, restaurant, place,
--         event organizer, events, posts. Run on a fresh project to duplicate
--         the database structure.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ACCOUNT (sign in / sign up)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account (
  account_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password text NOT NULL,
  name text DEFAULT '',
  phone text DEFAULT ''
);

-- -----------------------------------------------------------------------------
-- 2. CLIENT (base profile for all business types)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client (
  client_a_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_a_uuid uuid NOT NULL REFERENCES public.account(account_uuid) ON DELETE CASCADE,
  business_name text NOT NULL DEFAULT '',
  description text,
  rating numeric,
  price_range text,
  client_type text NOT NULL DEFAULT 'client',
  client_image text,
  lat numeric,
  "long" numeric,
  timings text,
  qrcode text,
  tags jsonb DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_client_account_a_uuid ON public.client(account_a_uuid);

-- -----------------------------------------------------------------------------
-- 3. RESTAURANT (restaurant client subtype)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_client (
  a_uuid uuid PRIMARY KEY REFERENCES public.client(client_a_uuid) ON DELETE CASCADE,
  cuisine text NOT NULL DEFAULT '',
  meal_type text NOT NULL DEFAULT '',
  food_type text NOT NULL DEFAULT '',
  speciality text NOT NULL DEFAULT '',
  isfoodtruck boolean NOT NULL DEFAULT false
);

-- -----------------------------------------------------------------------------
-- 4. PLACE (place client subtype + place details)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.place_client (
  a_uuid uuid PRIMARY KEY REFERENCES public.client(client_a_uuid) ON DELETE CASCADE,
  category text NOT NULL DEFAULT '',
  indoor_outdoor text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.place (
  place_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_uuid uuid NOT NULL REFERENCES public.client(client_a_uuid) ON DELETE CASCADE,
  name text DEFAULT '',
  description text,
  opening_time text DEFAULT '',
  closing_time text DEFAULT '',
  entry_cost numeric DEFAULT 0,
  suitable_for text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_place_a_uuid ON public.place(a_uuid);

-- -----------------------------------------------------------------------------
-- 5. EVENT ORGANIZER (event organizer client subtype)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_organizer_client (
  a_uuid uuid PRIMARY KEY REFERENCES public.client(client_a_uuid) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT '',
  indoor_outdoor text NOT NULL DEFAULT ''
);

-- Legacy table (same structure, used in some migrations)
CREATE TABLE IF NOT EXISTS public.event_clients (
  a_uuid uuid PRIMARY KEY REFERENCES public.client(client_a_uuid) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT '',
  indoor_outdoor text NOT NULL DEFAULT ''
);

-- -----------------------------------------------------------------------------
-- 6. EVENTS (individual events for event organizers)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  event_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_a_uuid uuid NOT NULL REFERENCES public.client(client_a_uuid) ON DELETE CASCADE,
  event_name text NOT NULL DEFAULT '',
  name text DEFAULT '',
  status text DEFAULT 'coming_soon',
  venue text DEFAULT '',
  image text,
  lat numeric,
  "long" numeric,
  start_date text DEFAULT '',
  end_date text DEFAULT '',
  start_time text DEFAULT '',
  end_time text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_events_client_a_uuid ON public.events(client_a_uuid);

-- -----------------------------------------------------------------------------
-- 7. POSTS (client posts / offerings)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  post_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_a_uuid uuid NOT NULL REFERENCES public.client(client_a_uuid) ON DELETE CASCADE,
  title text DEFAULT '',
  content text,
  image_url text,
  description text,
  price_range text,
  post_image text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_client_a_uuid ON public.posts(client_a_uuid);

-- =============================================================================
-- ROW LEVEL SECURITY (sign in / sign up)
-- =============================================================================
ALTER TABLE public.account ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select account" ON public.account;
CREATE POLICY "Allow anon select account"
  ON public.account FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert account" ON public.account;
CREATE POLICY "Allow anon insert account"
  ON public.account FOR INSERT
  TO anon
  WITH CHECK (true);

-- =============================================================================
-- STORAGE (post images bucket)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('gobahrain-post-images', 'gobahrain-post-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow uploads to post images" ON storage.objects;
CREATE POLICY "Allow uploads to post images"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'gobahrain-post-images');

DROP POLICY IF EXISTS "Allow read post images" ON storage.objects;
CREATE POLICY "Allow read post images"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'gobahrain-post-images');

-- =============================================================================
-- RPC: sign_in (bypasses RLS for auth)
-- =============================================================================
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
GRANT EXECUTE ON FUNCTION public.sign_in(text, text) TO anon;

-- =============================================================================
-- RPC: get_clients_for_account
-- =============================================================================
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

-- =============================================================================
-- RPC: get_client_full
-- =============================================================================
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
  pc jsonb;
  pl jsonb;
  ec jsonb;
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
    SELECT to_jsonb(pc0) INTO pc FROM public.place_client pc0 WHERE pc0.a_uuid = p_client_uuid;
    SELECT to_jsonb(pl0) INTO pl FROM public.place pl0 WHERE pl0.a_uuid = p_client_uuid;
    result := c || COALESCE(pc, '{}'::jsonb) || jsonb_build_object(
      'place_uuid', pl->>'place_uuid',
      'name', pl->>'name',
      'place_name', pl->>'name',
      'place_description', pl->>'description',
      'opening_time', pl->>'opening_time',
      'closing_time', pl->>'closing_time',
      'entry_cost', pl->>'entry_cost',
      'suitable_for', pl->>'suitable_for',
      'tags', COALESCE(c->'tags', '[]'::jsonb)
    );
  ELSIF ctype = 'event_organizer' THEN
    SELECT to_jsonb(ec0) INTO ec FROM public.event_organizer_client ec0 WHERE ec0.a_uuid = p_client_uuid;
    result := c || COALESCE(ec, '{}'::jsonb) || jsonb_build_object('tags', COALESCE(c->'tags', '[]'::jsonb));
    BEGIN
      SELECT COALESCE(jsonb_agg(ev ORDER BY ev->>'start_date' NULLS LAST), '[]'::jsonb)
      INTO ec FROM (SELECT to_jsonb(ev0) AS ev FROM public.events ev0 WHERE ev0.client_a_uuid = p_client_uuid) sub;
      result := result || jsonb_build_object('events', ec);
    EXCEPTION WHEN undefined_table THEN
      result := result || jsonb_build_object('events', '[]'::jsonb);
    END;
  ELSE
    result := c;
  END IF;

  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_client_full(uuid) TO anon;

-- =============================================================================
-- RPC: create_client_profile
-- =============================================================================
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
    "long",
    timings,
    qrcode,
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
    client_uuid::text,
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
      CASE WHEN TRIM(COALESCE(p_event->>'start_date','')) != '' THEN (TRIM(p_event->>'start_date'))::text ELSE '' END,
      CASE WHEN TRIM(COALESCE(p_event->>'end_date','')) != '' THEN (TRIM(p_event->>'end_date'))::text ELSE '' END,
      CASE WHEN TRIM(COALESCE(p_event->>'start_time','')) != '' THEN (TRIM(p_event->>'start_time'))::text ELSE '' END,
      CASE WHEN TRIM(COALESCE(p_event->>'end_time','')) != '' THEN (TRIM(p_event->>'end_time'))::text ELSE '' END
    );
  END IF;

  SELECT to_jsonb(c) INTO result FROM public.client c WHERE c.client_a_uuid = client_uuid;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_client_profile(jsonb, text, jsonb, jsonb, jsonb, jsonb) TO anon;

-- =============================================================================
-- RPC: update_client_profile
-- =============================================================================
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

  UPDATE public.client SET
    business_name = COALESCE(p_client->>'business_name', business_name),
    description = NULLIF(TRIM(COALESCE(p_client->>'description','')), ''),
    rating = v_rating,
    price_range = NULLIF(TRIM(COALESCE(p_client->>'price_range','')), ''),
    client_type = CASE WHEN p_type_choice = 'none' THEN 'client' ELSE p_type_choice END,
    client_image = NULLIF(TRIM(COALESCE(p_client->>'client_image','')), ''),
    lat = v_lat,
    "long" = v_long,
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
    UPDATE public.event_organizer_client SET
      event_type = COALESCE(p_event->>'event_type', ''),
      indoor_outdoor = COALESCE(p_event->>'indoor_outdoor', '')
    WHERE a_uuid = client_uuid;
    IF p_event->>'event_uuid' IS NOT NULL AND TRIM(p_event->>'event_uuid') != '' THEN
      UPDATE public.events SET
        event_name = COALESCE(NULLIF(TRIM(p_event->>'event_name'), ''), event_name),
        name = COALESCE(NULLIF(TRIM(p_event->>'name'), ''), name),
        status = COALESCE(NULLIF(TRIM(p_event->>'status'), ''), status),
        venue = COALESCE(p_event->>'venue', venue),
        image = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'image','')), ''), image),
        lat = CASE WHEN TRIM(COALESCE(p_event->>'lat','')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE lat END,
        "long" = CASE WHEN TRIM(COALESCE(p_event->>'long','')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE "long" END,
        start_date = CASE WHEN TRIM(COALESCE(p_event->>'start_date','')) != '' THEN (TRIM(p_event->>'start_date'))::text ELSE start_date END,
        end_date = CASE WHEN TRIM(COALESCE(p_event->>'end_date','')) != '' THEN (TRIM(p_event->>'end_date'))::text ELSE end_date END,
        start_time = CASE WHEN TRIM(COALESCE(p_event->>'start_time','')) != '' THEN (TRIM(p_event->>'start_time'))::text ELSE start_time END,
        end_time = CASE WHEN TRIM(COALESCE(p_event->>'end_time','')) != '' THEN (TRIM(p_event->>'end_time'))::text ELSE end_time END
      WHERE event_uuid = (p_event->>'event_uuid')::uuid AND client_a_uuid = client_uuid;
    ELSIF EXISTS (SELECT 1 FROM public.events WHERE client_a_uuid = client_uuid) THEN
      UPDATE public.events SET
        event_name = COALESCE(NULLIF(TRIM(p_event->>'event_name'), ''), event_name),
        name = COALESCE(NULLIF(TRIM(p_event->>'name'), ''), name),
        status = COALESCE(NULLIF(TRIM(p_event->>'status'), ''), status),
        venue = COALESCE(p_event->>'venue', venue),
        image = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'image','')), ''), image),
        lat = CASE WHEN TRIM(COALESCE(p_event->>'lat','')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE lat END,
        "long" = CASE WHEN TRIM(COALESCE(p_event->>'long','')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE "long" END,
        start_date = CASE WHEN TRIM(COALESCE(p_event->>'start_date','')) != '' THEN (TRIM(p_event->>'start_date'))::text ELSE start_date END,
        end_date = CASE WHEN TRIM(COALESCE(p_event->>'end_date','')) != '' THEN (TRIM(p_event->>'end_date'))::text ELSE end_date END,
        start_time = CASE WHEN TRIM(COALESCE(p_event->>'start_time','')) != '' THEN (TRIM(p_event->>'start_time'))::text ELSE start_time END,
        end_time = CASE WHEN TRIM(COALESCE(p_event->>'end_time','')) != '' THEN (TRIM(p_event->>'end_time'))::text ELSE end_time END
      WHERE client_a_uuid = client_uuid
      AND event_uuid = (SELECT event_uuid FROM public.events WHERE client_a_uuid = client_uuid LIMIT 1);
    ELSE
      INSERT INTO public.events (client_a_uuid, event_name, name, status, venue, image, lat, "long", start_date, end_date, start_time, end_time)
      VALUES (
        client_uuid,
        COALESCE(p_event->>'event_name', ''),
        COALESCE(p_event->>'name', p_event->>'event_name', ''),
        COALESCE(NULLIF(TRIM(p_event->>'status'), ''), 'coming_soon'),
        COALESCE(p_event->>'venue', ''),
        NULLIF(TRIM(COALESCE(p_event->>'image','')), ''),
        CASE WHEN TRIM(COALESCE(p_event->>'lat','')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE NULL END,
        CASE WHEN TRIM(COALESCE(p_event->>'long','')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE NULL END,
        CASE WHEN TRIM(COALESCE(p_event->>'start_date','')) != '' THEN (TRIM(p_event->>'start_date'))::text ELSE '' END,
        CASE WHEN TRIM(COALESCE(p_event->>'end_date','')) != '' THEN (TRIM(p_event->>'end_date'))::text ELSE '' END,
        CASE WHEN TRIM(COALESCE(p_event->>'start_time','')) != '' THEN (TRIM(p_event->>'start_time'))::text ELSE '' END,
        CASE WHEN TRIM(COALESCE(p_event->>'end_time','')) != '' THEN (TRIM(p_event->>'end_time'))::text ELSE '' END
      );
    END IF;
  END IF;

  SELECT to_jsonb(c) INTO result FROM public.client c WHERE c.client_a_uuid = client_uuid;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_client_profile(jsonb, text, jsonb, jsonb, jsonb, jsonb) TO anon;

-- =============================================================================
-- RPC: delete_client_profile
-- =============================================================================
CREATE OR REPLACE FUNCTION public.delete_client_profile(p_client_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.place WHERE a_uuid = p_client_uuid;
  DELETE FROM public.place_client WHERE a_uuid = p_client_uuid;
  DELETE FROM public.events WHERE client_a_uuid = p_client_uuid;
  DELETE FROM public.restaurant_client WHERE a_uuid = p_client_uuid;
  BEGIN
    DELETE FROM public.event_organizer_client WHERE a_uuid = p_client_uuid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  DELETE FROM public.posts WHERE client_a_uuid = p_client_uuid;
  DELETE FROM public.client WHERE client_a_uuid = p_client_uuid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_client_profile(uuid) TO anon;

-- =============================================================================
-- RPC: get_posts_for_client, create_post, update_post
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_posts_for_client(p_client_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT post_uuid, client_a_uuid, title, content, image_url, description, price_range, post_image, created_at
    FROM public.posts
    WHERE client_a_uuid = p_client_uuid
  ) p;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_posts_for_client(uuid) TO anon;

CREATE OR REPLACE FUNCTION public.create_post(
  p_client_uuid uuid,
  p_title text DEFAULT NULL,
  p_content text DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_price_range text DEFAULT NULL,
  p_post_image text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  new_post public.posts;
BEGIN
  INSERT INTO public.posts (client_a_uuid, title, content, image_url, description, price_range, post_image)
  VALUES (p_client_uuid, COALESCE(p_title, ''), p_content, p_image_url, p_description, p_price_range, p_post_image)
  RETURNING * INTO new_post;
  SELECT to_jsonb(new_post) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_post(uuid, text, text, text, text, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.update_post(
  p_post_uuid uuid,
  p_description text DEFAULT NULL,
  p_price_range text DEFAULT NULL,
  p_post_image text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  updated_post public.posts;
BEGIN
  UPDATE public.posts SET
    description = COALESCE(NULLIF(TRIM(p_description), ''), description),
    price_range = COALESCE(p_price_range, price_range),
    post_image = COALESCE(p_post_image, post_image)
  WHERE post_uuid = p_post_uuid
  RETURNING * INTO updated_post;

  IF updated_post IS NULL THEN
    RAISE EXCEPTION 'Post not found: %', p_post_uuid;
  END IF;

  SELECT to_jsonb(updated_post) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_post(uuid, text, text, text) TO anon;
