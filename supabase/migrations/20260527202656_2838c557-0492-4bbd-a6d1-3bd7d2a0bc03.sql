-- Fix 1: Scope has_role() to caller's current organization to prevent cross-org privilege escalation.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id
      AND org_id = public.get_user_org_id()
      AND (role = _role OR role = 'super_admin')
  )
$$;

-- Fix 2: Add explicit org_id scoping to 'Update folios by role' policy (defense in depth).
DROP POLICY IF EXISTS "Update folios by role" ON public.folios;
CREATE POLICY "Update folios by role" ON public.folios
FOR UPDATE TO authenticated
USING (
  org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
    OR ((created_by = auth.uid()) AND (estado = 'Borrador'::estado_folio))
    OR (public.has_role(auth.uid(), 'comite_tecnico'::app_role) AND (estado = 'En Firma'::estado_folio))
  )
)
WITH CHECK (
  org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
    OR ((created_by = auth.uid()) AND (estado <> ALL (ARRAY['Aprobado'::estado_folio, 'Cerrado'::estado_folio])))
    OR (public.has_role(auth.uid(), 'comite_tecnico'::app_role) AND (estado = 'En Firma'::estado_folio))
  )
);

-- Fix 3: Restrict Realtime channel subscriptions to caller's own organization.
-- Topic convention: "<resource>:<org_id>:<...>". Reject subscriptions to other orgs' channels.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own org realtime" ON realtime.messages;
CREATE POLICY "Authenticated can read own org realtime" ON realtime.messages
FOR SELECT TO authenticated
USING (
  (realtime.topic() IS NULL)
  OR (position(':' in realtime.topic()) = 0)
  OR (
    split_part(realtime.topic(), ':', 2) ~ '^[0-9a-fA-F-]{36}$'
    AND split_part(realtime.topic(), ':', 2)::uuid = public.get_user_org_id()
  )
);

DROP POLICY IF EXISTS "Authenticated can write own org realtime" ON realtime.messages;
CREATE POLICY "Authenticated can write own org realtime" ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  (realtime.topic() IS NULL)
  OR (position(':' in realtime.topic()) = 0)
  OR (
    split_part(realtime.topic(), ':', 2) ~ '^[0-9a-fA-F-]{36}$'
    AND split_part(realtime.topic(), ':', 2)::uuid = public.get_user_org_id()
  )
);

-- Fix 4: Add explicit UPDATE policy for org-documentos storage bucket, mirroring INSERT scoping.
DROP POLICY IF EXISTS "Org admin update org-documentos files" ON storage.objects;
CREATE POLICY "Org admin update org-documentos files" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'org-documentos'
  AND (
    public.is_super_admin()
    OR (
      (storage.foldername(name))[1] = public.get_user_org_id()::text
      AND public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
)
WITH CHECK (
  bucket_id = 'org-documentos'
  AND (
    public.is_super_admin()
    OR (
      (storage.foldername(name))[1] = public.get_user_org_id()::text
      AND public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
);