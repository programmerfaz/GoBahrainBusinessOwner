-- Restaurant branches support (JSONB)
-- Stores multiple branches with area_name, lat, long in restaurant_client.branch

ALTER TABLE public.restaurant_client
ADD COLUMN IF NOT EXISTS branch jsonb NOT NULL DEFAULT '[]'::jsonb;

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
    VALUES (p_client_uuid, '', '', '', '', false, COALESCE(
      CASE
        WHEN jsonb_typeof(COALESCE(p_branch, 'null'::jsonb)) = 'array' THEN p_branch
        ELSE '[]'::jsonb
      END,
      '[]'::jsonb
    ));
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_restaurant_branches(uuid, jsonb) TO anon;
