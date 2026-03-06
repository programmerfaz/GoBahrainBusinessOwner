-- Ensure image buckets exist and allow client uploads.
-- Fixes: "new row violates row-level security policy" on Storage upload.

-- Buckets (id == name in Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('gobahrain-profile-images', 'gobahrain-profile-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Read policies (public buckets)
DROP POLICY IF EXISTS "Public read profile images" ON storage.objects;
CREATE POLICY "Public read profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gobahrain-profile-images');

DROP POLICY IF EXISTS "Public read event images" ON storage.objects;
CREATE POLICY "Public read event images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-images');

-- Upload policies (app uploads with anon/authenticated client)
DROP POLICY IF EXISTS "Upload profile images" ON storage.objects;
CREATE POLICY "Upload profile images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'gobahrain-profile-images');

DROP POLICY IF EXISTS "Upload event images" ON storage.objects;
CREATE POLICY "Upload event images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'event-images');

-- Optional maintenance policies for replacing/removing uploaded files.
DROP POLICY IF EXISTS "Update profile images" ON storage.objects;
CREATE POLICY "Update profile images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'gobahrain-profile-images')
WITH CHECK (bucket_id = 'gobahrain-profile-images');

DROP POLICY IF EXISTS "Update event images" ON storage.objects;
CREATE POLICY "Update event images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'event-images')
WITH CHECK (bucket_id = 'event-images');

DROP POLICY IF EXISTS "Delete profile images" ON storage.objects;
CREATE POLICY "Delete profile images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'gobahrain-profile-images');

DROP POLICY IF EXISTS "Delete event images" ON storage.objects;
CREATE POLICY "Delete event images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'event-images');
