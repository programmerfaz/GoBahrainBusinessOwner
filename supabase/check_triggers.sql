-- Run in Supabase SQL Editor to check for triggers on client table
-- If any trigger references openclosed_state, you'll need to drop it

SELECT tgname, pg_get_triggerdef(oid) 
FROM pg_trigger 
WHERE tgrelid = 'public.client'::regclass;
