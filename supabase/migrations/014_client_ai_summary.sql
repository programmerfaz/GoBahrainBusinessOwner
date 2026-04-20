-- AI-generated narrative summary of the full client profile (refreshed from the backend on create/update).
-- Application/env may refer to this as AI_summary; the database column is snake_case for Postgres conventions.

ALTER TABLE public.client
  ADD COLUMN IF NOT EXISTS ai_summary text;

COMMENT ON COLUMN public.client.ai_summary IS 'AI-generated paragraph summary of the client profile (all persisted fields), updated when the profile is saved.';
