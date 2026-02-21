-- Run in Supabase SQL Editor
-- Create post with description, price_range, post_image

CREATE OR REPLACE FUNCTION public.create_post(
  p_client_uuid uuid,
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
  new_post public.post;
BEGIN
  INSERT INTO public.post (client_a_uuid, description, price_range, post_image)
  VALUES (p_client_uuid, p_description, p_price_range, p_post_image)
  RETURNING * INTO new_post;
  SELECT to_jsonb(new_post) INTO result;
  RETURN result;
END;
$$;

-- Grant (drop old if signature changed)
GRANT EXECUTE ON FUNCTION public.create_post(uuid, text, text, text) TO anon;
