-- Get posts for a client (table: public.posts)

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
