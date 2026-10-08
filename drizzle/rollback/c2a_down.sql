-- Rollback C2a (0005_c2a_contexto_org.sql)
-- Nota: los 16 cierres administrativos de impersonation_logs y el evento
-- CIERRE_SOPORTE_ADMINISTRATIVO de audit_trail NO se revierten (bitácora inalterable).
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT org_id FROM public.org_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1
$function$;
DROP FUNCTION IF EXISTS public.cerrar_mis_soportes(text, uuid);
DROP FUNCTION IF EXISTS public.mis_organizaciones();
DROP FUNCTION IF EXISTS public.set_org_activa(uuid);
DROP FUNCTION IF EXISTS public.contexto_org_actual();
ALTER TABLE public.profiles DROP COLUMN IF EXISTS org_activa_id;
ALTER TABLE public.impersonation_logs DROP CONSTRAINT IF EXISTS impersonation_logs_tipo_cierre_check;
ALTER TABLE public.impersonation_logs DROP COLUMN IF EXISTS tipo_cierre;
