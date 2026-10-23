ALTER TABLE public.kpi_resultados ADD COLUMN IF NOT EXISTS referencia_fuente text NOT NULL DEFAULT '';

CREATE TABLE public.kpi_evidencias(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL DEFAULT public.get_user_org_id() REFERENCES public.organizations(id),periodo_inicio date NOT NULL,periodo_fin date NOT NULL,nombre text NOT NULL,path text NOT NULL,activo boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,UNIQUE(org_id,id));
CREATE TABLE public.kpi_resultado_evidencia(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL DEFAULT public.get_user_org_id() REFERENCES public.organizations(id),resultado_id uuid NOT NULL REFERENCES public.kpi_resultados(id),evidencia_id uuid NOT NULL,activo boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,FOREIGN KEY(org_id,evidencia_id) REFERENCES public.kpi_evidencias(org_id,id),UNIQUE(resultado_id,evidencia_id));
GRANT SELECT ON public.kpi_evidencias TO authenticated;GRANT ALL ON public.kpi_evidencias TO service_role;
GRANT SELECT ON public.kpi_resultado_evidencia TO authenticated;GRANT ALL ON public.kpi_resultado_evidencia TO service_role;
ALTER TABLE public.kpi_evidencias ENABLE ROW LEVEL SECURITY;ALTER TABLE public.kpi_resultado_evidencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_evidencias_lectura ON public.kpi_evidencias FOR SELECT TO authenticated USING(public.kpi_acceso(org_id));
CREATE POLICY kpi_resultado_evidencia_lectura ON public.kpi_resultado_evidencia FOR SELECT TO authenticated USING(public.kpi_acceso(org_id));
CREATE INDEX kpi_evidencias_periodo ON public.kpi_evidencias(org_id,periodo_inicio) WHERE activo;
CREATE INDEX kpi_resultado_evidencia_res ON public.kpi_resultado_evidencia(org_id,resultado_id) WHERE activo;

CREATE OR REPLACE FUNCTION public.kpi_evidencias_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF TG_OP='DELETE' THEN RAISE EXCEPTION 'No se borran evidencias: retirar con activo = No';END IF;
IF coalesce(current_setting('tracea.kpi_resultados_rpc',true),'')<>'on' THEN RAISE EXCEPTION 'Escritura solo vía funciones del servidor';END IF;
IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.created_by IS DISTINCT FROM OLD.created_by) THEN RAISE EXCEPTION 'Identidad inmutable';END IF;
IF TG_OP='INSERT' THEN NEW.created_at:=now();NEW.created_by:=auth.uid();END IF;
NEW.updated_at:=now();NEW.updated_by:=auth.uid();RETURN NEW;END $$;
CREATE TRIGGER kpi_evidencias_guard BEFORE INSERT OR UPDATE OR DELETE ON public.kpi_evidencias FOR EACH ROW EXECUTE FUNCTION public.kpi_evidencias_guard();
CREATE TRIGGER kpi_evidencias_audit AFTER INSERT OR UPDATE ON public.kpi_evidencias FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER kpi_evidencias_no_truncate BEFORE TRUNCATE ON public.kpi_evidencias EXECUTE FUNCTION public.kpi_bloquear_truncate();
CREATE TRIGGER kpi_resultado_evidencia_guard BEFORE INSERT OR UPDATE OR DELETE ON public.kpi_resultado_evidencia FOR EACH ROW EXECUTE FUNCTION public.kpi_evidencias_guard();
CREATE TRIGGER kpi_resultado_evidencia_audit AFTER INSERT OR UPDATE ON public.kpi_resultado_evidencia FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER kpi_resultado_evidencia_no_truncate BEFORE TRUNCATE ON public.kpi_resultado_evidencia EXECUTE FUNCTION public.kpi_bloquear_truncate();

CREATE OR REPLACE FUNCTION public.kpi_ultimo_cerrado(_frecuencia text,_hoy date,OUT inicio date,OUT fin date) LANGUAGE sql IMMUTABLE AS $$
SELECT q.inicio,q.fin FROM public.kpi_periodo(_frecuencia,(SELECT a.inicio FROM public.kpi_periodo(_frecuencia,_hoy) a)-1) q $$;
GRANT EXECUTE ON FUNCTION public.kpi_ultimo_cerrado(text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.guardar_kpi_resultado(_tabla text,_kpi_id uuid,_periodo_inicio date,_fecha_evento date,_descripcion_evento text,_numerador numeric,_denominador numeric,_referencia text,_comentario text,_motivo text,_resultado_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); hoy date:=(now() AT TIME ZONE 'America/Mexico_City')::date; k record; r0 record; per record; calc record; rid uuid; es_sgc boolean:=false; p_ini date; p_fin date; ref text; unidad text; BEGIN
IF org IS NULL OR _tabla NOT IN ('kpi_definiciones','kpi_puesto') THEN RAISE EXCEPTION 'KPI no encontrado';END IF;
IF _tabla='kpi_definiciones' THEN
  SELECT d.id,d.activo,d.estado,d.capturistas,d.frecuencia,d.unidad,d.tendencia,d.meta,(d.nivel='SGC') sgc INTO k FROM public.kpi_definiciones d WHERE d.id=_kpi_id AND d.org_id=org;
ELSE
  SELECT p.id,p.activo,p.estado,p.capturistas,p.frecuencia,p.unidad,p.tendencia,p.meta,false sgc INTO k FROM public.kpi_puesto p WHERE p.id=_kpi_id AND p.org_id=org;
END IF;
IF k.id IS NULL THEN RAISE EXCEPTION 'KPI no encontrado';END IF;
IF NOT (k.activo AND k.estado='validado') THEN RAISE EXCEPTION 'Solo se capturan KPI validados y activos';END IF;
IF NOT public.kpi_puede_capturar(org,k.capturistas) THEN RAISE EXCEPTION 'Sin permiso de captura de Indicadores';END IF;
es_sgc:=coalesce(k.sgc,false);
IF _numerador IS NULL THEN RAISE EXCEPTION 'Numerador obligatorio';END IF;
IF _resultado_id IS NOT NULL THEN
  SELECT * INTO r0 FROM public.kpi_resultados WHERE id=_resultado_id AND org_id=org AND activo AND coalesce(kpi_definicion_id,kpi_puesto_id)=_kpi_id;
  IF r0.id IS NULL THEN RAISE EXCEPTION 'Resultado no encontrado';END IF;
END IF;
unidad:=coalesce(r0.unidad_copia,k.unidad);
IF unidad<>'número' AND _denominador IS NULL THEN RAISE EXCEPTION 'Denominador obligatorio: la unidad no es «número»';END IF;
ref:=coalesce(nullif(btrim(coalesce(_referencia,'')),''),r0.referencia_fuente,'');
IF es_sgc AND btrim(ref)='' THEN RAISE EXCEPTION 'Referencia de la fuente obligatoria en KPI de nivel SGC';END IF;
IF k.frecuencia='por evento' THEN
  IF _fecha_evento IS NULL OR coalesce(btrim(_descripcion_evento),'')='' THEN RAISE EXCEPTION 'Fecha y descripción del evento obligatorias';END IF;
  IF _fecha_evento>hoy THEN RAISE EXCEPTION 'El periodo aún no cierra';END IF;
  p_ini:=_fecha_evento;p_fin:=_fecha_evento;
ELSE
  IF _periodo_inicio IS NULL THEN RAISE EXCEPTION 'Periodo obligatorio';END IF;
  SELECT p.inicio,p.fin INTO per FROM public.kpi_periodo(k.frecuencia,_periodo_inicio) p;
  p_ini:=per.inicio;p_fin:=per.fin;
  IF _periodo_inicio IS DISTINCT FROM p_ini THEN RAISE EXCEPTION 'El periodo no corresponde a la frecuencia del KPI';END IF;
  IF p_fin>=hoy THEN RAISE EXCEPTION 'El periodo aún no cierra';END IF;
END IF;
PERFORM set_config('tracea.kpi_resultados_rpc','on',true);
IF _resultado_id IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.kpi_resultados r WHERE r.org_id=org AND r.activo AND coalesce(r.kpi_definicion_id,r.kpi_puesto_id)=_kpi_id AND r.periodo_inicio=p_ini) THEN RAISE EXCEPTION 'Ya existe un resultado activo para este KPI y periodo; corrígelo';END IF;
  SELECT c.valor,c.cumplimiento,c.semaforo INTO calc FROM public.kpi_calcular(k.unidad,k.tendencia,k.meta,_numerador,_denominador) c;
  INSERT INTO public.kpi_resultados(org_id,kpi_definicion_id,kpi_puesto_id,periodo_inicio,periodo_fin,fecha_evento,descripcion_evento,numerador,denominador,valor,cumplimiento,semaforo,meta_copia,tendencia_copia,unidad_copia,referencia_fuente,comentario,estado,capturado_por,capturado_en)
  VALUES(org,CASE WHEN _tabla='kpi_definiciones' THEN _kpi_id END,CASE WHEN _tabla='kpi_puesto' THEN _kpi_id END,p_ini,p_fin,_fecha_evento,coalesce(_descripcion_evento,''),_numerador,_denominador,calc.valor,calc.cumplimiento,calc.semaforo,k.meta,k.tendencia,k.unidad,btrim(ref),coalesce(_comentario,''),'capturado',auth.uid(),now()) RETURNING id INTO rid;
ELSE
  IF length(btrim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio de al menos 5 caracteres';END IF;
  PERFORM set_config('tracea.motivo',btrim(_motivo),true);
  SELECT c.valor,c.cumplimiento,c.semaforo INTO calc FROM public.kpi_calcular(r0.unidad_copia,r0.tendencia_copia,r0.meta_copia,_numerador,_denominador) c;
  UPDATE public.kpi_resultados SET numerador=_numerador,denominador=_denominador,valor=calc.valor,cumplimiento=calc.cumplimiento,semaforo=calc.semaforo,referencia_fuente=btrim(ref),comentario=coalesce(_comentario,''),estado='capturado',revisado_por=NULL,revisado_en=NULL WHERE id=_resultado_id AND org_id=org RETURNING id INTO rid;
END IF;
RETURN rid;END $$;
REVOKE ALL ON FUNCTION public.guardar_kpi_resultado(text,uuid,date,date,text,numeric,numeric,text,text,text,uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.guardar_kpi_resultado(text,uuid,date,date,text,numeric,numeric,text,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.capturar_kpi_resultado(_tabla text,_kpi_id uuid,_periodo_inicio date,_periodo_fin date,_fecha_evento date,_descripcion_evento text,_numerador numeric,_denominador numeric,_evidencia_path text,_comentario text,_motivo text,_resultado_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
SELECT public.guardar_kpi_resultado(_tabla,_kpi_id,_periodo_inicio,_fecha_evento,_descripcion_evento,_numerador,_denominador,_evidencia_path,_comentario,_motivo,_resultado_id) $$;
COMMENT ON FUNCTION public.capturar_kpi_resultado(text,uuid,date,date,date,text,numeric,numeric,text,text,text,uuid) IS 'DEPRECATED: replaced by guardar_kpi_resultado';

CREATE OR REPLACE FUNCTION public.revisar_kpi_resultado(_id uuid,_motivo text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); n integer;BEGIN
IF NOT (public.rol_efectivo(auth.uid(),'responsable_sanitario') OR public.rol_efectivo(auth.uid(),'aseguramiento_calidad')) OR NOT public.org_tiene_modulo(org,'indicadores') THEN RAISE EXCEPTION 'Solo RS o AC revisan resultados';END IF;
IF EXISTS(SELECT 1 FROM public.kpi_resultados r JOIN public.kpi_definiciones d ON d.id=r.kpi_definicion_id AND d.org_id=r.org_id AND d.nivel='SGC' WHERE r.id=_id AND r.org_id=org AND btrim(r.referencia_fuente)='' AND coalesce(btrim(r.evidencia_path),'')='') THEN RAISE EXCEPTION 'Resultado SGC sin referencia de la fuente';END IF;
PERFORM set_config('tracea.kpi_resultados_rpc','on',true);PERFORM set_config('tracea.motivo',nullif(btrim(coalesce(_motivo,'')),'') ,true);
UPDATE public.kpi_resultados SET estado='revisado',revisado_por=auth.uid(),revisado_en=now() WHERE id=_id AND org_id=org AND activo AND estado='capturado';
GET DIAGNOSTICS n=ROW_COUNT;IF n=0 THEN RAISE EXCEPTION 'Resultado capturado no encontrado';END IF;END $$;

CREATE OR REPLACE FUNCTION public.registrar_kpi_evidencia(_periodo_inicio date,_periodo_fin date,_nombre text,_path text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); rid uuid; es_capt boolean; BEGIN
IF org IS NULL THEN RAISE EXCEPTION 'Sin empresa activa';END IF;
SELECT EXISTS(SELECT 1 FROM public.kpi_definiciones WHERE org_id=org AND auth.uid()=ANY(capturistas)) OR EXISTS(SELECT 1 FROM public.kpi_puesto WHERE org_id=org AND auth.uid()=ANY(capturistas)) INTO es_capt;
IF NOT public.kpi_puede_capturar(org,CASE WHEN es_capt THEN ARRAY[auth.uid()] ELSE '{}'::uuid[] END) THEN RAISE EXCEPTION 'Sin permiso de captura de Indicadores';END IF;
IF _periodo_inicio IS NULL OR _periodo_fin IS NULL OR _periodo_fin<_periodo_inicio THEN RAISE EXCEPTION 'Periodo inválido';END IF;
IF coalesce(btrim(_path),'')='' OR split_part(_path,'/',1)<>org::text THEN RAISE EXCEPTION 'Ruta de archivo inválida';END IF;
PERFORM set_config('tracea.kpi_resultados_rpc','on',true);
INSERT INTO public.kpi_evidencias(org_id,periodo_inicio,periodo_fin,nombre,path) VALUES(org,_periodo_inicio,_periodo_fin,coalesce(nullif(btrim(_nombre),''),split_part(_path,'/',-1)),_path) RETURNING id INTO rid;
RETURN rid;END $$;
REVOKE ALL ON FUNCTION public.registrar_kpi_evidencia(date,date,text,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.registrar_kpi_evidencia(date,date,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ligar_kpi_evidencia(_evidencia_id uuid,_resultados uuid[]) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); n integer; BEGIN
IF NOT EXISTS(SELECT 1 FROM public.kpi_evidencias WHERE id=_evidencia_id AND org_id=org AND activo) THEN RAISE EXCEPTION 'Evidencia no encontrada';END IF;
IF coalesce(cardinality(_resultados),0)=0 THEN RAISE EXCEPTION 'Selecciona al menos un resultado';END IF;
IF EXISTS(SELECT 1 FROM unnest(_resultados) x(id) LEFT JOIN public.kpi_resultados r ON r.id=x.id AND r.org_id=org AND r.activo LEFT JOIN public.kpi_definiciones d ON d.id=r.kpi_definicion_id AND d.org_id=org LEFT JOIN public.kpi_puesto p ON p.id=r.kpi_puesto_id AND p.org_id=org WHERE r.id IS NULL OR NOT public.kpi_puede_capturar(org,coalesce(d.capturistas,p.capturistas))) THEN RAISE EXCEPTION 'Resultado no encontrado o sin permiso de captura';END IF;
PERFORM set_config('tracea.kpi_resultados_rpc','on',true);
INSERT INTO public.kpi_resultado_evidencia(org_id,resultado_id,evidencia_id) SELECT DISTINCT org,x.id,_evidencia_id FROM unnest(_resultados) x(id) ON CONFLICT (resultado_id,evidencia_id) DO NOTHING;
GET DIAGNOSTICS n=ROW_COUNT;RETURN n;END $$;
REVOKE ALL ON FUNCTION public.ligar_kpi_evidencia(uuid,uuid[]) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.ligar_kpi_evidencia(uuid,uuid[]) TO authenticated;

DO $k2b$ DECLARE d text;BEGIN
SELECT pg_get_functiondef('public.pendientes_usuario(text)'::regprocedure) INTO d;
d:=replace(d,'WHERE per.fin+5<=hoy AND (emp','WHERE per.fin<hoy AND (emp');
d:=replace(d,$q$'kpi_por_capturar',k.registro,k.n||' KPI por capturar del periodo '||k.etiqueta,'/indicadores?hoja=Captura'$q$,$q$'kpi_por_capturar',k.registro,k.n||' KPI por capturar del periodo '||k.etiqueta,'/indicadores?hoja=Captura&mios=1'$q$);
IF position('hoja=Captura&mios=1' in d)=0 OR position('per.fin+5' in d)>0 THEN RAISE EXCEPTION 'No se pudo ajustar pendientes';END IF;EXECUTE d;END $k2b$;