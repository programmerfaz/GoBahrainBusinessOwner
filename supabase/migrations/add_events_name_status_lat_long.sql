-- Run in Supabase SQL Editor
-- Add name, status, lat, long to events table

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS name text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status text DEFAULT 'coming_soon';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS "long" numeric;
ALTER TABLE public.events ALTER COLUMN status SET DEFAULT 'coming_soon';
