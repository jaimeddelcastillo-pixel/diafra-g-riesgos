-- 1. Lectura de auditoría evaluada una sola vez por consulta (InitPlan); mismos roles que antes.
CREATE OR REPLACE FUNCTION public.puede_ver_auditoria(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _org IS NOT NULL AND _org = public.get_user_org_id() AND (
    public.rol_efectivo(auth.uid(),'admin')
    OR public.rol_efectivo(auth.uid(),'responsable_sanitario')
    OR public.rol_efectivo(auth.uid(),'comite_tecnico')
    OR public.rol_efectivo(auth.uid(),'aseguramiento_calidad')
    OR EXISTS(SELECT 1 FROM public.org_members WHERE user_id=auth.uid() AND org_id=_org AND role='super_admin'))
$$;
REVOKE ALL ON FUNCTION public.puede_ver_auditoria(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_ver_auditoria(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Org admin read audit" ON public.audit_trail;
CREATE POLICY "Org admin read audit" ON public.audit_trail FOR SELECT TO authenticated
USING (
  (org_id = (SELECT public.get_user_org_id()) AND (SELECT public.puede_ver_auditoria((SELECT public.get_user_org_id()))))
  OR (SELECT public.is_super_admin())
);

-- 2. Índices para filtros por empresa, catálogo y fecha.
CREATE INDEX IF NOT EXISTS idx_audit_trail_org_created ON public.audit_trail (org_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_org_tabla_created ON public.audit_trail (org_id, tabla, created_at DESC);

-- 3. Trazabilidad de roles.
CREATE OR REPLACE FUNCTION public.org_members_motivo_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM OLD.role)
     AND length(btrim(coalesce(current_setting('tracea.motivo', true), ''))) < 5 THEN
    RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres) para cambiar el rol o quitar a un usuario de la empresa' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER org_members_motivo_guard BEFORE UPDATE OR DELETE ON public.org_members FOR EACH ROW EXECUTE FUNCTION public.org_members_motivo_guard();
CREATE TRIGGER audit_org_members AFTER INSERT OR UPDATE OR DELETE ON public.org_members FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Cambio de rol con motivo (respeta las políticas actuales: SECURITY INVOKER).
CREATE OR REPLACE FUNCTION public.cambiar_rol_miembro(_user_id uuid, _rol public.app_role, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE n integer; o uuid := public.get_user_org_id();
BEGIN
  IF length(btrim(coalesce(_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
  PERFORM set_config('tracea.motivo', btrim(_motivo), true);
  UPDATE public.org_members SET role = _rol WHERE user_id = _user_id AND org_id = o AND role IS DISTINCT FROM _rol;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('tracea.motivo', '', true);
  IF n = 0 AND NOT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = _user_id AND org_id = o AND role = _rol) THEN
    RAISE EXCEPTION 'No se pudo cambiar el rol (sin permiso o usuario fuera de la empresa)';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.cambiar_rol_miembro(uuid, public.app_role, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cambiar_rol_miembro(uuid, public.app_role, text) TO authenticated;

-- Línea base de roles actuales.
INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo, motivo, origen)
SELECT NULL, m.org_id, 'org_members', m.id::text, 'LINEA_BASE_ROLES',
       to_jsonb(m) || jsonb_build_object('email', p.email, 'nombre', p.nombre),
       'Inicio de trazabilidad de roles', 'sistema'
FROM public.org_members m LEFT JOIN public.profiles p ON p.id = m.user_id;

-- 4. Pendientes de KPI agrupados por catálogo.
DO $k1c$ DECLARE d text;
  viejo text := $o$UNION ALL
 SELECT 'indicadores','kpi_por_validar',k.id,'KPI en borrador por validar · '||k.codigo||' · '||k.nombre,'/indicadores',k.updated_at,NULL::date,'gestion'
 FROM (SELECT id,org_id,codigo,nombre,updated_at FROM public.kpi_definiciones WHERE activo AND estado='borrador' UNION ALL SELECT id,org_id,codigo,nombre,updated_at FROM public.kpi_puesto WHERE activo AND estado='borrador') k WHERE k.org_id=org AND public.org_tiene_modulo(org,'indicadores') AND (es_rs OR public.rol_efectivo(u,'aseguramiento_calidad'))$o$;
  nuevo text := $n$UNION ALL
 SELECT 'indicadores','kpi_por_validar',k.registro,k.n||' KPI '||k.cat||' por validar',k.ruta,k.nace_en,NULL::date,'gestion'
 FROM (SELECT (array_agg(id ORDER BY updated_at,id))[1] registro,count(*) n,'del SGC'::text cat,'/indicadores?hoja=KPI_SGC'::text ruta,min(updated_at) nace_en FROM public.kpi_definiciones WHERE org_id=org AND activo AND estado='borrador' HAVING count(*)>0
       UNION ALL SELECT (array_agg(id ORDER BY updated_at,id))[1],count(*),'de puesto','/indicadores?hoja=KPI_Puesto',min(updated_at) FROM public.kpi_puesto WHERE org_id=org AND activo AND estado='borrador' HAVING count(*)>0) k
 WHERE public.org_tiene_modulo(org,'indicadores') AND (es_rs OR public.rol_efectivo(u,'aseguramiento_calidad'))$n$;
BEGIN
  SELECT pg_get_functiondef('public.pendientes_usuario(text)'::regprocedure) INTO d;
  IF position(viejo in d) = 0 THEN RAISE EXCEPTION 'No se encontró el pendiente de KPI a agrupar'; END IF;
  EXECUTE replace(d, viejo, nuevo);
END $k1c$;