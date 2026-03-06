-- Fix RPC resolution for set_restaurant_branches in PostgREST schema cache.
-- Some environments report missing function with arg order (p_branch, p_client_uuid).

ALTER TABLE public.restaurant_client
ADD COLUMN IF NOT EXISTS branch jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Canonical signature used by server code
CREATE OR REPLACE FUNCTION public.set_restaurant_branches(
  p_client_uuid uuid,
  p_branch jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.restaurant_client
  SET branch = COALESCE(
    CASE
      WHEN jsonb_typeof(COALESCE(p_branch, 'null'::jsonb)) = 'array' THEN p_branch
      ELSE '[]'::jsonb
    END,
    '[]'::jsonb
  )
  WHERE a_uuid = p_client_uuid;

  IF NOT FOUND THEN
    INSERT INTO public.restaurant_client (a_uuid, cuisine, meal_type, food_type, speciality, isfoodtruck, branch)
    VALUES (
      p_client_uuid,
      '',
      '',
      '',
      '',
      false,
      COALESCE(
        CASE
          WHEN jsonb_typeof(COALESCE(p_branch, 'null'::jsonb)) = 'array' THEN p_branch
          ELSE '[]'::jsonb
        END,
        '[]'::jsonb
      )
    );
  END IF;
END;
$$;

-- IMPORTANT: keep only ONE signature to avoid PostgREST ambiguity.
DROP FUNCTION IF EXISTS public.set_restaurant_branches(jsonb, uuid);

GRANT EXECUTE ON FUNCTION public.set_restaurant_branches(uuid, jsonb) TO anon, authenticated;

-- Ensure PostgREST picks up new function signatures immediately
NOTIFY pgrst, 'reload schema';
