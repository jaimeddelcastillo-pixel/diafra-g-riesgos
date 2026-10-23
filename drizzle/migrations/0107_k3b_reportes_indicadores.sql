-- K3-b: periodic KPI report (model of tend_registros_at). Writes only through RPCs; insert-only history/config; never DELETE.
CREATE TABLE public.kpi_reporte_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  version int NOT NULL,
  objetivo text NOT NULL DEFAULT '',
  alcance text NOT NULL DEFAULT '',
  metodologia text NOT NULL DEFAULT '',
  autorizadores uuid[] NOT NULL DEFAULT '{}',
  motivo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (org_id, version)
);
GRANT SELECT ON public.kpi_reporte_config TO authenticated;
GRANT ALL ON public.kpi_reporte_config TO service_role;
ALTER TABLE public.kpi_reporte_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_reporte_config_lectura ON public.kpi_reporte_config FOR SELECT TO authenticated USING (org_id = (SELECT public.get_user_org_id()) AND (SELECT public.kpi_acceso(public.get_user_org_id())));

CREATE TABLE public.kpi_reportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  codigo text NOT NULL,
  version int NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','emitido','anulado')),
  etapa text NOT NULL DEFAULT 'edicion' CHECK (etapa IN ('edicion','revision','autorizacion','cerrado')),
  tipo_periodo text NOT NULL CHECK (tipo_periodo IN ('trimestre','semestre','año')),
  periodo_inicio date NOT NULL,
  periodo_fin date NOT NULL,
  alcance_procesos text[] NOT NULL DEFAULT '{}',
  alcance_puestos uuid[] NOT NULL DEFAULT '{}',
  objetivo text NOT NULL DEFAULT '',
  alcance text NOT NULL DEFAULT '',
  metodologia text NOT NULL DEFAULT '',
  analisis jsonb NOT NULL DEFAULT '{}'::jsonb,
  conclusiones text NOT NULL DEFAULT '',
  elaboro_por uuid,
  revisores uuid[] NOT NULL DEFAULT '{}',
  revisiones jsonb NOT NULL DEFAULT '[]'::jsonb,
  firmantes jsonb,
  formato_snapshot jsonb,
  datos_snapshot jsonb,
  emitido_en timestamptz,
  emitido_por uuid,
  anulado_en timestamptz,
  anulado_por uuid,
  motivo_anulacion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (org_id, codigo)
);
CREATE INDEX kpi_reportes_org_estado ON public.kpi_reportes(org_id, estado, etapa);
GRANT SELECT ON public.kpi_reportes TO authenticated;
GRANT ALL ON public.kpi_reportes TO service_role;
ALTER TABLE public.kpi_reportes ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_reportes_lectura ON public.kpi_reportes FOR SELECT TO authenticated USING (org_id = (SELECT public.get_user_org_id()) AND (SELECT public.kpi_acceso(public.get_user_org_id())));

CREATE TABLE public.kpi_reportes_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  reporte_id uuid NOT NULL REFERENCES public.kpi_reportes(id),
  codigo text NOT NULL,
  version int NOT NULL,
  estado text NOT NULL,
  contenido jsonb NOT NULL,
  motivo text NOT NULL,
  archivado_en timestamptz NOT NULL DEFAULT now(),
  archivado_por uuid
);
CREATE INDEX kpi_reportes_historial_rep ON public.kpi_reportes_historial(reporte_id, version);
GRANT SELECT ON public.kpi_reportes_historial TO authenticated;
GRANT ALL ON public.kpi_reportes_historial TO service_role;
ALTER TABLE public.kpi_reportes_historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_reportes_historial_lectura ON public.kpi_reportes_historial FOR SELECT TO authenticated USING (org_id = (SELECT public.get_user_org_id()) AND (SELECT public.kpi_acceso(public.get_user_org_id())));

CREATE OR REPLACE FUNCTION public.kpi_reportes_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Nunca se borra: usa anular'; END IF;
  IF TG_TABLE_NAME IN ('kpi_reportes_historial','kpi_reporte_config') AND TG_OP='UPDATE' THEN RAISE EXCEPTION 'Registro inmutable'; END IF;
  IF coalesce(current_setting('tracea.kpi_reportes_rpc', true),'')<>'1' THEN RAISE EXCEPTION 'Solo mediante las funciones de reportes'; END IF;
  IF TG_TABLE_NAME='kpi_reportes' AND TG_OP='UPDATE' AND OLD.estado IN ('emitido','anulado') AND coalesce(current_setting('tracea.kpi_reportes_transicion', true),'')<>'1' THEN
    RAISE EXCEPTION 'Un reporte % no se edita', OLD.estado; END IF;
  IF TG_TABLE_NAME='kpi_reportes' AND TG_OP='UPDATE' AND OLD.estado='anulado' THEN RAISE EXCEPTION 'Un reporte anulado no cambia'; END IF;
  IF TG_TABLE_NAME='kpi_reportes' THEN NEW.updated_at:=now(); NEW.updated_by:=auth.uid(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON public.kpi_reportes FOR EACH ROW EXECUTE FUNCTION public.kpi_reportes_guard();
CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON public.kpi_reportes_historial FOR EACH ROW EXECUTE FUNCTION public.kpi_reportes_guard();
CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON public.kpi_reporte_config FOR EACH ROW EXECUTE FUNCTION public.kpi_reportes_guard();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.kpi_reportes FOR EACH STATEMENT EXECUTE FUNCTION public.kpi_bloquear_truncate();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.kpi_reportes_historial FOR EACH STATEMENT EXECUTE FUNCTION public.kpi_bloquear_truncate();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.kpi_reporte_config FOR EACH STATEMENT EXECUTE FUNCTION public.kpi_bloquear_truncate();
CREATE TRIGGER audit AFTER INSERT OR UPDATE ON public.kpi_reportes FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit AFTER INSERT ON public.kpi_reportes_historial FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit AFTER INSERT ON public.kpi_reporte_config FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE OR REPLACE FUNCTION public.kpi_reporte_autoriza(_org uuid, _u uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record; cfg uuid[];
BEGIN
  IF _u IS NULL OR NOT EXISTS(SELECT 1 FROM org_members m JOIN profiles p ON p.id=m.user_id AND p.activo WHERE m.org_id=_org AND m.user_id=_u) THEN RETURN NULL; END IF;
  IF EXISTS(SELECT 1 FROM org_members m JOIN profiles p ON p.id=m.user_id AND p.activo WHERE m.org_id=_org AND m.user_id=_u AND m.role='aseguramiento_calidad') THEN RETURN ''; END IF;
  SELECT x.* INTO s FROM org_suplencias x JOIN org_members t ON t.org_id=x.org_id AND t.user_id=x.titular_user_id AND t.role='aseguramiento_calidad' JOIN profiles tp ON tp.id=t.user_id AND tp.activo
   WHERE x.org_id=_org AND x.suplente_user_id=_u AND x.rol_sustituido='aseguramiento_calidad' AND 'autorizar'=ANY(x.facultades) AND x.estado='activa' AND x.aceptada_en IS NOT NULL AND x.revocada_en IS NULL AND x.fecha_inicio<=now() AND now()<x.fecha_fin
   ORDER BY x.fecha_inicio DESC LIMIT 1;
  IF FOUND THEN RETURN '— En suplencia de '||coalesce(s.titular_nombre,'titular de Aseguramiento de Calidad'); END IF;
  IF NOT EXISTS(SELECT 1 FROM org_members m JOIN profiles p ON p.id=m.user_id AND p.activo WHERE m.org_id=_org AND m.role='aseguramiento_calidad') THEN
    SELECT c.autorizadores INTO cfg FROM kpi_reporte_config c WHERE c.org_id=_org ORDER BY c.version DESC LIMIT 1;
    IF _u=ANY(coalesce(cfg,'{}')) THEN RETURN ', en ausencia de Aseguramiento de Calidad'; END IF;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.kpi_reporte_autoriza(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kpi_reporte_autoriza(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.kpi_reporte_preparar(_motivo text) RETURNS uuid LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE org uuid:=public.get_user_org_id(); BEGIN
  IF org IS NULL OR auth.uid() IS NULL OR NOT public.kpi_acceso(org) THEN RAISE EXCEPTION 'Sin acceso a Indicadores'; END IF;
  PERFORM set_config('tracea.kpi_reportes_rpc','1',true);
  PERFORM set_config('tracea.motivo',coalesce(_motivo,''),true);
  RETURN org;
END $$;
REVOKE ALL ON FUNCTION public.kpi_reporte_preparar(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guardar_kpi_reporte_config(_objetivo text, _alcance text, _metodologia text, _autorizadores uuid[], _motivo text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; prev kpi_reporte_config; nid uuid; BEGIN
  IF length(trim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
  org:=public.kpi_reporte_preparar(_motivo);
  IF NOT public.kpi_acceso(org,true) THEN RAISE EXCEPTION 'Sin permiso para configurar reportes'; END IF;
  SELECT * INTO prev FROM kpi_reporte_config WHERE org_id=org ORDER BY version DESC LIMIT 1;
  IF coalesce(_autorizadores,'{}') IS DISTINCT FROM coalesce(prev.autorizadores,'{}') THEN
    IF NOT public.rol_efectivo(auth.uid(),'admin') THEN RAISE EXCEPTION 'Solo el admin designa quién autoriza en ausencia de Aseguramiento de Calidad'; END IF;
    IF EXISTS(SELECT 1 FROM unnest(coalesce(_autorizadores,'{}')) a WHERE NOT EXISTS(SELECT 1 FROM org_members m JOIN profiles p ON p.id=m.user_id AND p.activo WHERE m.org_id=org AND m.user_id=a)) THEN RAISE EXCEPTION 'Autorizador fuera de la empresa'; END IF;
  END IF;
  INSERT INTO kpi_reporte_config(org_id,version,objetivo,alcance,metodologia,autorizadores,motivo,created_by)
  VALUES(org,coalesce(prev.version,0)+1,coalesce(_objetivo,''),coalesce(_alcance,''),coalesce(_metodologia,''),coalesce(_autorizadores,'{}'),trim(_motivo),auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.crear_kpi_reporte(_tipo text, _inicio date, _procesos text[] DEFAULT '{}', _puestos uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; f text; p record; cfg kpi_reporte_config; cod text; n int; nid uuid; revs uuid[]; BEGIN
  org:=public.kpi_reporte_preparar('Nuevo reporte de indicadores');
  IF NOT public.kpi_acceso(org,true) THEN RAISE EXCEPTION 'Sin permiso para elaborar reportes'; END IF;
  f:=CASE _tipo WHEN 'trimestre' THEN 'trimestral' WHEN 'semestre' THEN 'semestral' WHEN 'año' THEN 'anual' END;
  IF f IS NULL OR _inicio IS NULL THEN RAISE EXCEPTION 'Periodo inválido'; END IF;
  SELECT * INTO p FROM public.kpi_periodo(f,_inicio);
  IF p.fin >= (now() AT TIME ZONE 'America/Mexico_City')::date THEN RAISE EXCEPTION 'El periodo aún no cierra'; END IF;
  SELECT * INTO cfg FROM kpi_reporte_config WHERE org_id=org ORDER BY version DESC LIMIT 1;
  PERFORM pg_advisory_xact_lock(hashtext('kpi_reportes:'||org::text));
  SELECT coalesce(max(split_part(codigo,'-',3)::int),0)+1 INTO n FROM kpi_reportes WHERE org_id=org AND codigo LIKE 'IND-'||extract(year FROM p.inicio)::int||'-%';
  cod:='IND-'||extract(year FROM p.inicio)::int||'-'||lpad(n::text,3,'0');
  SELECT coalesce(array_agg(m.user_id ORDER BY m.user_id),'{}') INTO revs FROM org_members m JOIN profiles pr ON pr.id=m.user_id AND pr.activo AND pr.perfil_confirmado_en IS NOT NULL
    WHERE m.org_id=org AND m.role='responsable_sanitario' AND m.user_id<>auth.uid();
  INSERT INTO kpi_reportes(org_id,codigo,tipo_periodo,periodo_inicio,periodo_fin,alcance_procesos,alcance_puestos,objetivo,alcance,metodologia,elaboro_por,revisores,created_by)
  VALUES(org,cod,_tipo,p.inicio,p.fin,coalesce(_procesos,'{}'),coalesce(_puestos,'{}'),coalesce(cfg.objetivo,''),coalesce(cfg.alcance,''),coalesce(cfg.metodologia,''),auth.uid(),revs,auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.guardar_kpi_reporte(_id uuid, _datos jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; r kpi_reportes; revs uuid[]; BEGIN
  org:=public.kpi_reporte_preparar('Edición de borrador');
  SELECT * INTO r FROM kpi_reportes WHERE id=_id AND org_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reporte no encontrado'; END IF;
  IF r.estado<>'borrador' OR r.etapa<>'edicion' THEN RAISE EXCEPTION 'Solo se edita un borrador en edición'; END IF;
  IF r.elaboro_por<>auth.uid() THEN RAISE EXCEPTION 'Solo quien elabora edita el borrador'; END IF;
  revs:=CASE WHEN _datos ? 'revisores' THEN ARRAY(SELECT jsonb_array_elements_text(_datos->'revisores')::uuid) ELSE r.revisores END;
  IF auth.uid()=ANY(revs) THEN RAISE EXCEPTION 'Quien elabora no puede revisar'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(revs) x WHERE NOT EXISTS(SELECT 1 FROM org_members m JOIN profiles p ON p.id=m.user_id AND p.activo AND p.perfil_confirmado_en IS NOT NULL WHERE m.org_id=org AND m.user_id=x)) THEN RAISE EXCEPTION 'Revisor no elegible'; END IF;
  UPDATE kpi_reportes SET objetivo=coalesce(_datos->>'objetivo',objetivo), alcance=coalesce(_datos->>'alcance',alcance), metodologia=coalesce(_datos->>'metodologia',metodologia),
    analisis=coalesce(_datos->'analisis',analisis), conclusiones=coalesce(_datos->>'conclusiones',conclusiones), revisores=revs,
    alcance_procesos=CASE WHEN _datos ? 'procesos' THEN ARRAY(SELECT jsonb_array_elements_text(_datos->'procesos')) ELSE alcance_procesos END,
    alcance_puestos=CASE WHEN _datos ? 'puestos' THEN ARRAY(SELECT jsonb_array_elements_text(_datos->'puestos')::uuid) ELSE alcance_puestos END
  WHERE id=_id AND org_id=org;
END $$;

CREATE OR REPLACE FUNCTION public.kpi_reporte_faltantes(_r public.kpi_reportes) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb; faltan text; BEGIN
  IF length(trim(_r.conclusiones))=0 THEN RETURN 'Las conclusiones son obligatorias'; END IF;
  res:=public.kpi_resumen_periodo(_r.tipo_periodo,_r.periodo_inicio,'{}');
  SELECT string_agg(e->>'codigo',', ' ORDER BY e->>'codigo') INTO faltan FROM jsonb_array_elements(res->'kpis') e
   WHERE e->>'tabla'='kpi_definiciones' AND e->>'nivel'='SGC' AND e->>'semaforo'='rojo'
     AND (cardinality(_r.alcance_procesos)=0 OR e->>'proceso'=ANY(_r.alcance_procesos))
     AND length(trim(coalesce(_r.analisis->(e->>'id')->>'causa','')))=0;
  IF faltan IS NOT NULL THEN RETURN 'Falta el análisis de los KPI SGC en rojo: '||faltan; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.kpi_reporte_faltantes(public.kpi_reportes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enviar_kpi_reporte(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; r kpi_reportes; e text; BEGIN
  org:=public.kpi_reporte_preparar('Envío a revisión');
  SELECT * INTO r FROM kpi_reportes WHERE id=_id AND org_id=org FOR UPDATE;
  IF NOT FOUND OR r.estado<>'borrador' OR r.etapa<>'edicion' THEN RAISE EXCEPTION 'Solo se envía un borrador en edición'; END IF;
  IF r.elaboro_por<>auth.uid() THEN RAISE EXCEPTION 'Solo quien elabora lo envía'; END IF;
  IF cardinality(r.revisores)=0 THEN RAISE EXCEPTION 'Asigna al menos un revisor'; END IF;
  e:=public.kpi_reporte_faltantes(r); IF e IS NOT NULL THEN RAISE EXCEPTION '%', e; END IF;
  UPDATE kpi_reportes SET etapa='revision', revisiones='[]'::jsonb WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.revisar_kpi_reporte(_id uuid, _aprobar boolean, _comentario text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; r kpi_reportes; revs jsonb; BEGIN
  org:=public.kpi_reporte_preparar(coalesce(nullif(trim(_comentario),''),CASE WHEN _aprobar THEN 'Revisión aprobada' ELSE 'Devuelto a edición' END));
  SELECT * INTO r FROM kpi_reportes WHERE id=_id AND org_id=org FOR UPDATE;
  IF NOT FOUND OR r.estado<>'borrador' OR r.etapa<>'revision' THEN RAISE EXCEPTION 'El reporte no está en revisión'; END IF;
  IF NOT auth.uid()=ANY(r.revisores) THEN RAISE EXCEPTION 'No eres revisor de este reporte'; END IF;
  IF NOT _aprobar AND length(trim(coalesce(_comentario,'')))<5 THEN RAISE EXCEPTION 'Para devolver, el motivo es obligatorio (mínimo 5 caracteres)'; END IF;
  IF NOT _aprobar THEN UPDATE kpi_reportes SET etapa='edicion', revisiones='[]'::jsonb WHERE id=_id; RETURN; END IF;
  revs:=(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM jsonb_array_elements(r.revisiones) x WHERE x->>'user_id'<>auth.uid()::text)
        || jsonb_build_array(jsonb_build_object('user_id',auth.uid(),'fecha',now(),'comentario',coalesce(_comentario,'')));
  UPDATE kpi_reportes SET revisiones=revs,
    etapa=CASE WHEN (SELECT count(DISTINCT x->>'user_id') FROM jsonb_array_elements(revs) x WHERE (x->>'user_id')::uuid=ANY(r.revisores))>=cardinality(r.revisores) THEN 'autorizacion' ELSE 'revision' END
  WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.emitir_kpi_reporte(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; r kpi_reportes; e text; ley text; reg jsonb; firm jsonb; u uuid:=auth.uid(); BEGIN
  org:=public.kpi_reporte_preparar('Emisión del reporte');
  SELECT * INTO r FROM kpi_reportes WHERE id=_id AND org_id=org FOR UPDATE;
  IF NOT FOUND OR r.estado<>'borrador' OR r.etapa<>'autorizacion' THEN RAISE EXCEPTION 'El reporte no está listo para autorizar'; END IF;
  IF u=r.elaboro_por OR u=ANY(r.revisores) THEN RAISE EXCEPTION 'Quien autoriza no puede ser quien elaboró ni quien revisó'; END IF;
  ley:=public.kpi_reporte_autoriza(org,u);
  IF ley IS NULL THEN RAISE EXCEPTION 'Solo Aseguramiento de Calidad (o su suplente o designado) autoriza'; END IF;
  e:=public.kpi_reporte_faltantes(r); IF e IS NOT NULL THEN RAISE EXCEPTION '%', e; END IF;
  reg:=public.registrar_documento_generado('indicadores.reporte_word', r.codigo||'-v'||r.version||'.docx');
  SELECT jsonb_build_object(
    'elaboro',(SELECT jsonb_build_object('user_id',p.id,'nombre',coalesce(p.nombre,p.email),'cargo',coalesce(p.cargo,''),'fecha',r.created_at) FROM profiles p WHERE p.id=r.elaboro_por),
    'revisaron',(SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'nombre',coalesce(p.nombre,p.email),'cargo',coalesce(p.cargo,''),'fecha',x->>'fecha') ORDER BY x->>'fecha'),'[]'::jsonb) FROM jsonb_array_elements(r.revisiones) x JOIN profiles p ON p.id=(x->>'user_id')::uuid),
    'autorizo',(SELECT jsonb_build_object('user_id',p.id,'nombre',coalesce(p.nombre,p.email),'cargo',coalesce(p.cargo,''),'fecha',now(),'leyenda',ley) FROM profiles p WHERE p.id=u)) INTO firm;
  PERFORM set_config('tracea.kpi_reportes_transicion','1',true);
  UPDATE kpi_reportes SET estado='emitido', etapa='cerrado', emitido_en=now(), emitido_por=u, firmantes=firm,
    datos_snapshot=public.kpi_resumen_periodo(r.tipo_periodo,r.periodo_inicio,'{}'),
    formato_snapshot=reg || jsonb_build_object('tipo','indicadores.reporte_word')
  WHERE id=_id;
  PERFORM set_config('tracea.kpi_reportes_transicion','',true);
  RETURN reg;
END $$;

CREATE OR REPLACE FUNCTION public.nueva_version_kpi_reporte(_id uuid, _motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; r kpi_reportes; BEGIN
  IF length(trim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
  org:=public.kpi_reporte_preparar(_motivo);
  IF NOT public.kpi_acceso(org,true) THEN RAISE EXCEPTION 'Sin permiso para elaborar reportes'; END IF;
  SELECT * INTO r FROM kpi_reportes WHERE id=_id AND org_id=org FOR UPDATE;
  IF NOT FOUND OR r.estado<>'emitido' THEN RAISE EXCEPTION 'Solo un emitido abre nueva versión'; END IF;
  INSERT INTO kpi_reportes_historial(org_id,reporte_id,codigo,version,estado,contenido,motivo,archivado_por) VALUES(org,r.id,r.codigo,r.version,r.estado,to_jsonb(r),trim(_motivo),auth.uid());
  PERFORM set_config('tracea.kpi_reportes_transicion','1',true);
  UPDATE kpi_reportes SET version=r.version+1, estado='borrador', etapa='edicion', elaboro_por=auth.uid(), revisores=array_remove(revisores,auth.uid()), revisiones='[]'::jsonb,
    firmantes=NULL, datos_snapshot=NULL, formato_snapshot=NULL, emitido_en=NULL, emitido_por=NULL WHERE id=_id;
  PERFORM set_config('tracea.kpi_reportes_transicion','',true);
END $$;

-- Annulment: an issued report only by someone who can authorize and never by its author; a draft by its author or an admin.
CREATE OR REPLACE FUNCTION public.anular_kpi_reporte(_id uuid, _motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; r kpi_reportes; u uuid:=auth.uid(); BEGIN
  IF length(trim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
  org:=public.kpi_reporte_preparar(_motivo);
  SELECT * INTO r FROM kpi_reportes WHERE id=_id AND org_id=org FOR UPDATE;
  IF NOT FOUND OR r.estado='anulado' THEN RAISE EXCEPTION 'Reporte no encontrado o ya anulado'; END IF;
  IF r.estado='emitido' THEN
    IF u=r.elaboro_por THEN RAISE EXCEPTION 'Quien elaboró el reporte no puede anularlo'; END IF;
    IF public.kpi_reporte_autoriza(org,u) IS NULL THEN RAISE EXCEPTION 'Solo quien puede autorizar anula un reporte emitido'; END IF;
  ELSIF NOT (u=r.elaboro_por OR public.rol_efectivo(u,'admin')) THEN
    RAISE EXCEPTION 'Un borrador solo lo anula quien lo elabora o un admin';
  END IF;
  PERFORM set_config('tracea.kpi_reportes_transicion','1',true);
  UPDATE kpi_reportes SET estado='anulado', etapa='cerrado', anulado_en=now(), anulado_por=u, motivo_anulacion=trim(_motivo) WHERE id=_id;
  PERFORM set_config('tracea.kpi_reportes_transicion','',true);
END $$;

REVOKE ALL ON FUNCTION public.guardar_kpi_reporte_config(text,text,text,uuid[],text), public.crear_kpi_reporte(text,date,text[],uuid[]), public.guardar_kpi_reporte(uuid,jsonb),
  public.enviar_kpi_reporte(uuid), public.revisar_kpi_reporte(uuid,boolean,text), public.emitir_kpi_reporte(uuid), public.nueva_version_kpi_reporte(uuid,text), public.anular_kpi_reporte(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_kpi_reporte_config(text,text,text,uuid[],text), public.crear_kpi_reporte(text,date,text[],uuid[]), public.guardar_kpi_reporte(uuid,jsonb),
  public.enviar_kpi_reporte(uuid), public.revisar_kpi_reporte(uuid,boolean,text), public.emitir_kpi_reporte(uuid), public.nueva_version_kpi_reporte(uuid,text), public.anular_kpi_reporte(uuid,text) TO authenticated;

-- Mis pendientes: full rewrite with all current lines plus «reportes por revisar» and «reportes por autorizar».
CREATE OR REPLACE FUNCTION public.pendientes_usuario(_alcance text DEFAULT 'mio'::text)
 RETURNS TABLE(modulo text, tipo text, registro uuid, titulo text, ruta text, nace_en timestamp with time zone, fecha_limite date, perfil text, dias integer, color text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE org uuid:=public.get_user_org_id(); u uuid:=auth.uid(); es_rs boolean; es_adm boolean; es_op boolean; emp boolean:=(_alcance='empresa');
 hoy date:=(now() AT TIME ZONE 'America/Mexico_City')::date; c record; m_t boolean; m_r boolean; m_c boolean;
BEGIN
 IF org IS NULL OR u IS NULL THEN RETURN; END IF;
 es_rs:=public.rol_efectivo(u,'responsable_sanitario'); es_adm:=public.rol_efectivo(u,'admin');
 es_op:=es_rs OR es_adm OR public.rol_efectivo(u,'operador') OR public.rol_efectivo(u,'comite_tecnico');
 IF emp AND NOT (es_rs OR es_adm) THEN RAISE EXCEPTION 'Solo admin o RS ven los pendientes de la empresa'; END IF;
 IF NOT emp AND NOT EXISTS(SELECT 1 FROM public.org_members om WHERE om.org_id=org AND om.user_id=u) THEN RETURN; END IF;
 SELECT coalesce(max(s.operativo_naranja),3) o_n,coalesce(max(s.operativo_rojo),7) o_r,coalesce(max(s.gestion_naranja),10) g_n,coalesce(max(s.gestion_rojo),20) g_r INTO c FROM public.org_pendientes_semaforo s WHERE s.org_id=org;
 m_t:=public.org_tiene_modulo(org,'tendencias'); m_r:=public.org_tiene_modulo(org,'riesgos'); m_c:=public.org_tiene_modulo(org,'institutional_brain');
 RETURN QUERY WITH b(modulo,tipo,registro,titulo,ruta,nace_en,fecha_limite,perfil) AS (
  SELECT 'plataforma'::text,'perfil_sin_confirmar'::text,p.id,CASE WHEN emp AND p.id<>u THEN 'Perfil sin confirmar: '||coalesce(p.nombre,p.email) ELSE 'Confirma tu nombre completo y tu cargo' END,'/pendientes?confirmar=perfil'::text,coalesce(p.created_at,now()),NULL::date,'operativo'::text
  FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id
  WHERE om.org_id=org AND p.activo AND om.role<>'super_admin' AND p.perfil_confirmado_en IS NULL AND (emp OR p.id=u)
  UNION ALL
  SELECT 'plataforma','suplencia_por_aceptar',s.id,'Aceptar suplencia de '||CASE s.rol_sustituido WHEN 'admin' THEN 'Administrador' WHEN 'aseguramiento_calidad' THEN 'Aseguramiento de Calidad' ELSE 'Responsable Sanitario' END||coalesce(' de '||coalesce(s.titular_nombre,s.rs_titular_nombre),''),'/configuracion/suplencias',s.created_at,(s.fecha_inicio AT TIME ZONE 'America/Mexico_City')::date,'operativo'
  FROM public.org_suplencias s WHERE s.org_id=org AND s.estado='pendiente de aceptación' AND s.revocada_en IS NULL AND s.fecha_fin>now() AND (emp OR s.suplente_user_id=u)
  UNION ALL
  SELECT 'tendencias','at_borrador',a.id,'AT '||coalesce(a.codigo,'sin código')||' en borrador','/tendencias/reporte/'||a.id,a.created_at,NULL::date,'gestion'
  FROM public.tend_registros_at a WHERE m_t AND a.org_id=org AND a.estado='borrador' AND (emp OR es_rs)
  UNION ALL
  SELECT 'tendencias','semana_sin_captura',r.id,r.nombre||' · semana del '||to_char(w.ini,'DD-MM-YYYY'),'/tendencias/captura?registro='||r.id,((w.ini+7)::timestamp AT TIME ZONE 'America/Mexico_City'),NULL::date,'operativo'
  FROM public.tend_registros r
  CROSS JOIN LATERAL (SELECT least(date_trunc('week',(r.created_at AT TIME ZONE 'America/Mexico_City'))::date,
     coalesce((SELECT date_trunc('week',min(x.semana_inicio))::date FROM public.tend_semanas x WHERE x.registro_id=r.id AND x.activo),'infinity'::date)) primero) i
  CROSS JOIN LATERAL generate_series(i.primero,hoy-7,interval '7 day') g(d)
  CROSS JOIN LATERAL (SELECT g.d::date ini) w
  WHERE m_t AND r.org_id=org AND r.activo AND (emp OR es_op)
   AND NOT EXISTS(SELECT 1 FROM public.tend_semanas x WHERE x.registro_id=r.id AND x.activo AND x.semana_inicio BETWEEN w.ini AND w.ini+6)
  UNION ALL
  SELECT 'riesgos','accion_abierta',ri.id,coalesce(f.codigo,'Folio')||' · R'||ri.numero_id||': acción pendiente','/folios/'||f.id,ri.created_at,ri.fecha_compromiso,'gestion'
  FROM public.riesgos ri JOIN public.folios f ON f.id=ri.folio_id
  WHERE m_r AND f.org_id=org AND f.estado NOT IN ('Cancelado','Cerrado') AND ri.requiere_accion AND ri.fecha_compromiso IS NOT NULL AND coalesce(btrim(ri.accion_implementada),'')=''
   AND (emp OR es_rs OR es_adm OR f.created_by=u)
  UNION ALL
  SELECT 'riesgos','folio_en_firma',f.id,coalesce(f.codigo,'Folio')||' en firma','/folios/'||f.id,f.updated_at,NULL::date,'gestion'
  FROM public.folios f WHERE m_r AND f.org_id=org AND f.estado='En Firma' AND (emp OR es_rs)
  UNION ALL
  SELECT 'institutional_brain','conocimiento_por_validar',k.id,'Conocimiento '||coalesce(k.codigo||' ','')||'por validar','/cerebro/validacion',k.created_at,NULL::date,'gestion'
  FROM public.brain_knowledge_items k WHERE m_c AND k.org_id=org AND k.estado='por_validar' AND (emp OR es_rs OR es_adm)
 UNION ALL
 SELECT 'indicadores','kpi_por_validar',k.registro,k.n||' KPI '||k.cat||' por validar',k.ruta,k.nace_en,NULL::date,'gestion'
 FROM (SELECT (array_agg(id ORDER BY updated_at,id))[1] registro,count(*) n,'del SGC'::text cat,'/indicadores?hoja=KPI_SGC'::text ruta,min(updated_at) nace_en FROM public.kpi_definiciones WHERE org_id=org AND activo AND estado='borrador' HAVING count(*)>0
       UNION ALL SELECT (array_agg(id ORDER BY updated_at,id))[1],count(*),'de puesto','/indicadores?hoja=KPI_Puesto',min(updated_at) FROM public.kpi_puesto WHERE org_id=org AND activo AND estado='borrador' HAVING count(*)>0) k
 WHERE public.org_tiene_modulo(org,'indicadores') AND (es_rs OR public.rol_efectivo(u,'aseguramiento_calidad'))
 UNION ALL
 SELECT 'indicadores','kpi_por_capturar',k.registro,k.n||' KPI por capturar del periodo '||k.etiqueta,'/indicadores?hoja=Captura&mios=1',k.nace_en,NULL::date,'gestion'
 FROM (SELECT per.inicio,per.fin,to_char(per.inicio,'DD-MM-YYYY')||' al '||to_char(per.fin,'DD-MM-YYYY') etiqueta,(array_agg(k.id ORDER BY k.codigo))[1] registro,count(*) n,((per.fin+6)::timestamp AT TIME ZONE 'America/Mexico_City') nace_en
 FROM (SELECT 'mensual'::text frecuencia,date_trunc('month',hoy-interval '1 month')::date inicio,date_trunc('month',hoy)::date-1 fin
 UNION ALL SELECT 'trimestral',(date_trunc('quarter',hoy)-interval '3 months')::date,date_trunc('quarter',hoy)::date-1
 UNION ALL SELECT 'semestral',(make_date(extract(year FROM hoy)::int,CASE WHEN extract(month FROM hoy)>=7 THEN 7 ELSE 1 END,1)-interval '6 months')::date,make_date(extract(year FROM hoy)::int,CASE WHEN extract(month FROM hoy)>=7 THEN 7 ELSE 1 END,1)-1
 UNION ALL SELECT 'anual',make_date(extract(year FROM hoy)::int-1,1,1),make_date(extract(year FROM hoy)::int-1,12,31)) per
 JOIN (SELECT id,org_id,codigo,frecuencia,capturistas FROM public.kpi_definiciones WHERE activo AND estado='validado' AND frecuencia<>'por evento' UNION ALL SELECT id,org_id,codigo,frecuencia,capturistas FROM public.kpi_puesto WHERE activo AND estado='validado' AND frecuencia<>'por evento') k ON k.org_id=org AND k.frecuencia=per.frecuencia
 WHERE per.fin<hoy AND (emp OR u=ANY(k.capturistas)) AND NOT EXISTS(SELECT 1 FROM public.kpi_resultados r WHERE r.org_id=org AND r.activo AND coalesce(r.kpi_definicion_id,r.kpi_puesto_id)=k.id AND r.periodo_inicio=per.inicio)
 GROUP BY per.inicio,per.fin) k
 WHERE public.org_tiene_modulo(org,'indicadores')
 UNION ALL
 SELECT 'indicadores','kpi_por_revisar',r.registro,r.n||' resultados por revisar','/indicadores?hoja=Captura',r.nace_en,NULL::date,'gestion'
 FROM (SELECT (array_agg(id ORDER BY capturado_en,id))[1] registro,count(*) n,min(capturado_en) nace_en FROM public.kpi_resultados WHERE org_id=org AND activo AND estado='capturado' HAVING count(*)>0) r
 WHERE public.org_tiene_modulo(org,'indicadores') AND (emp OR es_rs OR public.rol_efectivo(u,'aseguramiento_calidad'))
 UNION ALL
 SELECT 'indicadores','kpi_reporte_por_revisar',x.registro,x.n||' reportes por revisar','/indicadores?hoja=Reportes',x.nace_en,NULL::date,'gestion'
 FROM (SELECT (array_agg(r.id ORDER BY r.updated_at,r.id))[1] registro,count(*) n,min(r.updated_at) nace_en FROM public.kpi_reportes r WHERE r.org_id=org AND r.estado='borrador' AND r.etapa='revision' AND (emp OR (u=ANY(r.revisores) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.revisiones) v WHERE v->>'user_id'=u::text))) HAVING count(*)>0) x
 WHERE public.org_tiene_modulo(org,'indicadores')
 UNION ALL
 SELECT 'indicadores','kpi_reporte_por_autorizar',x.registro,x.n||' reportes por autorizar','/indicadores?hoja=Reportes',x.nace_en,NULL::date,'gestion'
 FROM (SELECT (array_agg(r.id ORDER BY r.updated_at,r.id))[1] registro,count(*) n,min(r.updated_at) nace_en FROM public.kpi_reportes r WHERE r.org_id=org AND r.estado='borrador' AND r.etapa='autorizacion' AND (emp OR (u<>r.elaboro_por AND NOT u=ANY(r.revisores) AND public.kpi_reporte_autoriza(org,u) IS NOT NULL)) HAVING count(*)>0) x
 WHERE public.org_tiene_modulo(org,'indicadores')
 )
 SELECT b.modulo,b.tipo,b.registro,b.titulo,b.ruta,b.nace_en,b.fecha_limite,b.perfil,
  greatest(0,hoy-(b.nace_en AT TIME ZONE 'America/Mexico_City')::date)::integer,
  public.pendientes_color(b.perfil,greatest(0,hoy-(b.nace_en AT TIME ZONE 'America/Mexico_City')::date)::integer,b.fecha_limite IS NOT NULL AND b.fecha_limite<hoy,c.o_n,c.o_r,c.g_n,c.g_r)
 FROM b;
END $function$;