-- Run in Supabase SQL Editor
-- Creates event_clients table for Event Organizer profiles

CREATE TABLE IF NOT EXISTS public.event_clients (
  a_uuid uuid PRIMARY KEY REFERENCES public.client(client_a_uuid) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT '',
  indoor_outdoor text NOT NULL DEFAULT ''
);
