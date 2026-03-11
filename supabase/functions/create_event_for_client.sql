-- Create one event row for an event organizer client.
-- Run this in Supabase SQL Editor if you get "Could not find the function public.create_event_for_client".
-- Uses only columns that exist on public.events: event_uuid, client_a_uuid, event_name, status, venue, image, lat, long, start_date, end_date, start_time, end_time, event_type, indoor_outdoor.

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
