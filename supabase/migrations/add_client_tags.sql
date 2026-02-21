-- Run in Supabase SQL Editor if client.tags doesn't exist
-- Adds tags column to store comma-separated tags

ALTER TABLE public.client ADD COLUMN IF NOT EXISTS tags text DEFAULT '';
