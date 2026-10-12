-- P1b: un módulo 'proximamente' nunca da acceso
CREATE OR REPLACE FUNCTION public.org_tiene_modulo(_org uuid, _modulo text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (SELECT 1 FROM public.modulos mm WHERE mm.clave = _modulo AND mm.estado = 'proximamente')
  AND (
    EXISTS (
      SELECT 1 FROM public.organizations o
      JOIN public.plan_modulos pm ON pm.plan = o.plan AND pm.modulo = _modulo
      WHERE o.id = _org
    ) OR EXISTS (
      SELECT 1 FROM public.organization_features f
      WHERE f.org_id = _org AND f.feature_key = _modulo AND f.activo = true
        AND (f.expira_en IS NULL OR f.expira_en > now())
    )
  )
$function$;

CREATE OR REPLACE FUNCTION public.mi_org_tiene_modulo(_modulo text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT (public.is_super_admin()
          AND NOT EXISTS (SELECT 1 FROM public.modulos mm WHERE mm.clave = _modulo AND mm.estado = 'proximamente'))
      OR public.org_tiene_modulo(public.get_user_org_id(), _modulo)
$function$;

-- Catálogo de módulos con el acceso comercial de la empresa activa (para Inicio y menú)
CREATE OR REPLACE FUNCTION public.mis_modulos()
 RETURNS TABLE(clave text, nombre text, descripcion text, orden integer, estado text, tiene_acceso boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT m.clave, m.nombre, m.descripcion, m.orden, m.estado,
         (m.estado = 'activo' AND public.get_user_org_id() IS NOT NULL
          AND public.org_tiene_modulo(public.get_user_org_id(), m.clave))
  FROM public.modulos m
  WHERE auth.uid() IS NOT NULL AND m.activo = true
  ORDER BY m.orden NULLS LAST, m.clave
$function$;

-- Pendientes de Riesgos: solo conteos, empresa activa, RLS del invocador
CREATE OR REPLACE FUNCTION public.pendientes_riesgos()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.get_user_org_id();
  v_uid uuid := auth.uid();
  v_rol text;
  v_res jsonb := '{}'::jsonb;
  v_n int;
  v_cursos jsonb;
BEGIN
  IF v_org IS NULL OR v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT c.rol_en_org INTO v_rol FROM public.contexto_org_actual() c;
  IF v_rol = 'super_admin' THEN v_rol := 'admin'; END IF;
  v_res := jsonb_build_object('rol', v_rol);

  IF v_rol IN ('admin','responsable_sanitario') THEN
    SELECT count(*) INTO v_n FROM public.folios f
     WHERE f.org_id = v_org AND f.estado = 'En Firma'
       AND (EXISTS (SELECT 1 FROM public.folio_comite fc WHERE fc.folio_id = f.id AND fc.user_id = v_uid AND fc.firmado = false)
            OR public.todos_firmaron(f.id));
    v_res := v_res || jsonb_build_object('en_firma', v_n);
    SELECT count(*) INTO v_n FROM public.folios f
     WHERE f.org_id = v_org AND f.estado = 'Cerrado' AND f.updated_at < now() - interval '1 year';
    v_res := v_res || jsonb_build_object('revision_vencida', v_n);
    SELECT count(*) INTO v_n FROM public.dc3_solicitudes d
     WHERE d.org_id = v_org AND d.estado = 'pendiente';
    v_res := v_res || jsonb_build_object('dc3_pendientes', v_n);
  ELSIF v_rol = 'comite_tecnico' THEN
    SELECT count(*) INTO v_n FROM public.folios f
     WHERE f.org_id = v_org AND f.estado = 'En Firma'
       AND EXISTS (SELECT 1 FROM public.folio_comite fc WHERE fc.folio_id = f.id AND fc.user_id = v_uid AND fc.firmado = false);
    v_res := v_res || jsonb_build_object('firmas', v_n);
    SELECT count(*) INTO v_n FROM public.folios f
     WHERE f.org_id = v_org AND f.estado = 'Borrador'
       AND EXISTS (SELECT 1 FROM public.folio_comite fc WHERE fc.folio_id = f.id AND fc.user_id = v_uid)
       AND NOT EXISTS (SELECT 1 FROM public.comite_votos cv WHERE cv.folio_id = f.id AND cv.user_id = v_uid)
       AND EXISTS (SELECT 1 FROM public.audit_trail a WHERE a.tabla = 'folios' AND a.registro_id = f.id AND a.accion = 'SOLICITUD_VOTACION');
    v_res := v_res || jsonb_build_object('votos', v_n);
  ELSIF v_rol = 'operador' THEN
    SELECT count(*) INTO v_n FROM public.folios f
     WHERE f.org_id = v_org AND f.estado = 'Borrador' AND f.created_by = v_uid;
    v_res := v_res || jsonb_build_object('borradores', v_n);
  END IF;

  -- Avance de curso por persona (capacitacion_progreso existe por org/usuario/curso/lección)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'norma', c.norma, 'total', t.total, 'completadas', t.completadas, 'aprobado', t.aprobado)), '[]'::jsonb)
    INTO v_cursos
  FROM public.cursos c
  CROSS JOIN LATERAL (
    SELECT
      (SELECT count(*) FROM public.curso_lecciones l JOIN public.curso_modulos m ON m.id = l.modulo_id
        WHERE m.curso_id = c.id AND l.activo AND NOT l.proximamente)::int AS total,
      (SELECT count(*) FROM public.curso_lecciones l JOIN public.curso_modulos m ON m.id = l.modulo_id
        WHERE m.curso_id = c.id AND l.activo AND NOT l.proximamente
          AND EXISTS (SELECT 1 FROM public.capacitacion_progreso p
                       WHERE p.org_id = v_org AND p.user_id = v_uid AND p.completado
                         AND p.leccion_id = l.leccion_id
                         AND p.curso_id = CASE c.norma WHEN 'NOM-241' THEN 'nom241' ELSE 'nom059' END))::int AS completadas,
      EXISTS (SELECT 1 FROM public.curso_examen_intentos i
               WHERE i.curso_id = c.id AND i.user_id = v_uid AND i.org_id = v_org AND i.aprobado) AS aprobado
  ) t
  WHERE c.activo;
  v_res := v_res || jsonb_build_object('cursos', v_cursos);
  RETURN v_res;
END $function$;

-- Pendientes de Cerebro: solo conteos
CREATE OR REPLACE FUNCTION public.pendientes_cerebro()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.get_user_org_id();
  v_rol text;
  v_res jsonb;
  v_a int; v_b int; v_c int;
BEGIN
  IF v_org IS NULL OR auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT c.rol_en_org INTO v_rol FROM public.contexto_org_actual() c;
  IF v_rol = 'super_admin' THEN v_rol := 'admin'; END IF;
  SELECT count(*) INTO v_a FROM public.brain_knowledge_items k
   WHERE k.org_id = v_org AND k.estado IN ('por_validar','contradictorio','capturado');
  SELECT count(*) INTO v_b FROM public.brain_knowledge_items k
   WHERE k.org_id = v_org AND k.requiere_revision AND k.estado NOT IN ('obsoleto','sustituido','rechazado');
  v_res := jsonb_build_object('rol', v_rol, 'por_validar', v_a, 'requiere_revision', v_b);
  IF v_rol IN ('admin','responsable_sanitario') THEN
    SELECT count(*) INTO v_a FROM public.brain_documents d WHERE d.org_id = v_org AND d.estado_propuesto IS NOT NULL;
    SELECT count(*) INTO v_b FROM public.brain_documents d WHERE d.org_id = v_org AND d.enlace_por_confirmar;
    SELECT count(*) INTO v_c FROM public.org_documentos o WHERE o.org_id = v_org AND o.copia_no_controlada_propuesta AND o.deleted_at IS NULL;
    v_res := v_res || jsonb_build_object('estado_propuesto', v_a, 'enlace_por_confirmar', v_b, 'copia_no_controlada', v_c);
  END IF;
  RETURN v_res;
END $function$;

REVOKE ALL ON FUNCTION public.mis_modulos() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pendientes_riesgos() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pendientes_cerebro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_modulos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pendientes_riesgos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pendientes_cerebro() TO authenticated;