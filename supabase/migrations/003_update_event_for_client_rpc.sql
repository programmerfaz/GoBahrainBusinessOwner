-- Update one event row for an event organizer client
-- Returns updated event as jsonb

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
  SELECT client_type INTO ctype
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
    name = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'name', '')), ''), name),
    status = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'status', '')), ''), status),
    venue = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'venue', '')), ''), venue),
    image = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'image', '')), ''), image),
    lat = CASE WHEN TRIM(COALESCE(p_event->>'lat', '')) != '' THEN (TRIM(p_event->>'lat'))::numeric ELSE lat END,
    "long" = CASE WHEN TRIM(COALESCE(p_event->>'long', '')) != '' THEN (TRIM(p_event->>'long'))::numeric ELSE "long" END,
    start_date = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'start_date', '')), ''), start_date),
    end_date = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'end_date', '')), ''), end_date),
    start_time = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'start_time', '')), ''), start_time),
    end_time = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'end_time', '')), ''), end_time),
    event_type = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'event_type', '')), ''), event_type),
    indoor_outdoor = COALESCE(NULLIF(TRIM(COALESCE(p_event->>'indoor_outdoor', p_event->>'event_indoor_outdoor', '')), ''), indoor_outdoor)
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
