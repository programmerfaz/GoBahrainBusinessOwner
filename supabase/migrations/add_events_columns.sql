-- Run in Supabase SQL Editor
-- Add missing columns to existing events table

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_name text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_date text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_time text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time text DEFAULT '';
