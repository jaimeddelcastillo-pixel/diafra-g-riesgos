DROP POLICY IF EXISTS "Admin all diplomas storage" ON storage.objects;
CREATE POLICY "Admin RS lee diplomas de su empresa" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'diplomas' AND (
    public.is_super_admin()
    OR (
      (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'responsable_sanitario'::public.app_role))
      AND EXISTS (SELECT 1 FROM public.curso_diplomas d
                  WHERE d.pdf_path = storage.objects.name
                    AND d.org_id = public.get_user_org_id())
    )
  )
);