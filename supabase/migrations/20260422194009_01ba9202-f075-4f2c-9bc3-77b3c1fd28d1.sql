-- Bucket público para logos de organizaciones
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Lectura pública de logos
DROP POLICY IF EXISTS "Public read org logos" ON storage.objects;
CREATE POLICY "Public read org logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-logos');

-- Solo admin de la organización puede subir su logo (carpeta = org_id)
DROP POLICY IF EXISTS "Org admin upload own logo" ON storage.objects;
CREATE POLICY "Org admin upload own logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] = public.get_user_org_id()::text
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Solo admin puede actualizar el logo de su organización
DROP POLICY IF EXISTS "Org admin update own logo" ON storage.objects;
CREATE POLICY "Org admin update own logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] = public.get_user_org_id()::text
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] = public.get_user_org_id()::text
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Solo admin puede borrar el logo de su organización
DROP POLICY IF EXISTS "Org admin delete own logo" ON storage.objects;
CREATE POLICY "Org admin delete own logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] = public.get_user_org_id()::text
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Permitir que el admin actualice el campo logo_url en su organización
DROP POLICY IF EXISTS "Org admin update own org" ON public.organizations;
CREATE POLICY "Org admin update own org"
ON public.organizations FOR UPDATE
TO authenticated
USING (
  id = public.get_user_org_id()
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  id = public.get_user_org_id()
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);