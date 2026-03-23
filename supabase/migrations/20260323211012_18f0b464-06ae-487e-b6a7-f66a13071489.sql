
-- Fix 1: Enable RLS on folio_sequence
ALTER TABLE public.folio_sequence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read sequence" ON public.folio_sequence
  FOR SELECT TO authenticated USING (true);

-- Fix 2: Tighten INSERT policies on folios (set created_by)
DROP POLICY "Operador insert folios" ON public.folios;
CREATE POLICY "Authenticated insert folios" ON public.folios
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Fix 3: Tighten INSERT on folio_comite
DROP POLICY "Authenticated insert comite" ON public.folio_comite;
CREATE POLICY "Authenticated insert comite" ON public.folio_comite
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.folios WHERE id = folio_id AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comite_tecnico')))
  );

-- Fix 4: Tighten INSERT on riesgos
DROP POLICY "Authenticated insert riesgos" ON public.riesgos;
CREATE POLICY "Authenticated insert riesgos" ON public.riesgos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.folios WHERE id = folio_id AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador')))
  );

-- Fix 5: Tighten INSERT on audit_trail
DROP POLICY "Authenticated insert audit" ON public.audit_trail;
CREATE POLICY "System insert audit" ON public.audit_trail
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
