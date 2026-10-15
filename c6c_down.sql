-- Reversión C6c (expediente de auditoría externa). Borra expedientes e ítems:
-- exporta antes la actividad si debe conservarse (la bitácora audit_trail no se toca).
DROP FUNCTION IF EXISTS public.auditoria_actividad(uuid);
DROP FUNCTION IF EXISTS public.auditor_registrar_descarga_folio(uuid);
DROP FUNCTION IF EXISTS public.auditor_ver_item(uuid);
DROP FUNCTION IF EXISTS public.auditor_mis_expedientes();
DROP FUNCTION IF EXISTS public.auditoria_validar_acceso(uuid, uuid);
DROP TABLE IF EXISTS public.auditoria_items;
DROP TABLE IF EXISTS public.auditorias_externas;
DROP FUNCTION IF EXISTS public.auditoria_items_integridad();
DROP FUNCTION IF EXISTS public.auditorias_externas_governance();

-- 0b: conversaciones del asistente legibles por toda la empresa (como antes).
DROP POLICY IF EXISTS "Owner reads chat_conversaciones" ON public.chat_conversaciones;
CREATE POLICY "Org members read chat_conversaciones" ON public.chat_conversaciones
  FOR SELECT USING ((org_id = get_user_org_id()) OR is_super_admin());
DROP POLICY IF EXISTS "Owner reads chat_mensajes" ON public.chat_mensajes;
CREATE POLICY "Org members read chat_mensajes" ON public.chat_mensajes
  FOR SELECT USING ((org_id = get_user_org_id()) OR is_super_admin());

-- 0a: lista blanca de P3.1 (admin escribe norma y metodología siempre).
CREATE OR REPLACE FUNCTION public.organizations_lista_blanca_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  permitidos text[] := ARRAY['logo_url','codigo_formato','version_formato','razon_social','rfc',
    'folio_prefijo','folio_formato_periodo','folio_digitos_consecutivo',
    'norma_aplicable','metodologia','updated_at'];
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - permitidos) IS DISTINCT FROM (to_jsonb(OLD) - permitidos) THEN
    RAISE EXCEPTION 'Este dato solo lo puede cambiar soporte TRACEA' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;
-- Edge functions auditoria-invitar y auditoria-descargar: eliminarlas del despliegue.
