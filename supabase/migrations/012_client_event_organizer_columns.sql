-- Store event-organizer profile on client (no event_organizer_client table).
-- Your events table holds individual events; client holds default event_type and indoor_outdoor.

ALTER TABLE public.client
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS indoor_outdoor text;

COMMENT ON COLUMN public.client.event_type IS 'Event organizer default type (used when client_type = event_organizer).';
COMMENT ON COLUMN public.client.indoor_outdoor IS 'Event organizer default indoor/outdoor (used when client_type = event_organizer).';
