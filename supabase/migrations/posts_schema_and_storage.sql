-- Run in Supabase SQL Editor
-- 1. Align posts table with description, price_range, post_image
-- 2. Create Storage bucket for post images

-- Ensure posts has description, price_range, post_image
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS price_range text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS post_image text;

-- Make title nullable if it exists (for migration from old schema)
DO $$ BEGIN
  ALTER TABLE public.posts ALTER COLUMN title DROP NOT NULL;
  ALTER TABLE public.posts ALTER COLUMN title SET DEFAULT '';
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- Create Storage bucket for post images
INSERT INTO storage.buckets (id, name, public)
VALUES ('gobahrain-post-images', 'gobahrain-post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: allow uploads to post images bucket
DROP POLICY IF EXISTS "Allow uploads to post images" ON storage.objects;
CREATE POLICY "Allow uploads to post images"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'gobahrain-post-images');

-- Policy: allow public read
DROP POLICY IF EXISTS "Allow read post images" ON storage.objects;
CREATE POLICY "Allow read post images"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'gobahrain-post-images');
