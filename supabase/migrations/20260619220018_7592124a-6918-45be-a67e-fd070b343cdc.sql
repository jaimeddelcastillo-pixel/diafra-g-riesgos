
-- Restringir EXECUTE de next_diploma_folio al service_role
REVOKE EXECUTE ON FUNCTION public.next_diploma_folio() FROM PUBLIC, anon, authenticated;

-- Storage policies para bucket "diplomas"
CREATE POLICY "Admin all diplomas storage"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'diplomas' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'diplomas' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Alumno lee su propio diploma"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'diplomas'
  AND EXISTS (
    SELECT 1 FROM public.curso_diplomas d
    WHERE d.pdf_path = storage.objects.name
      AND d.user_id = auth.uid()
  )
);
