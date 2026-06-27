
CREATE TABLE public.dc3_solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  curso_id UUID,
  diploma_id UUID REFERENCES public.curso_diplomas(id) ON DELETE SET NULL,
  intento_id UUID,
  curso_titulo TEXT,
  curso_norma TEXT,
  calificacion NUMERIC(5,2),
  email_destino TEXT NOT NULL,
  alumno_nombre TEXT,
  org_nombre TEXT,
  plan_org TEXT,
  fuente TEXT NOT NULL CHECK (fuente IN ('incluido','comprado')),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','enviado','cancelado')),
  solicitado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_en TIMESTAMPTZ,
  enviado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dc3_url TEXT,
  notas_admin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX dc3_solicitudes_activas_uniq
  ON public.dc3_solicitudes (user_id, curso_id)
  WHERE estado IN ('pendiente','enviado');

CREATE INDEX dc3_solicitudes_estado_idx ON public.dc3_solicitudes (estado, solicitado_en DESC);
CREATE INDEX dc3_solicitudes_user_idx ON public.dc3_solicitudes (user_id, solicitado_en DESC);

GRANT SELECT, INSERT ON public.dc3_solicitudes TO authenticated;
GRANT ALL ON public.dc3_solicitudes TO service_role;

ALTER TABLE public.dc3_solicitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alumno ve sus propias solicitudes"
  ON public.dc3_solicitudes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "alumno crea sus propias solicitudes"
  ON public.dc3_solicitudes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "super admin actualiza solicitudes"
  ON public.dc3_solicitudes FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_dc3_solicitudes_updated_at
  BEFORE UPDATE ON public.dc3_solicitudes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
