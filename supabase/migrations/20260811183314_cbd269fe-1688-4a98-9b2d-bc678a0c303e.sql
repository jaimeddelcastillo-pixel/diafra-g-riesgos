-- Tabla 9/14 Cerebro Institucional: fuentes del conocimiento
CREATE TABLE public.brain_knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  knowledge_item_id uuid NOT NULL REFERENCES public.brain_knowledge_items(id) ON DELETE CASCADE,
  tipo_fuente text NOT NULL CHECK (tipo_fuente IN (
    'entrevista','documento','persona','registro','requisito_regulatorio','observacion')),
  session_id uuid REFERENCES public.brain_interview_sessions(id) ON DELETE SET NULL,
  documento_id uuid REFERENCES public.brain_documents(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  nombre_fuente text,
  descripcion text,
  cita_textual text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brain_knowledge_sources_item ON public.brain_knowledge_sources(knowledge_item_id);
CREATE INDEX idx_brain_knowledge_sources_org ON public.brain_knowledge_sources(org_id);

GRANT SELECT, INSERT, DELETE ON public.brain_knowledge_sources TO authenticated;
GRANT ALL ON public.brain_knowledge_sources TO service_role;

ALTER TABLE public.brain_knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_knowledge_sources_select_org"
ON public.brain_knowledge_sources FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_knowledge_sources_insert_captura"
ON public.brain_knowledge_sources FOR INSERT TO authenticated
WITH CHECK (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')))
  OR public.is_super_admin()
);

CREATE POLICY "brain_knowledge_sources_delete_admin"
ON public.brain_knowledge_sources FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin()
);