
CREATE POLICY "Super admins manage tracea-recursos insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tracea-recursos' AND public.is_super_admin());

CREATE POLICY "Super admins manage tracea-recursos update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tracea-recursos' AND public.is_super_admin())
WITH CHECK (bucket_id = 'tracea-recursos' AND public.is_super_admin());

CREATE POLICY "Super admins manage tracea-recursos delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tracea-recursos' AND public.is_super_admin());
