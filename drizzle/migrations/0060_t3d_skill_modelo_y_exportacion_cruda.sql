ALTER TABLE public.ia_skills ADD COLUMN modelo_ia text;
UPDATE public.ia_skills SET modelo_ia='google/gemini-3.8-flash' WHERE clave IN ('extraccion_bitacora_temphr','extraccion_bitacora_presiones','extraccion_bitacora_filtros');
CREATE FUNCTION public.ia_skill_modelo_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.modelo_ia IS DISTINCT FROM OLD.modelo_ia THEN
  IF NOT public.is_super_admin() OR current_setting('tracea.skill_modelo_motivo',true) IS NULL OR btrim(current_setting('tracea.skill_modelo_motivo',true))='' THEN RAISE EXCEPTION 'Cambio de modelo requiere super_admin y motivo'; END IF;
  IF NEW.ambito<>'tarea' OR coalesce(NEW.modelo_ia,'') !~ '^[a-z0-9_-]+/[a-zA-Z0-9._-]+$' THEN RAISE EXCEPTION 'Modelo de tarea inválido'; END IF;
  INSERT INTO public.audit_trail(user_id,tabla,registro_id,accion,valor_anterior,valor_nuevo) VALUES(auth.uid(),'ia_skills',NEW.clave,'SKILL_MODELO_CAMBIADO',jsonb_build_object('modelo_ia',OLD.modelo_ia),jsonb_build_object('modelo_ia',NEW.modelo_ia,'motivo',current_setting('tracea.skill_modelo_motivo',true)));
 END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.ia_skill_modelo_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ia_skill_modelo_guard BEFORE UPDATE ON public.ia_skills FOR EACH ROW EXECUTE FUNCTION public.ia_skill_modelo_guard();
CREATE FUNCTION public.configurar_modelo_skill(_clave text,_modelo text,_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Solo super_admin'; END IF;
 IF coalesce(btrim(_motivo),'')='' THEN RAISE EXCEPTION 'Motivo obligatorio'; END IF;
 PERFORM set_config('tracea.skill_modelo_motivo',btrim(_motivo),true);
 UPDATE public.ia_skills SET modelo_ia=btrim(_modelo) WHERE clave=_clave AND ambito='tarea';
 IF NOT FOUND THEN RAISE EXCEPTION 'Skill de tarea no disponible'; END IF;
 PERFORM set_config('tracea.skill_modelo_motivo','',true);
END $$;
REVOKE ALL ON FUNCTION public.configurar_modelo_skill(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.configurar_modelo_skill(text,text,text) TO authenticated;
CREATE FUNCTION public.tend_exportar_crudo(_registro uuid,_desde date,_hasta date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid; semanas jsonb; correcciones jsonb; BEGIN
 org:=public.get_user_org_id();
 IF NOT public.tend_acceso(org) OR NOT EXISTS(SELECT 1 FROM public.tend_registros WHERE id=_registro AND org_id=org) THEN RAISE EXCEPTION 'Registro no disponible'; END IF;
 IF _desde IS NULL OR _hasta IS NULL OR _desde>_hasta THEN RAISE EXCEPTION 'Periodo inválido'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'semana_inicio',s.semana_inicio,'lecturas',s.lecturas,'lecturas_hr',s.lecturas_hr,'source',s.source,'activo',s.activo) ORDER BY s.semana_inicio),'[]') INTO semanas FROM public.tend_semanas s WHERE s.org_id=org AND s.registro_id=_registro AND s.semana_inicio<=_hasta AND s.semana_inicio+6>=_desde;
 SELECT coalesce(jsonb_agg(jsonb_build_object('semana_id',a.registro_id,'fecha',a.created_at,'accion',a.accion,'motivo',coalesce(a.valor_nuevo->>'motivo',a.valor_nuevo->>'retirado_motivo'),'anterior',jsonb_build_object('semana_inicio',a.valor_anterior->>'semana_inicio','lecturas',a.valor_anterior->'lecturas','lecturas_hr',a.valor_anterior->'lecturas_hr','source',a.valor_anterior->>'source'),'nuevo',jsonb_build_object('semana_inicio',coalesce(a.valor_nuevo->'semana'->>'semana_inicio',a.valor_nuevo->>'semana_inicio'),'lecturas',coalesce(a.valor_nuevo->'semana'->'lecturas',a.valor_nuevo->'lecturas'),'lecturas_hr',coalesce(a.valor_nuevo->'semana'->'lecturas_hr',a.valor_nuevo->'lecturas_hr'),'source',coalesce(a.valor_nuevo->'semana'->>'source',a.valor_nuevo->>'source'))) ORDER BY a.created_at),'[]') INTO correcciones FROM public.audit_trail a JOIN public.tend_semanas s ON s.id::text=a.registro_id AND s.org_id=a.org_id WHERE a.org_id=org AND s.registro_id=_registro AND a.tabla='tend_semanas' AND (a.valor_anterior IS NOT NULL) AND (s.semana_inicio<=_hasta AND s.semana_inicio+6>=_desde OR coalesce(a.valor_anterior->>'semana_inicio','') BETWEEN (_desde-6)::text AND _hasta::text);
 RETURN jsonb_build_object('semanas',semanas,'correcciones',correcciones);
END $$;
REVOKE ALL ON FUNCTION public.tend_exportar_crudo(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tend_exportar_crudo(uuid,date,date) TO authenticated;