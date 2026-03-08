-- Fix "new row violates row-level security policy" when creating a post.
-- 1. Storage: allow uploads/reads for gobahrain-post-images (same pattern as 008).
-- 2. RPCs: ensure create_post / update_post / get_posts_for_client use public.posts and correct columns.

-- -----------------------------------------------------------------------------
-- 1. STORAGE: post images bucket and policies
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('gobahrain-post-images', 'gobahrain-post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop by all possible names (from this migration and older ones)
DROP POLICY IF EXISTS "Allow uploads to post images" ON storage.objects;
DROP POLICY IF EXISTS "Allow read post images" ON storage.objects;
DROP POLICY IF EXISTS "Public read post images" ON storage.objects;
DROP POLICY IF EXISTS "Upload post images" ON storage.objects;
DROP POLICY IF EXISTS "Update post images" ON storage.objects;
DROP POLICY IF EXISTS "Delete post images" ON storage.objects;

CREATE POLICY "Public read post images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gobahrain-post-images');

CREATE POLICY "Upload post images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'gobahrain-post-images');

CREATE POLICY "Update post images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'gobahrain-post-images')
WITH CHECK (bucket_id = 'gobahrain-post-images');

CREATE POLICY "Delete post images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'gobahrain-post-images');

-- -----------------------------------------------------------------------------
-- 2. Create posts table if missing (schema: post_uuid, client_a_uuid, description, price_range, post_image, created_at)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  post_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_a_uuid uuid NOT NULL REFERENCES public.client(client_a_uuid) ON DELETE CASCADE,
  description text,
  price_range text,
  post_image text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_client_a_uuid ON public.posts(client_a_uuid);

-- Ensure columns exist if table was created from an older migration
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS price_range text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS post_image text;

-- -----------------------------------------------------------------------------
-- 3. RPC: get_posts_for_client – use public.posts and current columns
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_posts_for_client(p_client_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT post_uuid, client_a_uuid, description, price_range, post_image, created_at
    FROM public.posts
    WHERE client_a_uuid = p_client_uuid
  ) p;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_posts_for_client(uuid) TO anon;

-- -----------------------------------------------------------------------------
-- 4. RPC: create_post – (p_client_uuid, p_description, p_price_range, p_post_image) -> public.posts
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_post(
  p_client_uuid uuid,
  p_description text DEFAULT NULL,
  p_price_range text DEFAULT NULL,
  p_post_image text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  new_post public.posts;
BEGIN
  INSERT INTO public.posts (client_a_uuid, description, price_range, post_image)
  VALUES (p_client_uuid, p_description, p_price_range, p_post_image)
  RETURNING * INTO new_post;
  SELECT to_jsonb(new_post) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_post(uuid, text, text, text) TO anon;

-- -----------------------------------------------------------------------------
-- 5. RPC: update_post – update public.posts
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_post(
  p_post_uuid uuid,
  p_description text DEFAULT NULL,
  p_price_range text DEFAULT NULL,
  p_post_image text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  updated_post public.posts;
BEGIN
  UPDATE public.posts SET
    description = COALESCE(NULLIF(TRIM(p_description), ''), description),
    price_range = COALESCE(p_price_range, price_range),
    post_image = COALESCE(p_post_image, post_image)
  WHERE post_uuid = p_post_uuid
  RETURNING * INTO updated_post;

  IF updated_post IS NULL THEN
    RAISE EXCEPTION 'Post not found: %', p_post_uuid;
  END IF;

  SELECT to_jsonb(updated_post) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_post(uuid, text, text, text) TO anon;
