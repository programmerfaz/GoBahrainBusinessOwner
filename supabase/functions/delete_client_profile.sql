-- Run in Supabase SQL Editor
-- Deletes client and all linked records (place, place_client, restaurant_client, event_organizer_client, posts via CASCADE)

CREATE OR REPLACE FUNCTION public.delete_client_profile(p_client_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.place WHERE a_uuid = p_client_uuid;
  DELETE FROM public.place_client WHERE a_uuid = p_client_uuid;
  DELETE FROM public.events WHERE client_a_uuid = p_client_uuid;
  DELETE FROM public.restaurant_client WHERE a_uuid = p_client_uuid;
  BEGIN
    DELETE FROM public.event_organizer_client WHERE a_uuid = p_client_uuid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  DELETE FROM public.post WHERE client_a_uuid = p_client_uuid;
  DELETE FROM public.client WHERE client_a_uuid = p_client_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_client_profile(uuid) TO anon;
