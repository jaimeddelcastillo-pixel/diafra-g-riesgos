-- Reversión P3.2 (RS edita configuración de empresa). Bitácora se conserva.
DROP TRIGGER IF EXISTS organizations_config_audit ON public.organizations;
DROP FUNCTION IF EXISTS public.organizations_config_audit();
DROP TRIGGER IF EXISTS org_folio_tipos_audit ON public.org_folio_tipos;
DROP FUNCTION IF EXISTS public.org_folio_tipos_audit();
-- Restaurar políticas solo-admin: recrear "Org admin update own org", políticas de org_folio_tipos y de logos
-- con has_role(auth.uid(),'admin') únicamente; restaurar organizations_lista_blanca_admin sin chequeo de rol
-- y pendientes_configuracion con quien='admin' en datos_fiscales, logo y formato (ver migración 0036/P3.1).
