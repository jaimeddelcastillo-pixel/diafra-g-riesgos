CREATE FUNCTION public.tend_semana_en_emitido(_org uuid,_semana uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.tend_registros_at a WHERE a.org_id=_org AND a.estado='emitido' AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(a.datos_snapshot->'registros','[]')) r CROSS JOIN LATERAL jsonb_array_elements(coalesce(r->'semanas','[]')) s WHERE s->>'id'=_semana::text)) $$;
REVOKE ALL ON FUNCTION public.tend_semana_en_emitido(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.tend_semana_integridad() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE tiene boolean; motivo text; cambio boolean; BEGIN
 IF NOT public.tend_acceso(NEW.org_id,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']) THEN RAISE EXCEPTION 'Sin permiso de escritura en Tendencias'; END IF;
 IF coalesce(NEW.foto_path,'')<>'' AND (split_part(NEW.foto_path,'/',1)<>public.get_user_org_id()::text OR position('..' in NEW.foto_path)>0) THEN RAISE EXCEPTION 'Foto fuera de empresa'; END IF;
 NEW.source:=CASE WHEN current_setting('tracea.extraccion_confirmar',true)='humano' THEN 'ia' ELSE 'manual' END;
 NEW.mes:=(ARRAY['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from NEW.semana_inicio)::int]; NEW.anio:=extract(year from NEW.semana_inicio)::text;
 IF TG_OP='UPDATE' THEN
 cambio:=(to_jsonb(NEW)-ARRAY['updated_at','updated_by','saved_at','mes','anio']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','updated_by','saved_at','mes','anio']);
 IF public.tend_semana_en_emitido(OLD.org_id,OLD.id) AND cambio THEN RAISE EXCEPTION 'Semana incluida en AT emitido: cambio rechazado'; END IF;
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(OLD.lecturas||coalesce(OLD.lecturas_hr,'[]')) v WHERE v->'valor' IS NOT NULL AND v->'valor'<>'null'::jsonb) INTO tiene;
 motivo:=current_setting('tracea.semana_motivo',true);
 IF cambio AND tiene THEN
 IF coalesce(btrim(motivo),'')='' THEN RAISE EXCEPTION 'Semana con lecturas previas requiere motivo'; END IF;
 INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_anterior,valor_nuevo) VALUES(auth.uid(),NEW.org_id,'tend_semanas',NEW.id::text,'SEMANA_CORREGIDA',to_jsonb(OLD),jsonb_build_object('motivo',btrim(motivo),'semana',to_jsonb(NEW)));
 END IF; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.tend_semana_integridad() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_tend_semana_integridad BEFORE INSERT OR UPDATE ON public.tend_semanas FOR EACH ROW EXECUTE FUNCTION public.tend_semana_integridad();
CREATE FUNCTION public.tend_guardar_semana(_registro uuid,_semana jsonb,_motivo text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid; sid uuid; inicio date; v jsonb; BEGIN
 org:=public.get_user_org_id();
 IF NOT public.tend_acceso(org,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']) OR NOT EXISTS(SELECT 1 FROM public.tend_registros WHERE org_id=org AND id=_registro AND activo) THEN RAISE EXCEPTION 'Registro no disponible'; END IF;
 IF jsonb_typeof(_semana) IS DISTINCT FROM 'object' OR jsonb_typeof(_semana->'lecturas') IS DISTINCT FROM 'array' OR coalesce(_semana->>'semana_inicio','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Semana o lecturas inválidas'; END IF;
 IF coalesce(_semana->>'foto_path','')<>'' AND (split_part(_semana->>'foto_path','/',1)<>org::text OR position('..' in (_semana->>'foto_path'))>0) THEN RAISE EXCEPTION 'Foto fuera de empresa'; END IF;
 inicio:=(_semana->>'semana_inicio')::date;
 IF extract(isodow from inicio)<>1 THEN RAISE EXCEPTION 'Semana requiere lunes'; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements((_semana->'lecturas')||CASE WHEN jsonb_typeof(_semana->'lecturas_hr')='array' THEN _semana->'lecturas_hr' ELSE '[]' END) LOOP
 IF coalesce(v->>'dia','') NOT IN ('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo') OR coalesce(v->>'turno','') NOT IN ('Mañana','Media tarde','Tarde') OR v->'valor' IS NULL OR (v->'valor'<>'null'::jsonb AND jsonb_typeof(v->'valor') IS DISTINCT FROM 'number') THEN RAISE EXCEPTION 'Lectura inválida'; END IF; END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text||_registro::text||inicio::text,717));
 PERFORM set_config('tracea.semana_motivo',coalesce(_motivo,''),true);
 INSERT INTO public.tend_semanas(org_id,registro_id,semana_inicio,mes,anio,unidad,lecturas,lecturas_hr,observaciones,source,foto_path,saved_at,objetivo_presion_id)
 VALUES(org,_registro,inicio,'','',coalesce(_semana->>'unidad',''),_semana->'lecturas',CASE WHEN jsonb_typeof(_semana->'lecturas_hr')='array' THEN _semana->'lecturas_hr' END,coalesce(_semana->>'observaciones',''),'manual',_semana->>'foto_path',now(),nullif(_semana->>'objetivo_presion_id','')::uuid)
 ON CONFLICT(org_id,registro_id,semana_inicio) DO UPDATE SET lecturas=excluded.lecturas,lecturas_hr=excluded.lecturas_hr,observaciones=excluded.observaciones,source=excluded.source,foto_path=excluded.foto_path,saved_at=excluded.saved_at,objetivo_presion_id=excluded.objetivo_presion_id RETURNING id INTO sid;
 PERFORM set_config('tracea.semana_motivo','',true); RETURN sid; END $$;
REVOKE ALL ON FUNCTION public.tend_guardar_semana(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tend_guardar_semana(uuid,jsonb,text) TO authenticated;
CREATE FUNCTION public.tend_confirmar_extraccion(_id uuid,_semana jsonb,_motivo text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE x public.tend_extracciones; sid uuid; previa public.tend_semanas; inicio date; tiene boolean; BEGIN
 SELECT * INTO x FROM public.tend_extracciones WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR NOT public.tend_acceso(x.org_id,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']) OR x.estado<>'propuesta' THEN RAISE EXCEPTION 'Extracción no disponible para confirmar'; END IF;
 IF coalesce(_semana->>'semana_inicio','') !~ '^\d{4}-\d{2}-\d{2}$' OR jsonb_typeof(_semana->'lecturas') IS DISTINCT FROM 'array' OR jsonb_array_length(_semana->'lecturas')<>21 THEN RAISE EXCEPTION 'Semana requiere 21 lecturas'; END IF;
 IF x.modulo='temphr' AND (jsonb_typeof(_semana->'lecturas_hr') IS DISTINCT FROM 'array' OR jsonb_array_length(_semana->'lecturas_hr')<>21) THEN RAISE EXCEPTION 'Confirmar ambas variables'; END IF;
 IF (SELECT count(DISTINCT concat(v->>'dia','/',v->>'turno')) FROM jsonb_array_elements(_semana->'lecturas') v)<>21 THEN RAISE EXCEPTION 'Lecturas duplicadas'; END IF;
 inicio:=(_semana->>'semana_inicio')::date;
 PERFORM pg_advisory_xact_lock(hashtextextended(x.org_id::text||x.registro_id::text||inicio::text,717));
 SELECT * INTO previa FROM public.tend_semanas WHERE org_id=x.org_id AND registro_id=x.registro_id AND semana_inicio=inicio FOR UPDATE;
 IF FOUND THEN
 IF public.tend_semana_en_emitido(x.org_id,previa.id) THEN RAISE EXCEPTION 'Semana incluida en AT emitido: cambio rechazado'; END IF;
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(previa.lecturas||coalesce(previa.lecturas_hr,'[]')) v WHERE v->'valor' IS NOT NULL AND v->'valor'<>'null'::jsonb) INTO tiene;
 IF tiene AND coalesce(btrim(_motivo),'')='' THEN RAISE EXCEPTION 'Semana con lecturas previas requiere motivo'; END IF; END IF;
 PERFORM set_config('tracea.extraccion_confirmar','humano',true);
 sid:=public.tend_guardar_semana(x.registro_id,_semana||jsonb_build_object('foto_path',x.foto_path),_motivo);
 UPDATE public.tend_extracciones SET estado='confirmada',valores_confirmados=_semana||jsonb_build_object('mes',(ARRAY['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from inicio)::int],'anio',extract(year from inicio)::text,'source','ia','foto_path',x.foto_path),confirmado_por=auth.uid(),confirmado_en=now(),semana_id=sid WHERE id=x.id;
 PERFORM set_config('tracea.extraccion_confirmar','',true); RETURN sid; END $$;
REVOKE ALL ON FUNCTION public.tend_confirmar_extraccion(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tend_confirmar_extraccion(uuid,jsonb,text) TO authenticated;