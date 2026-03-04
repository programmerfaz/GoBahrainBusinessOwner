-- Create one event row for an event organizer client
-- Returns inserted event as jsonb

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
  SELECT client_type INTO ctype
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
    name,
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
    COALESCE(p_event->>'event_name', ''),
    COALESCE(NULLIF(TRIM(COALESCE(p_event->>'name','')), ''), COALESCE(p_event->>'event_name', '')),
    COALESCE(NULLIF(TRIM(COALESCE(p_event->>'status','')), ''), 'coming_soon'),
    COALESCE(p_event->>'venue', ''),
    NULLIF(TRIM(COALESCE(p_event->>'image','')), ''),
    CASE WHEN TRIM(COALESCE(p_event->>'lat','')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE NULL END,
    CASE WHEN TRIM(COALESCE(p_event->>'long','')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE NULL END,
    COALESCE(NULLIF(TRIM(COALESCE(p_event->>'start_date','')), ''), ''),
    COALESCE(NULLIF(TRIM(COALESCE(p_event->>'end_date','')), ''), ''),
    COALESCE(NULLIF(TRIM(COALESCE(p_event->>'start_time','')), ''), ''),
    COALESCE(NULLIF(TRIM(COALESCE(p_event->>'end_time','')), ''), ''),
    COALESCE(p_event->>'event_type', ''),
    COALESCE(p_event->>'indoor_outdoor', p_event->>'event_indoor_outdoor', '')
  )
  RETURNING to_jsonb(events.*) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_event_for_client(uuid, jsonb) TO anon;
