-- ============================================================
-- BLOQUE D: Cierre final
-- ============================================================

-- ---------- FIX 9: folios duplicate INSERT policy ----------
-- "Authenticated insert folios" solo checa created_by, sin org_id → policies permisivas se OR'ean
-- y bypassa el check de org. Eliminar y reforzar la otra.
DROP POLICY IF EXISTS "Authenticated insert folios" ON public.folios;
DROP POLICY IF EXISTS "Org members insert folios" ON public.folios;

CREATE POLICY "Org members insert folios"
ON public.folios
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    org_id = public.get_user_org_id()
    OR public.is_super_admin()
  )
);

-- ---------- FIX 10: get_user_org_id determinístico ----------
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT org_id FROM public.org_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1
$$;
