-- Tabla de auditoría de impersonación (Modelo B - ISO 27001 / SOC 2)
CREATE TABLE public.impersonation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  super_admin_id UUID NOT NULL,
  super_admin_email TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_nombre TEXT NOT NULL,
  motivo TEXT NOT NULL CHECK (length(trim(motivo)) >= 10),
  ip TEXT,
  user_agent TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_impersonation_logs_org ON public.impersonation_logs(org_id, started_at DESC);
CREATE INDEX idx_impersonation_logs_admin ON public.impersonation_logs(super_admin_id, started_at DESC);

ALTER TABLE public.impersonation_logs ENABLE ROW LEVEL SECURITY;

-- Super admins: ven y gestionan todos los registros
CREATE POLICY "Super admin manage impersonation logs"
ON public.impersonation_logs
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Admins de org: ven los accesos realizados a SU organización (transparencia)
CREATE POLICY "Org admin read own impersonation logs"
ON public.impersonation_logs
FOR SELECT
TO authenticated
USING (
  org_id = public.get_user_org_id()
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Bloquear UPDATE/DELETE para integridad (solo INSERT y cierre por el mismo super admin)
-- El cierre se hace vía UPDATE de ended_at por el super admin que abrió la sesión
CREATE POLICY "Super admin close own session"
ON public.impersonation_logs
FOR UPDATE
TO authenticated
USING (public.is_super_admin() AND super_admin_id = auth.uid())
WITH CHECK (public.is_super_admin() AND super_admin_id = auth.uid());