-- Delete a post owned by the given client (prevents cross-client deletes by UUID guess).
-- Also cleans up dependent rows in post_upvote (FK has no ON DELETE CASCADE).
-- The dependent cleanup is wrapped in a sub-block so this still works on databases
-- where post_upvote does not exist.

CREATE OR REPLACE FUNCTION public.delete_post(
  p_post_uuid uuid,
  p_client_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT client_a_uuid INTO v_owner
  FROM public.posts
  WHERE post_uuid = p_post_uuid;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_owner <> p_client_uuid THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Best-effort cleanup of known child tables.
  -- Wrapped so the function still works if the table is absent in a given environment.
  BEGIN
    DELETE FROM public.post_upvote WHERE post_uuid = p_post_uuid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  DELETE FROM public.posts
  WHERE post_uuid = p_post_uuid
    AND client_a_uuid = p_client_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post delete failed';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_post(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.delete_post(uuid, uuid) TO authenticated;
