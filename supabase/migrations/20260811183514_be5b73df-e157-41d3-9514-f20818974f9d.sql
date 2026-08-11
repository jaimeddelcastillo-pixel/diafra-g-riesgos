-- Tabla 13/14 Cerebro Institucional: exportaciones
CREATE TABLE public.brain_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  storage_path text,
  size_bytes bigint,
  items_incluidos integer NOT NULL DEFAULT 0,
  gaps_incluidos integer NOT NULL DEFAULT 0,
  contradicciones_incluidas integer NOT NULL DEFAULT 0,
  memoria_viva_incluida integer NOT NULL DEFAULT 0,
  filtros jsonb,
  generado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brain_exports_org ON public.brain_exports(org_id, created_at DESC);

GRANT SELECT, INSERT ON public.brain_exports TO authenticated;
GRANT ALL ON public.brain_exports TO service_role;

ALTER TABLE public.brain_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_exports_select_org"
ON public.brain_exports FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_exports_insert_gobernanza"
ON public.brain_exports FOR INSERT TO authenticated
WITH CHECK (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')))
  OR public.is_super_admin()
);