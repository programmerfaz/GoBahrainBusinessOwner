-- Add image column to events table (stores Supabase Storage URL)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image text DEFAULT NULL;
