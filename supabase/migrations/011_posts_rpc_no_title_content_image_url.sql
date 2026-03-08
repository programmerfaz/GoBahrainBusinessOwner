-- Fix RPCs after removing title, content, image_url from public.posts.
-- Run this in Supabase SQL Editor if you already dropped those columns.

-- get_posts_for_client: only select existing columns
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

-- create_post: only insert existing columns
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

-- update_post: already only updates description, price_range, post_image (no change needed, but included for completeness)
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
