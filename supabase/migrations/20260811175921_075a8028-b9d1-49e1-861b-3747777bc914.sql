-- Cerebro Institucional: documentos fuente que respaldan el conocimiento institucional.
CREATE TABLE public.brain_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'otro'
    CHECK (tipo IN (
      'manual_calidad','pno','formato','organigrama',
      'mapa_procesos','auditoria','capa','riesgo',
      'protocolo','informe','autorizacion_regulatoria','otro'
    )),
  codigo TEXT,
  revision TEXT,
  fecha_documento DATE,
  proceso_id UUID REFERENCES public.brain_processes(id) ON DELETE SET NULL,
  area_id UUID REFERENCES public.brain_areas(id) ON DELETE SET NULL,
  storage_path TEXT,
  estado TEXT NOT NULL DEFAULT 'activo',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX brain_documents_org_idx ON public.brain_documents(org_id);
CREATE INDEX brain_documents_proceso_idx ON public.brain_documents(proceso_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_documents TO authenticated;
GRANT ALL ON public.brain_documents TO service_role;

ALTER TABLE public.brain_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_documents_select_org"
ON public.brain_documents FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_documents_insert_captura"
ON public.brain_documents FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.get_user_org_id()
  AND (
    public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
  )
);

CREATE POLICY "brain_documents_update_captura"
ON public.brain_documents FOR UPDATE TO authenticated
USING (
  org_id = public.get_user_org_id()
  AND (
    public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
  )
)
WITH CHECK (org_id = public.get_user_org_id());

CREATE POLICY "brain_documents_delete_admin"
ON public.brain_documents FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  OR public.is_super_admin()
);

CREATE TRIGGER brain_documents_updated_at
BEFORE UPDATE ON public.brain_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();