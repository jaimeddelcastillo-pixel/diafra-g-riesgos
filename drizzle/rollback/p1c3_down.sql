-- Reversión P1c.3 (ejecutar antes de p1c2_down.sql)
DROP POLICY IF EXISTS "Admin RS lee diplomas de su empresa" ON storage.objects;
CREATE POLICY "Admin all diplomas storage" ON storage.objects
FOR ALL TO authenticated
USING ((bucket_id = 'diplomas'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK ((bucket_id = 'diplomas'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role));
