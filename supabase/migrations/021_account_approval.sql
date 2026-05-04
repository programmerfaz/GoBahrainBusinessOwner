-- Business owner accounts: new signups are unapproved until an admin approves them.
-- Existing rows are marked approved so current users are not locked out.

ALTER TABLE public.account
  ADD COLUMN IF NOT EXISTS account_approved boolean NOT NULL DEFAULT false;

-- One-time backfill: existing accounts before this migration stay approved (migration runs once).
UPDATE public.account SET account_approved = true;

-- New signups default to pending (RPC sets false explicitly; column default is false).

-- Called from other SECURITY DEFINER RPCs; runs as function owner to read account + client.
CREATE OR REPLACE FUNCTION public.require_owner_account_approved_for_client(p_client_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.client c
    INNER JOIN public.account a ON a.account_uuid = c.account_a_uuid
    WHERE c.client_a_uuid = p_client_uuid
      AND a.account_approved IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Your account is pending admin approval. You cannot edit or publish until it is approved.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_owner_account_approved_for_account(p_account_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.account a
    WHERE a.account_uuid = p_account_uuid
      AND a.account_approved IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Your account is pending admin approval. You cannot edit or publish until it is approved.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.require_owner_account_approved_for_client(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.require_owner_account_approved_for_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_owner_account_approved_for_client(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.require_owner_account_approved_for_account(uuid) TO anon, authenticated, service_role;

-- Signup RPC: new accounts start as not approved.
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

  INSERT INTO public.account (email, user_name, phone, account_type, auth_user_id, auth_id, account_approved)
  VALUES (
    COALESCE(TRIM(p_email), ''),
    COALESCE(TRIM(p_name), ''),
    COALESCE(TRIM(p_phone), ''),
    'client'::public.account_type,
    v_auth_id,
    v_auth_id,
    false
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

-- Admin approves a business owner account (platform admins only).
CREATE OR REPLACE FUNCTION public.admin_approve_account(p_account_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_n int;
  v_row jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins WHERE admin_id = v_uid) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.account SET account_approved = true WHERE account_uuid = p_account_uuid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  SELECT to_jsonb(a) INTO v_row FROM public.account a WHERE a.account_uuid = p_account_uuid;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_account(uuid) TO service_role;

-- Admin list: include approval flag for console UI.
CREATE OR REPLACE FUNCTION public.admin_list_clients_for_console()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE admin_id = v_uid) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'client_a_uuid',       c.client_a_uuid,
          'account_a_uuid',      c.account_a_uuid,
          'business_name',       c.business_name,
          'description',         c.description,
          'client_type',         c.client_type,
          'client_image',        c.client_image,
          'rating',              c.rating,
          'price_range',         c.price_range,
          'lat',                 c.lat,
          'long',                c."long",
          'timings',             c.timings,
          'qrcode',              c.qrcode,
          'tags',                c.tags,
          'account_email',       a.email,
          'account_user_name',   a.user_name,
          'account_phone',       a.phone,
          'account_approved',    COALESCE(a.account_approved, false)
        )
        ORDER BY a.account_approved ASC NULLS FIRST, c.business_name
      ),
      '[]'::jsonb
    )
    FROM public.client c
    INNER JOIN public.account a ON a.account_uuid = c.account_a_uuid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_clients_for_console() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_clients_for_console() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_clients_for_console() TO service_role;

-- Posts
CREATE OR REPLACE FUNCTION public.create_post(
  p_client_uuid uuid,
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
  PERFORM public.require_owner_account_approved_for_client(p_client_uuid);

  INSERT INTO public.posts (client_a_uuid, description, price_range, post_image)
  VALUES (p_client_uuid, p_description, p_price_range, p_post_image)
  RETURNING * INTO new_post;
  SELECT to_jsonb(new_post) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_post(uuid, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_post(uuid, text, text, text) TO authenticated;

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
  v_client uuid;
BEGIN
  SELECT client_a_uuid INTO v_client FROM public.posts WHERE post_uuid = p_post_uuid;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Post not found: %', p_post_uuid;
  END IF;
  PERFORM public.require_owner_account_approved_for_client(v_client);

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
GRANT EXECUTE ON FUNCTION public.update_post(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_post(
  p_post_uuid uuid,
  p_client_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  PERFORM public.require_owner_account_approved_for_client(p_client_uuid);

  SELECT client_a_uuid INTO v_owner
  FROM public.posts
  WHERE post_uuid = p_post_uuid;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_owner <> p_client_uuid THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  BEGIN
    DELETE FROM public.post_upvote WHERE post_uuid = p_post_uuid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  DELETE FROM public.posts
  WHERE post_uuid = p_post_uuid
    AND client_a_uuid = p_client_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post delete failed';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_post(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.delete_post(uuid, uuid) TO authenticated;

-- Profile RPCs (same bodies as app functions; approval gate added)
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
  PERFORM public.require_owner_account_approved_for_client(v_client_uuid);

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
  PERFORM public.require_owner_account_approved_for_account((p_client->>'account_a_uuid')::uuid);

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
    tags,
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
    COALESCE(
      CASE WHEN jsonb_typeof(COALESCE(p_client->'tags','null'::jsonb)) = 'array' THEN p_client->'tags'
           WHEN TRIM(COALESCE(p_client->>'tags','')) != '' THEN (SELECT COALESCE(jsonb_agg(trimmed), '[]'::jsonb) FROM (SELECT trim(unnest(string_to_array(p_client->>'tags', ','))) AS trimmed) x WHERE trimmed != '')
           ELSE '[]'::jsonb END,
      '[]'::jsonb),
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
  ELSIF v_type_choice = 'event' AND p_event IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION public.set_restaurant_branches(
  p_client_uuid uuid,
  p_branch jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_owner_account_approved_for_client(p_client_uuid);

  UPDATE public.restaurant_client
  SET branch = COALESCE(
    CASE
      WHEN jsonb_typeof(COALESCE(p_branch, 'null'::jsonb)) = 'array' THEN p_branch
      ELSE '[]'::jsonb
    END,
    '[]'::jsonb
  )
  WHERE a_uuid = p_client_uuid;

  IF NOT FOUND THEN
    INSERT INTO public.restaurant_client (a_uuid, cuisine, meal_type, food_type, speciality, isfoodtruck, branch)
    VALUES (
      p_client_uuid,
      '',
      '',
      '',
      '',
      false,
      COALESCE(
        CASE
          WHEN jsonb_typeof(COALESCE(p_branch, 'null'::jsonb)) = 'array' THEN p_branch
          ELSE '[]'::jsonb
        END,
        '[]'::jsonb
      )
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_restaurant_branches(uuid, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_client_ai_summary(
  p_client_uuid uuid,
  p_summary text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_owner_account_approved_for_client(p_client_uuid);

  UPDATE public.client
  SET ai_summary = NULLIF(TRIM(p_summary), '')
  WHERE client_a_uuid = p_client_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found: %', p_client_uuid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_client_ai_summary(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.set_client_ai_summary(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_client_ai_summary(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_client_profile(p_client_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_owner_account_approved_for_client(p_client_uuid);

  DELETE FROM public.place WHERE client_uuid = p_client_uuid;
  DELETE FROM public.events WHERE client_a_uuid = p_client_uuid;
  DELETE FROM public.restaurant_client WHERE a_uuid = p_client_uuid;
  DELETE FROM public.posts WHERE client_a_uuid = p_client_uuid;
  DELETE FROM public.client WHERE client_a_uuid = p_client_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_client_profile(uuid) TO anon;

CREATE OR REPLACE FUNCTION public.create_event_for_client(
  p_client_uuid uuid,
  p_event jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  ctype text;
BEGIN
  SELECT client_type::text INTO ctype
  FROM public.client
  WHERE client_a_uuid = p_client_uuid;

  IF ctype IS NULL THEN
    RAISE EXCEPTION 'Client not found: %', p_client_uuid;
  END IF;
  IF ctype <> 'event_organizer' THEN
    RAISE EXCEPTION 'Client is not event_organizer: %', p_client_uuid;
  END IF;

  PERFORM public.require_owner_account_approved_for_client(p_client_uuid);

  INSERT INTO public.events (
    event_uuid,
    client_a_uuid,
    event_name,
    status,
    venue,
    image,
    lat,
    "long",
    start_date,
    end_date,
    start_time,
    end_time,
    event_type,
    indoor_outdoor
  ) VALUES (
    COALESCE((p_event->>'event_uuid')::uuid, gen_random_uuid()),
    p_client_uuid,
    COALESCE(NULLIF(TRIM(COALESCE(p_event->>'event_name', '')), ''), ''),
    COALESCE(NULLIF(TRIM(COALESCE(p_event->>'status', '')), ''), 'coming_soon'),
    COALESCE(p_event->>'venue', ''),
    NULLIF(TRIM(COALESCE(p_event->>'image', '')), ''),
    CASE WHEN TRIM(COALESCE(p_event->>'lat', '')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE NULL END,
    CASE WHEN TRIM(COALESCE(p_event->>'long', '')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE NULL END,
    CASE WHEN TRIM(COALESCE(p_event->>'start_date','')) != '' THEN (TRIM(p_event->>'start_date'))::date ELSE NULL END,
    CASE WHEN TRIM(COALESCE(p_event->>'end_date','')) != '' THEN (TRIM(p_event->>'end_date'))::date ELSE NULL END,
    CASE WHEN TRIM(COALESCE(p_event->>'start_time','')) != '' THEN (TRIM(p_event->>'start_time'))::time ELSE NULL END,
    CASE WHEN TRIM(COALESCE(p_event->>'end_time','')) != '' THEN (TRIM(p_event->>'end_time'))::time ELSE NULL END,
    COALESCE(p_event->>'event_type', ''),
    CASE WHEN TRIM(COALESCE(p_event->>'indoor_outdoor', p_event->>'event_indoor_outdoor', '')) IN ('indoor','outdoor') THEN (TRIM(COALESCE(p_event->>'indoor_outdoor', p_event->>'event_indoor_outdoor', '')))::public.indoor_outdoor ELSE NULL END
  )
  RETURNING to_jsonb(events.*) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_event_for_client(uuid, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.create_event_for_client(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_event_for_client(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.update_event_for_client(
  p_client_uuid uuid,
  p_event_uuid uuid,
  p_event jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  ctype text;
BEGIN
  SELECT client_type::text INTO ctype
  FROM public.client
  WHERE client_a_uuid = p_client_uuid;

  IF ctype IS NULL THEN
    RAISE EXCEPTION 'Client not found: %', p_client_uuid;
  END IF;
  IF ctype <> 'event_organizer' THEN
    RAISE EXCEPTION 'Client is not event_organizer: %', p_client_uuid;
  END IF;

  PERFORM public.require_owner_account_approved_for_client(p_client_uuid);

  UPDATE public.events
  SET
    event_name = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'event_name', '')), ''), event_name),
    status = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'status', '')), ''), status),
    venue = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'venue', '')), ''), venue),
    image = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'image', '')), ''), image),
    lat = CASE WHEN TRIM(COALESCE(p_event->>'lat', '')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE lat END,
    "long" = CASE WHEN TRIM(COALESCE(p_event->>'long', '')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE "long" END,
    start_date = CASE WHEN TRIM(COALESCE(p_event->>'start_date', '')) != '' THEN (TRIM(p_event->>'start_date'))::date ELSE start_date END,
    end_date = CASE WHEN TRIM(COALESCE(p_event->>'end_date', '')) != '' THEN (TRIM(p_event->>'end_date'))::date ELSE end_date END,
    start_time = CASE WHEN TRIM(COALESCE(p_event->>'start_time', '')) != '' THEN (TRIM(p_event->>'start_time'))::time ELSE start_time END,
    end_time = CASE WHEN TRIM(COALESCE(p_event->>'end_time', '')) != '' THEN (TRIM(p_event->>'end_time'))::time ELSE end_time END,
    event_type = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'event_type', '')), ''), event_type),
    indoor_outdoor = CASE WHEN TRIM(COALESCE(p_event->>'indoor_outdoor', p_event->>'event_indoor_outdoor', '')) IN ('indoor','outdoor') THEN (TRIM(COALESCE(p_event->>'indoor_outdoor', p_event->>'event_indoor_outdoor', '')))::public.indoor_outdoor ELSE indoor_outdoor END
  WHERE client_a_uuid = p_client_uuid
    AND event_uuid = p_event_uuid
  RETURNING to_jsonb(events.*) INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Event not found for client: %, %', p_client_uuid, p_event_uuid;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_event_for_client(uuid, uuid, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.update_event_for_client(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_for_client(uuid, uuid, jsonb) TO service_role;
