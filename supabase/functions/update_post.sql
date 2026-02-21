-- Run in Supabase SQL Editor
-- Update a post

CREATE OR REPLACE FUNCTION public.update_post(
  p_post_uuid uuid,
  p_description text DEFAULT NULL,
  p_price_range text DEFAULT NULL,
  p_post_image text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  updated_post public.post;
BEGIN
  UPDATE public.post SET
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
