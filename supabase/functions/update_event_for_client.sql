-- Update one event row for an event organizer client.
-- Run this in Supabase SQL Editor if you get "Could not find the function public.update_event_for_client".
-- Signature: (p_client_uuid, p_event_uuid, p_event) — matches server/index.js.
-- Omits "name" column so it works if your events table has no "name" column.

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
