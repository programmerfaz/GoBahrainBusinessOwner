-- Ensure client.qrcode column exists and backfill for all existing clients.
-- Each client gets a unique QR code id (client_a_uuid as text) for scanning.

ALTER TABLE public.client ADD COLUMN IF NOT EXISTS qrcode text;

-- Backfill: set qrcode to client_a_uuid for every row where qrcode is null or empty
UPDATE public.client
SET qrcode = client_a_uuid::text
WHERE qrcode IS NULL OR TRIM(COALESCE(qrcode, '')) = '';

-- Optional: unique constraint so qrcode stays unique (uncomment if you want to enforce)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_client_qrcode ON public.client(qrcode) WHERE qrcode IS NOT NULL;
