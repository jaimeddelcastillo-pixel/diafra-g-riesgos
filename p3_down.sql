-- Reversión P3 (asistente de configuración). Ejecutar antes de p2_down.sql.
DROP POLICY IF EXISTS "Persona borra su ocultar configuracion" ON public.onboarding_estado;
REVOKE DELETE ON public.onboarding_estado FROM authenticated;
DELETE FROM public.onboarding_estado WHERE clave = 'configuracion_empresa';
DROP POLICY IF EXISTS "Persona registra sus tours" ON public.onboarding_estado;
DROP POLICY IF EXISTS "Persona actualiza sus tours" ON public.onboarding_estado;
CREATE POLICY "Persona registra sus tours" ON public.onboarding_estado FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND clave <> 'configuracion_empresa' AND (org_id IS NULL OR EXISTS (
  SELECT 1 FROM public.org_members m WHERE m.org_id = onboarding_estado.org_id AND m.user_id = auth.uid())));
CREATE POLICY "Persona actualiza sus tours" ON public.onboarding_estado FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND clave <> 'configuracion_empresa' AND (org_id IS NULL OR EXISTS (
  SELECT 1 FROM public.org_members m WHERE m.org_id = onboarding_estado.org_id AND m.user_id = auth.uid())));
DROP FUNCTION IF EXISTS public.pendientes_configuracion();
DROP TRIGGER IF EXISTS documento_tipos_config_revision_guard ON public.documento_tipos_config;
DROP FUNCTION IF EXISTS public.documento_tipos_config_revision_guard();
DROP FUNCTION IF EXISTS public.confirmar_catalogo_documentos();
ALTER TABLE public.documento_tipos_config DROP COLUMN IF EXISTS revisado_por, DROP COLUMN IF EXISTS revisado_en;
DROP TRIGGER IF EXISTS organizations_fiscales_audit ON public.organizations;
DROP FUNCTION IF EXISTS public.organizations_fiscales_audit();
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_rfc_formato;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS razon_social, DROP COLUMN IF EXISTS rfc;
-- Los registros de bitácora (DATOS_FISCALES, CATALOGO_REVISADO) se conservan: audit_trail es inalterable.
