DROP POLICY IF EXISTS "Org members update riesgos" ON public.riesgos;

CREATE POLICY "Org members update riesgos"
ON public.riesgos
FOR UPDATE
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.folios f
      WHERE f.id = riesgos.folio_id
        AND f.org_id = public.get_user_org_id()
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'responsable_sanitario'::public.app_role)
          OR public.has_role(auth.uid(), 'operador'::public.app_role)
          OR public.has_role(auth.uid(), 'comite_tecnico'::public.app_role)
        )
    )
  )
  OR public.is_super_admin()
)
WITH CHECK (
  (
    EXISTS (
      SELECT 1
      FROM public.folios f
      WHERE f.id = riesgos.folio_id
        AND f.org_id = public.get_user_org_id()
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'responsable_sanitario'::public.app_role)
          OR public.has_role(auth.uid(), 'operador'::public.app_role)
          OR public.has_role(auth.uid(), 'comite_tecnico'::public.app_role)
        )
    )
  )
  OR public.is_super_admin()
);