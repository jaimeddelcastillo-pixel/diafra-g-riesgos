-- P1a: deshacer columnas orden/estado del catálogo de módulos
ALTER TABLE public.modulos DROP CONSTRAINT IF EXISTS modulos_estado_check;
ALTER TABLE public.modulos DROP COLUMN IF EXISTS estado;
ALTER TABLE public.modulos DROP COLUMN IF EXISTS orden;
-- Código: restaurar src/config/navigation.ts, src/App.tsx, CerebroGuard y quitar src/modules/.

-- P1b: deshacer
DROP FUNCTION IF EXISTS public.pendientes_riesgos();
DROP FUNCTION IF EXISTS public.pendientes_cerebro();
DROP FUNCTION IF EXISTS public.mis_modulos();
DELETE FROM public.modulos WHERE clave = 'tendencias';
DELETE FROM public.org_members WHERE org_id = '508ebdb4-12c1-4a9a-9767-cae539afef15' AND user_id = '4101c851-a9ac-480b-a1a2-8c3403a44ed4';
CREATE OR REPLACE FUNCTION public.org_tiene_modulo(_org uuid, _modulo text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT EXISTS (SELECT 1 FROM public.organizations o JOIN public.plan_modulos pm ON pm.plan = o.plan AND pm.modulo = _modulo WHERE o.id = _org)
      OR EXISTS (SELECT 1 FROM public.organization_features f WHERE f.org_id = _org AND f.feature_key = _modulo AND f.activo = true AND (f.expira_en IS NULL OR f.expira_en > now()))
$f$;
CREATE OR REPLACE FUNCTION public.mi_org_tiene_modulo(_modulo text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$ SELECT public.is_super_admin() OR public.org_tiene_modulo(public.get_user_org_id(), _modulo) $f$;
-- Código: restaurar App.tsx, navigation.ts, useNavigationItems.ts, AppSidebar.tsx, Paso2Tour.tsx, Paso3PrimerFolio.tsx,
-- Index.tsx (redirección), módulos; borrar src/pages/Inicio.tsx y src/hooks/useMisModulos.ts.
