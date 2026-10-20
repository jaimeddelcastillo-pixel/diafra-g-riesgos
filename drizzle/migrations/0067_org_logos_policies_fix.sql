DROP POLICY IF EXISTS "Org admin upload own logo" ON storage.objects;
DROP POLICY IF EXISTS "Org admin update own logo" ON storage.objects;
DROP POLICY IF EXISTS "Org admin delete own logo" ON storage.objects;
DROP POLICY IF EXISTS "Org members read own logo" ON storage.objects;
CREATE POLICY "Org members read own logo" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='org-logos' AND ((storage.foldername(name))[1]=(public.get_user_org_id())::text OR public.is_super_admin()));
CREATE POLICY "Org admin upload own logo" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='org-logos' AND (storage.foldername(name))[1]=(public.get_user_org_id())::text AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario') OR public.is_super_admin()));
CREATE POLICY "Org admin update own logo" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='org-logos' AND (storage.foldername(name))[1]=(public.get_user_org_id())::text AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario') OR public.is_super_admin()))
WITH CHECK (bucket_id='org-logos' AND (storage.foldername(name))[1]=(public.get_user_org_id())::text AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario') OR public.is_super_admin()));
CREATE POLICY "Org admin delete own logo" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='org-logos' AND (storage.foldername(name))[1]=(public.get_user_org_id())::text AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario') OR public.is_super_admin()));