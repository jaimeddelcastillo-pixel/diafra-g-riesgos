CREATE POLICY "Owners can read their diplomas in storage"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'diplomas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);