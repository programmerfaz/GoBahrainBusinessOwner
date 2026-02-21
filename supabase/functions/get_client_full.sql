-- Run in Supabase SQL Editor
-- Fetches a single client with full joined subtype data

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
