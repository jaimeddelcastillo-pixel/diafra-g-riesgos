DROP POLICY IF EXISTS "Org members update chat_conversaciones" ON public.chat_conversaciones;

CREATE POLICY "Owner or admin update chat_conversaciones"
ON public.chat_conversaciones
FOR UPDATE
TO authenticated
USING (
  is_super_admin()
  OR (
    org_id = get_user_org_id()
    AND (
      created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'responsable_sanitario'::app_role)
    )
  )
)
WITH CHECK (
  is_super_admin()
  OR (
    org_id = get_user_org_id()
    AND (
      created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'responsable_sanitario'::app_role)
    )
  )
);

DROP POLICY IF EXISTS "Members update own vote (Borrador)" ON public.comite_votos;

CREATE POLICY "Members update own vote (Borrador)"
ON public.comite_votos
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND org_id = get_user_org_id()
  AND EXISTS (
    SELECT 1 FROM public.folios f
    WHERE f.id = comite_votos.folio_id
      AND f.org_id = get_user_org_id()
      AND f.estado = 'Borrador'::estado_folio
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND org_id = get_user_org_id()
  AND EXISTS (
    SELECT 1 FROM public.folios f
    WHERE f.id = comite_votos.folio_id
      AND f.org_id = get_user_org_id()
      AND f.estado = 'Borrador'::estado_folio
  )
);