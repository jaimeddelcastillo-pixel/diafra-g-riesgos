-- Tabla 12/14 Cerebro Institucional: memoria viva
CREATE TABLE public.brain_memoria_viva (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  contenido text NOT NULL,
  tipo text NOT NULL DEFAULT 'situacion_activa' CHECK (tipo IN (
    'cambio_en_curso','decision_temporal','situacion_activa','pendiente_institucional')),
  proceso_id uuid REFERENCES public.brain_processes(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.brain_areas(id) ON DELETE SET NULL,
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta date,
  estado text NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente','cerrada','obsoleta')),
  notas text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brain_memoria_viva_org ON public.brain_memoria_viva(org_id, estado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_memoria_viva TO authenticated;
GRANT ALL ON public.brain_memoria_viva TO service_role;

ALTER TABLE public.brain_memoria_viva ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_memoria_viva_select_org"
ON public.brain_memoria_viva FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_memoria_viva_insert_captura"
ON public.brain_memoria_viva FOR INSERT TO authenticated
WITH CHECK (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')))
  OR public.is_super_admin()
);

CREATE POLICY "brain_memoria_viva_update_captura"
ON public.brain_memoria_viva FOR UPDATE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')))
  OR public.is_super_admin()
)
WITH CHECK (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')))
  OR public.is_super_admin()
);

CREATE POLICY "brain_memoria_viva_delete_admin"
ON public.brain_memoria_viva FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin()
);

CREATE TRIGGER brain_memoria_viva_updated_at
BEFORE UPDATE ON public.brain_memoria_viva
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();