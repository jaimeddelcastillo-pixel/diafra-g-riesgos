CREATE TABLE public.tend_extracciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),registro_id uuid NOT NULL,foto_path text NOT NULL,modulo text NOT NULL CHECK(modulo IN ('temphr','presiones','filtros')),solicitado_por uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),estado text NOT NULL DEFAULT 'procesando' CHECK(estado IN ('procesando','propuesta','error','confirmada')),skills_usadas jsonb NOT NULL DEFAULT '[]',modelo_ia text,valores_propuestos jsonb,valores_confirmados jsonb,confirmado_por uuid,confirmado_en timestamptz,semana_id uuid,tokens_input bigint NOT NULL DEFAULT 0 CHECK(tokens_input>=0),tokens_output bigint NOT NULL DEFAULT 0 CHECK(tokens_output>=0),error text,FOREIGN KEY(org_id,registro_id) REFERENCES public.tend_registros(org_id,id),FOREIGN KEY(org_id,semana_id) REFERENCES public.tend_semanas(org_id,id));
GRANT SELECT,INSERT,UPDATE ON public.tend_extracciones TO authenticated;
GRANT SELECT,UPDATE ON public.tend_extracciones TO service_role;
ALTER TABLE public.tend_extracciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY tend_extracciones_select ON public.tend_extracciones FOR SELECT TO authenticated USING(public.tend_acceso(org_id));
CREATE POLICY tend_extracciones_insert ON public.tend_extracciones FOR INSERT TO authenticated WITH CHECK(public.tend_acceso(org_id,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']));
CREATE POLICY tend_extracciones_update ON public.tend_extracciones FOR UPDATE TO authenticated USING(public.tend_acceso(org_id,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario'])) WITH CHECK(public.tend_acceso(org_id,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']));
CREATE INDEX tend_extracciones_org_fecha ON public.tend_extracciones(org_id,created_at);
CREATE FUNCTION public.tend_extracciones_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE lim jsonb; usados bigint; BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Extracciones inmutables: nunca borrar'; END IF;
 IF TG_OP='INSERT' THEN
 IF NOT public.tend_acceso(NEW.org_id,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']) THEN RAISE EXCEPTION 'Sin permiso de extracción'; END IF;
 IF split_part(NEW.foto_path,'/',1)<>NEW.org_id::text OR position('..' in NEW.foto_path)>0 OR NOT EXISTS(SELECT 1 FROM public.tend_registros r WHERE r.org_id=NEW.org_id AND r.id=NEW.registro_id AND r.modulo=NEW.modulo AND r.activo) THEN RAISE EXCEPTION 'Origen de extracción inválido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.org_id::text,716));
 lim:=public.plan_limite(NEW.org_id,'extraccion_bitacora_max');
 SELECT count(*) INTO usados FROM public.tend_extracciones WHERE org_id=NEW.org_id;
 IF lim IS NOT NULL AND lim<>'null'::jsonb THEN
 IF jsonb_typeof(lim)<>'number' OR (lim#>>'{}')::numeric<0 THEN RAISE EXCEPTION 'Límite de extracción inválido'; END IF;
 IF usados >= (lim#>>'{}')::numeric THEN RAISE EXCEPTION 'Límite de extracciones del plan alcanzado'; END IF; END IF;
 NEW.solicitado_por:=auth.uid(); NEW.created_at:=now(); NEW.estado:='procesando'; NEW.skills_usadas:='[]'; NEW.modelo_ia:=NULL; NEW.valores_propuestos:=NULL; NEW.valores_confirmados:=NULL; NEW.confirmado_por:=NULL; NEW.confirmado_en:=NULL; NEW.semana_id:=NULL; NEW.tokens_input:=0; NEW.tokens_output:=0; NEW.error:=NULL;
 ELSE
 IF OLD.estado='procesando' AND auth.role()='service_role' AND auth.uid() IS NULL AND current_setting('tracea.extraccion_sistema',true)='resultado' THEN
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=OLD.solicitado_por AND role='super_admin') THEN RAISE EXCEPTION 'Super admin nunca extrae'; END IF;
 IF (to_jsonb(NEW)-ARRAY['estado','skills_usadas','modelo_ia','valores_propuestos','tokens_input','tokens_output','error']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['estado','skills_usadas','modelo_ia','valores_propuestos','tokens_input','tokens_output','error']) OR NEW.estado NOT IN ('propuesta','error') THEN RAISE EXCEPTION 'Resultado de extracción inválido'; END IF;
 ELSE
 IF NOT public.tend_acceso(NEW.org_id,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']) OR current_setting('tracea.extraccion_confirmar',true) IS DISTINCT FROM 'humano' OR OLD.estado<>'propuesta' OR NEW.estado<>'confirmada' THEN RAISE EXCEPTION 'Confirmación humana requerida'; END IF;
 IF (to_jsonb(NEW)-ARRAY['estado','valores_confirmados','confirmado_por','confirmado_en','semana_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['estado','valores_confirmados','confirmado_por','confirmado_en','semana_id']) THEN RAISE EXCEPTION 'Propuesta original inmutable'; END IF;
 NEW.confirmado_por:=auth.uid(); NEW.confirmado_en:=now(); END IF; END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.tend_extracciones_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tend_extracciones_guard BEFORE INSERT OR UPDATE OR DELETE ON public.tend_extracciones FOR EACH ROW EXECUTE FUNCTION public.tend_extracciones_guard();
CREATE TRIGGER tend_extracciones_no_truncate BEFORE TRUNCATE ON public.tend_extracciones FOR EACH STATEMENT EXECUTE FUNCTION public.tend_extracciones_guard();
CREATE TRIGGER tend_extracciones_audit AFTER INSERT OR UPDATE ON public.tend_extracciones FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE FUNCTION public.tend_extraccion_resultado(_id uuid,_propuesta jsonb,_skills jsonb,_modelo text,_input bigint DEFAULT 0,_output bigint DEFAULT 0,_error text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Resultado de extracción reservado al sistema'; END IF;
 IF _error IS NULL AND (jsonb_typeof(_propuesta) IS DISTINCT FROM 'object' OR jsonb_typeof(_skills) IS DISTINCT FROM 'array' OR jsonb_array_length(_skills)=0 OR coalesce(btrim(_modelo),'')='') THEN RAISE EXCEPTION 'Propuesta requiere skill y modelo'; END IF;
 PERFORM set_config('tracea.extraccion_sistema','resultado',true);
 UPDATE public.tend_extracciones SET estado=CASE WHEN _error IS NULL THEN 'propuesta' ELSE 'error' END,valores_propuestos=_propuesta,skills_usadas=coalesce(_skills,'[]'),modelo_ia=_modelo,tokens_input=_input,tokens_output=_output,error=left(_error,2000) WHERE id=_id AND estado='procesando';
 IF NOT FOUND THEN RAISE EXCEPTION 'Extracción inexistente o ya finalizada'; END IF;
 PERFORM set_config('tracea.extraccion_sistema','',true); END $$;
REVOKE ALL ON FUNCTION public.tend_extraccion_resultado(uuid,jsonb,jsonb,text,bigint,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tend_extraccion_resultado(uuid,jsonb,jsonb,text,bigint,bigint,text) TO service_role;
COMMENT ON TABLE public.tend_extracciones IS 'Each reserved extraction counts toward lifetime per-org extraccion_bitacora_max in plan_limites; NULL unlimited. AI proposes; human confirms.';