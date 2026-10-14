-- Reversión P3.1. Ejecutar antes de p3_down.sql.
DROP TRIGGER IF EXISTS organizations_lista_blanca_admin ON public.organizations;
DROP FUNCTION IF EXISTS public.organizations_lista_blanca_admin();
-- Restaurar pendientes_configuracion de P3: volver a aplicar la definición de
-- drizzle/migrations/0034_p3_asistente_configuracion.sql (bloque "firmas": obligatorio=true,
-- título 'Firmas de quienes firman folios', roles admin/responsable_sanitario/comite_tecnico).
CREATE OR REPLACE FUNCTION public.pendientes_configuracion()
RETURNS TABLE(clave text, titulo text, modulo text, obligatorio boolean, hecho boolean, detalle text, ruta text, quien text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := public.get_user_org_id(); v_rol text; o record;
  v_rie boolean; v_cer boolean; n int; m int;
BEGIN
  SELECT c.rol_en_org INTO v_rol FROM public.contexto_org_actual() c LIMIT 1;
  IF v_org IS NULL OR v_rol IS NULL OR v_rol NOT IN ('admin','responsable_sanitario','super_admin') THEN RETURN; END IF;
  SELECT * INTO o FROM public.organizations WHERE id = v_org;
  v_rie := public.org_tiene_modulo(v_org, 'riesgos');
  v_cer := public.org_tiene_modulo(v_org, 'institutional_brain');

  clave:='datos_fiscales'; titulo:='Datos fiscales (razón social y RFC)'; modulo:='general'; obligatorio:=false;
  hecho := coalesce(trim(o.razon_social),'') <> '' AND coalesce(trim(o.rfc),'') <> '';
  detalle := CASE WHEN hecho THEN o.rfc ELSE 'Los pide la DC-3' END; ruta:='/configuracion#datos-fiscales'; quien:='admin'; RETURN NEXT;

  clave:='logo'; titulo:='Logo de la empresa'; modulo:='general'; obligatorio:=false;
  hecho := coalesce(trim(o.logo_url),'') <> ''; detalle := CASE WHEN hecho THEN 'Cargado' ELSE 'Sin logo' END;
  ruta:='/configuracion#logo'; quien:='admin'; RETURN NEXT;

  IF v_rie THEN
    SELECT count(*) INTO n FROM public.org_members mm JOIN public.profiles p ON p.id = mm.user_id
      WHERE mm.org_id = v_org AND p.activo AND mm.role = 'responsable_sanitario';
    clave:='responsable_sanitario'; titulo:='Responsable Sanitario asignado'; modulo:='riesgos'; obligatorio:=true;
    hecho := n > 0; detalle := CASE WHEN hecho THEN n || ' asignado(s)' ELSE 'Nadie tiene el rol de Responsable Sanitario' END;
    ruta:='/configuracion#usuarios'; quien:='admin'; RETURN NEXT;

    SELECT count(*), count(*) FILTER (WHERE coalesce(trim(p.firma_url),'') = '') INTO m, n
      FROM public.org_members mm JOIN public.profiles p ON p.id = mm.user_id
      WHERE mm.org_id = v_org AND p.activo AND mm.role IN ('admin','responsable_sanitario','comite_tecnico');
    clave:='firmas'; titulo:='Firmas de quienes firman folios'; modulo:='riesgos'; obligatorio:=true;
    hecho := m > 0 AND n = 0;
    detalle := CASE WHEN m = 0 THEN 'No hay firmantes' WHEN n = 0 THEN 'Todos tienen firma' ELSE n || ' usuario(s) sin firma' END;
    ruta:='/configuracion#usuarios'; quien:='admin_rs'; RETURN NEXT;

    clave:='formato'; titulo:='Código y versión del formato'; modulo:='riesgos'; obligatorio:=false;
    hecho := coalesce(trim(o.codigo_formato),'') <> '' AND coalesce(trim(o.version_formato),'') <> '';
    detalle := CASE WHEN hecho THEN o.codigo_formato || ' v' || o.version_formato ELSE 'Sin código o versión' END;
    ruta:='/configuracion#formato'; quien:='admin'; RETURN NEXT;

    SELECT count(*) INTO n FROM public.org_members mm JOIN public.profiles p ON p.id = mm.user_id
      WHERE mm.org_id = v_org AND p.activo AND mm.role = 'comite_tecnico';
    clave:='comite'; titulo:='Comité técnico'; modulo:='riesgos'; obligatorio:=false;
    hecho := n > 0; detalle := CASE WHEN hecho THEN n || ' integrante(s)' ELSE 'Nadie tiene el rol de Comité Técnico' END;
    ruta:='/configuracion#usuarios'; quien:='admin'; RETURN NEXT;
  END IF;

  IF v_cer THEN
    clave:='tipos_documento'; titulo:='Catálogo de tipos de documento revisado'; modulo:='cerebro'; obligatorio:=false;
    hecho := EXISTS (SELECT 1 FROM public.documento_tipos_config c WHERE c.org_id = v_org AND c.revisado_en IS NOT NULL);
    detalle := CASE WHEN hecho THEN 'Confirmado' ELSE 'Sin confirmar' END;
    ruta:='/configuracion#tipos-documento'; quien:='admin_rs'; RETURN NEXT;

    SELECT count(*) INTO n FROM public.brain_documents d WHERE d.org_id = v_org;
    clave:='listado_maestro'; titulo:='Listado Maestro cargado'; modulo:='cerebro'; obligatorio:=false;
    hecho := n > 0; detalle := n || ' documento(s)'; ruta:='/cerebro/documentos'; quien:='admin_rs'; RETURN NEXT;

    SELECT count(*) INTO n FROM public.org_documentos d WHERE d.org_id = v_org AND d.deleted_at IS NULL;
    clave:='recursos'; titulo:='Archivos en Recursos'; modulo:='cerebro'; obligatorio:=false;
    hecho := n > 0; detalle := n || ' archivo(s)'; ruta:='/recursos'; quien:='admin_rs'; RETURN NEXT;
  END IF;
END $$;
