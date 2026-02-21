-- Run in Supabase SQL Editor
-- Posts table and RPCs for client posts

CREATE TABLE IF NOT EXISTS public.posts (
  post_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_a_uuid uuid NOT NULL REFERENCES public.client(client_a_uuid) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_client_a_uuid ON public.posts(client_a_uuid);

-- RPC: get posts for a client
CREATE OR REPLACE FUNCTION public.get_posts_for_client(p_client_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT post_uuid, client_a_uuid, title, content, image_url, created_at
    FROM public.posts
    WHERE client_a_uuid = p_client_uuid
  ) p;
  RETURN result;
END;
$$;

-- RPC: create a post
CREATE OR REPLACE FUNCTION public.create_post(
  p_client_uuid uuid,
  p_title text,
  p_content text DEFAULT NULL,
  p_image_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  new_post public.posts;
BEGIN
  INSERT INTO public.posts (client_a_uuid, title, content, image_url)
  VALUES (p_client_uuid, p_title, p_content, p_image_url)
  RETURNING * INTO new_post;
  SELECT to_jsonb(new_post) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_posts_for_client(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.create_post(uuid, text, text, text) TO anon;
