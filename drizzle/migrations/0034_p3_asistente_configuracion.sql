-- P3: datos fiscales, catálogo revisado, pendientes de configuración
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS razon_social text, ADD COLUMN IF NOT EXISTS rfc text;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_rfc_formato
  CHECK (rfc IS NULL OR rfc ~ '^([A-ZÑ&]{3,4})[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$');

CREATE OR REPLACE FUNCTION public.organizations_fiscales_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.razon_social IS DISTINCT FROM OLD.razon_social OR NEW.rfc IS DISTINCT FROM OLD.rfc THEN
    INSERT INTO public.audit_trail(user_id, tabla, registro_id, accion, valor_anterior, valor_nuevo, org_id)
    VALUES (auth.uid(), 'organizations', NEW.id::text, 'DATOS_FISCALES',
      jsonb_build_object('razon_social', OLD.razon_social, 'rfc', OLD.rfc),
      jsonb_build_object('razon_social', NEW.razon_social, 'rfc', NEW.rfc), NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER organizations_fiscales_audit AFTER UPDATE OF razon_social, rfc ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.organizations_fiscales_audit();

ALTER TABLE public.documento_tipos_config ADD COLUMN IF NOT EXISTS revisado_por uuid, ADD COLUMN IF NOT EXISTS revisado_en timestamptz;

CREATE OR REPLACE FUNCTION public.confirmar_catalogo_documentos()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := public.get_user_org_id(); v_rol text; v_old record; v_pos int; v_activos jsonb; v_now timestamptz := now();
BEGIN
  SELECT c.rol_en_org INTO v_rol FROM public.contexto_org_actual() c LIMIT 1;
  IF v_org IS NULL OR v_rol IS NULL OR v_rol NOT IN ('admin','responsable_sanitario') THEN
    RAISE EXCEPTION 'Solo el administrador o el Responsable Sanitario confirman el catálogo';
  END IF;
  SELECT * INTO v_old FROM public.documento_tipos_config WHERE org_id = v_org;
  INSERT INTO public.documento_tipos_config(org_id, revisado_por, revisado_en)
  VALUES (v_org, auth.uid(), v_now)
  ON CONFLICT (org_id) DO UPDATE SET revisado_por = auth.uid(), revisado_en = v_now, updated_at = v_now
  RETURNING posicion_tipo_en_codigo INTO v_pos;
  SELECT coalesce(jsonb_agg(clave ORDER BY clave), '[]'::jsonb) INTO v_activos
    FROM public.documento_tipos WHERE org_id = v_org AND activo;
  INSERT INTO public.audit_trail(user_id, tabla, registro_id, accion, valor_anterior, valor_nuevo, org_id)
  VALUES (auth.uid(), 'documento_tipos_config', v_org::text, 'CATALOGO_REVISADO',
    CASE WHEN v_old IS NULL THEN NULL ELSE jsonb_build_object('revisado_por', v_old.revisado_por, 'revisado_en', v_old.revisado_en) END,
    jsonb_build_object('revisado_por', auth.uid(), 'revisado_en', v_now, 'posicion_tipo_en_codigo', v_pos, 'tipos_activos', v_activos), v_org);
  RETURN v_now;
END $$;
REVOKE ALL ON FUNCTION public.confirmar_catalogo_documentos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_catalogo_documentos() TO authenticated;

-- Las columnas de revisión solo cambian por la función
CREATE OR REPLACE FUNCTION public.documento_tipos_config_revision_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('role', true) = 'authenticated' AND pg_trigger_depth() = 1
     AND (NEW.revisado_por IS DISTINCT FROM OLD.revisado_por OR NEW.revisado_en IS DISTINCT FROM OLD.revisado_en) THEN
    RAISE EXCEPTION 'La revisión del catálogo solo se confirma con «Confirmar catálogo revisado»';
  END IF;
  RETURN NEW;
END $$;

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
REVOKE ALL ON FUNCTION public.pendientes_configuracion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pendientes_configuracion() TO authenticated;

-- Activa configuracion_empresa: solo admin/RS miembros de esa empresa
DROP POLICY "Persona registra sus tours" ON public.onboarding_estado;
DROP POLICY "Persona actualiza sus tours" ON public.onboarding_estado;
CREATE POLICY "Persona registra sus tours" ON public.onboarding_estado FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND (org_id IS NULL OR EXISTS (SELECT 1 FROM public.org_members m
  WHERE m.org_id = onboarding_estado.org_id AND m.user_id = auth.uid()
    AND (onboarding_estado.clave <> 'configuracion_empresa' OR m.role IN ('admin','responsable_sanitario')))));
CREATE POLICY "Persona actualiza sus tours" ON public.onboarding_estado FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND (org_id IS NULL OR EXISTS (SELECT 1 FROM public.org_members m
  WHERE m.org_id = onboarding_estado.org_id AND m.user_id = auth.uid()
    AND (onboarding_estado.clave <> 'configuracion_empresa' OR m.role IN ('admin','responsable_sanitario')))));
CREATE POLICY "Persona borra su ocultar configuracion" ON public.onboarding_estado FOR DELETE TO authenticated
USING (user_id = auth.uid() AND clave = 'configuracion_empresa');
GRANT DELETE ON public.onboarding_estado TO authenticated;