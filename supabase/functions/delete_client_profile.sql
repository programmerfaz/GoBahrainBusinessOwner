-- Run in Supabase SQL Editor
-- Deletes client and all linked records (place, restaurant_client, events, posts). Event organizer profile is on client only.

CREATE OR REPLACE FUNCTION public.delete_client_profile(p_client_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.place WHERE client_uuid = p_client_uuid;
  DELETE FROM public.events WHERE client_a_uuid = p_client_uuid;
  DELETE FROM public.restaurant_client WHERE a_uuid = p_client_uuid;
  -- event_organizer: no event_organizer_client table; client + events only
  DELETE FROM public.posts WHERE client_a_uuid = p_client_uuid;
  DELETE FROM public.client WHERE client_a_uuid = p_client_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_client_profile(uuid) TO anon;
