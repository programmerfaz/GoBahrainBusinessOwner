-- Run in Supabase SQL Editor
-- Events table: individual events belonging to event organizer (client)
-- Uses client_a_uuid (same as posts) to reference client
-- Does NOT drop table (offerings, ticket_type depend on it)

CREATE TABLE IF NOT EXISTS public.events (
  event_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_a_uuid uuid REFERENCES public.client(client_a_uuid) ON DELETE CASCADE,
  event_name text NOT NULL DEFAULT '',
  venue text DEFAULT '',
  start_date text DEFAULT '',
  end_date text DEFAULT '',
  start_time text DEFAULT '',
  end_time text DEFAULT ''
);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_a_uuid uuid REFERENCES public.client(client_a_uuid) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_events_client_a_uuid ON public.events(client_a_uuid);
