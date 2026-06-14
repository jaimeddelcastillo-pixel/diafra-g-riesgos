DROP POLICY IF EXISTS "Org admin delete folios" ON public.folios;

CREATE POLICY "Delete folios solo Borrador"
ON public.folios
FOR DELETE
TO authenticated
USING (
  is_super_admin()
  OR (
    org_id = get_user_org_id()
    AND estado = 'Borrador'::estado_folio
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR created_by = auth.uid()
    )
  )
);