-- Cerebro Institucional: quién debe ser entrevistado, sobre qué y por qué.
CREATE TABLE public.brain_interview_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  nombre_externo TEXT,
  puesto TEXT,
  area_id UUID REFERENCES public.brain_areas(id) ON DELETE SET NULL,
  capa TEXT CHECK (capa IN ('vision','proceso','especialista','documental','validacion')),
  nivel_autoridad TEXT,
  dominios_conocimiento TEXT[] NOT NULL DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','en_proceso','completado')),
  prioridad TEXT NOT NULL DEFAULT 'media'
    CHECK (prioridad IN ('alta','media','baja')),
  razon_asignacion TEXT,
  asignado_automaticamente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX brain_assignments_org_idx ON public.brain_interview_assignments(org_id);
CREATE INDEX brain_assignments_profile_idx ON public.brain_interview_assignments(profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_interview_assignments TO authenticated;
GRANT ALL ON public.brain_interview_assignments TO service_role;

ALTER TABLE public.brain_interview_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_assignments_select_org"
ON public.brain_interview_assignments FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_assignments_insert_captura"
ON public.brain_interview_assignments FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.get_user_org_id()
  AND (
    public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
  )
);

CREATE POLICY "brain_assignments_update"
ON public.brain_interview_assignments FOR UPDATE TO authenticated
USING (
  org_id = public.get_user_org_id()
  AND (
    public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
  )
)
WITH CHECK (org_id = public.get_user_org_id());

CREATE POLICY "brain_assignments_delete_admin"
ON public.brain_interview_assignments FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  OR public.is_super_admin()
);

-- Gobernanza: quien solo tiene rol de captura puede mover el estado, nada más.
CREATE OR REPLACE FUNCTION public.brain_assignments_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_gob boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW; -- contexto de servicio (edge function)
  END IF;

  v_gob := public.is_super_admin()
        OR public.has_role(v_uid, 'admin'::app_role)
        OR public.has_role(v_uid, 'responsable_sanitario'::app_role);

  IF v_gob THEN
    RETURN NEW;
  END IF;

  IF NEW.prioridad IS DISTINCT FROM OLD.prioridad
     OR NEW.capa IS DISTINCT FROM OLD.capa
     OR NEW.nivel_autoridad IS DISTINCT FROM OLD.nivel_autoridad
     OR NEW.dominios_conocimiento IS DISTINCT FROM OLD.dominios_conocimiento
     OR NEW.razon_asignacion IS DISTINCT FROM OLD.razon_asignacion
     OR NEW.asignado_automaticamente IS DISTINCT FROM OLD.asignado_automaticamente
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'Solo Administrador o Responsable Sanitario pueden modificar la gobernanza de una asignación';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER brain_assignments_governance_trg
BEFORE UPDATE ON public.brain_interview_assignments
FOR EACH ROW EXECUTE FUNCTION public.brain_assignments_governance();

CREATE TRIGGER brain_assignments_updated_at
BEFORE UPDATE ON public.brain_interview_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();