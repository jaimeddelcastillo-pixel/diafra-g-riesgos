ALTER TABLE public.tend_semanas ADD COLUMN activo boolean NOT NULL DEFAULT true, ADD COLUMN retirado_motivo text, ADD COLUMN retirado_en timestamptz, ADD COLUMN retirado_por uuid;
ALTER TABLE public.tend_registros ADD COLUMN retirado_motivo text, ADD COLUMN retirado_en timestamptz, ADD COLUMN retirado_por uuid;
ALTER TABLE public.tend_cambios_filtro ADD COLUMN activo boolean NOT NULL DEFAULT true, ADD COLUMN retirado_motivo text, ADD COLUMN retirado_en timestamptz, ADD COLUMN retirado_por uuid;
CREATE FUNCTION public.tend_retiro_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE motivo text; previo jsonb; nuevo jsonb; BEGIN
 IF NOT public.tend_acceso(NEW.org_id,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']) THEN RAISE EXCEPTION 'Sin permiso de escritura en Tendencias'; END IF;
 IF TG_OP='INSERT' THEN
  IF NOT NEW.activo OR NEW.retirado_motivo IS NOT NULL OR NEW.retirado_en IS NOT NULL OR NEW.retirado_por IS NOT NULL THEN RAISE EXCEPTION 'Retiro reservado a la operación motivada'; END IF;
 ELSE
  previo:=to_jsonb(OLD); nuevo:=to_jsonb(NEW);
  IF NOT OLD.activo AND nuevo IS DISTINCT FROM previo THEN RAISE EXCEPTION 'Registro retirado: solo consulta del historial'; END IF;
  IF NEW.activo IS DISTINCT FROM OLD.activo OR (nuevo->'retirado_motivo') IS DISTINCT FROM (previo->'retirado_motivo') OR (nuevo->'retirado_en') IS DISTINCT FROM (previo->'retirado_en') OR (nuevo->'retirado_por') IS DISTINCT FROM (previo->'retirado_por') THEN
   motivo:=current_setting('tracea.retiro_motivo',true);
   IF NEW.activo OR coalesce(btrim(motivo),'')='' THEN RAISE EXCEPTION 'Retirar requiere motivo'; END IF;
   IF EXISTS(SELECT 1 FROM public.tend_registros_at a WHERE a.org_id=NEW.org_id AND a.estado='emitido' AND (
    (TG_TABLE_NAME='tend_registros' AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(a.datos_snapshot->'registros','[]')) r WHERE r->>'id'=NEW.id::text)) OR
    (TG_TABLE_NAME='tend_cambios_filtro' AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(a.datos_snapshot->'cambios','[]')) c WHERE c->>'id'=NEW.id::text)) OR
    (TG_TABLE_NAME='tend_semanas' AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(a.datos_snapshot->'registros','[]')) r CROSS JOIN LATERAL jsonb_array_elements(coalesce(r->'semanas','[]')) s WHERE s->>'id'=NEW.id::text)))) THEN RAISE EXCEPTION 'Incluido en AT emitido: retiro rechazado'; END IF;
   NEW.retirado_motivo:=btrim(motivo); NEW.retirado_en:=now(); NEW.retirado_por:=auth.uid();
   INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_anterior,valor_nuevo) VALUES(auth.uid(),NEW.org_id,TG_TABLE_NAME,NEW.id::text,'REGISTRO_RETIRADO',previo,to_jsonb(NEW));
  END IF;
 END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.tend_retiro_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER aa_tend_retiro_guard BEFORE INSERT OR UPDATE ON public.tend_semanas FOR EACH ROW EXECUTE FUNCTION public.tend_retiro_guard();
CREATE TRIGGER aa_tend_retiro_guard BEFORE INSERT OR UPDATE ON public.tend_registros FOR EACH ROW EXECUTE FUNCTION public.tend_retiro_guard();
CREATE TRIGGER aa_tend_retiro_guard BEFORE INSERT OR UPDATE ON public.tend_cambios_filtro FOR EACH ROW EXECUTE FUNCTION public.tend_retiro_guard();
CREATE FUNCTION public.tend_retirar(_tipo text,_id uuid,_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid; tabla text; fila record; BEGIN
 org:=public.get_user_org_id();
 IF NOT public.tend_acceso(org,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']) THEN RAISE EXCEPTION 'Sin permiso de escritura en Tendencias'; END IF;
 IF coalesce(btrim(_motivo),'')='' THEN RAISE EXCEPTION 'Retirar requiere motivo'; END IF;
 tabla:=CASE _tipo WHEN 'registro' THEN 'tend_registros' WHEN 'semana' THEN 'tend_semanas' WHEN 'cambio_filtro' THEN 'tend_cambios_filtro' END;
 IF tabla IS NULL THEN RAISE EXCEPTION 'Tipo de retiro inválido'; END IF;
 EXECUTE format('SELECT id,activo FROM public.%I WHERE org_id=$1 AND id=$2 FOR UPDATE',tabla) INTO fila USING org,_id;
 IF fila.id IS NULL OR NOT fila.activo THEN RAISE EXCEPTION 'Registro no disponible para retirar'; END IF;
 PERFORM set_config('tracea.retiro_motivo',btrim(_motivo),true); PERFORM set_config('tracea.semana_motivo',btrim(_motivo),true);
 EXECUTE format('UPDATE public.%I SET activo=false WHERE org_id=$1 AND id=$2',tabla) USING org,_id;
 PERFORM set_config('tracea.retiro_motivo','',true); PERFORM set_config('tracea.semana_motivo','',true);
END $$;
REVOKE ALL ON FUNCTION public.tend_retirar(text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tend_retirar(text,uuid,text) TO authenticated;
CREATE FUNCTION public.tend_corregir_fecha_semana(_id uuid,_inicio date,_motivo text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid; s public.tend_semanas; BEGIN
 org:=public.get_user_org_id();
 IF NOT public.tend_acceso(org,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']) THEN RAISE EXCEPTION 'Sin permiso de escritura en Tendencias'; END IF;
 SELECT * INTO s FROM public.tend_semanas WHERE org_id=org AND id=_id AND activo FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.tend_registros WHERE org_id=org AND id=s.registro_id AND activo) THEN RAISE EXCEPTION 'Semana no disponible'; END IF;
 IF _inicio IS NULL OR extract(isodow from _inicio)<>1 THEN RAISE EXCEPTION 'Semana requiere lunes'; END IF;
 IF _inicio=s.semana_inicio THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text||s.registro_id::text||_inicio::text,717));
 IF EXISTS(SELECT 1 FROM public.tend_semanas WHERE org_id=org AND registro_id=s.registro_id AND semana_inicio=_inicio AND id<>_id) THEN RAISE EXCEPTION 'Ya existe una semana en esa fecha (incluido el historial retirado)'; END IF;
 PERFORM set_config('tracea.semana_motivo',coalesce(_motivo,''),true);
 UPDATE public.tend_semanas SET semana_inicio=_inicio WHERE org_id=org AND id=_id;
 PERFORM set_config('tracea.semana_motivo','',true);
END $$;
REVOKE ALL ON FUNCTION public.tend_corregir_fecha_semana(uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tend_corregir_fecha_semana(uuid,date,text) TO authenticated;
CREATE FUNCTION public.tend_objetivo_semana_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.objetivo_presion_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tend_objetivos_presion WHERE org_id=NEW.org_id AND id=NEW.objetivo_presion_id AND activo) THEN RAISE EXCEPTION 'Objetivo de presión fuera de la empresa o inactivo'; END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.tend_objetivo_semana_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_tend_objetivo_semana_guard BEFORE INSERT OR UPDATE ON public.tend_semanas FOR EACH ROW EXECUTE FUNCTION public.tend_objetivo_semana_guard();
DO $$ DECLARE original text; cambiado text; BEGIN
 SELECT pg_get_functiondef('public.tend_at_snapshots()'::regprocedure) INTO original;
 cambiado:=replace(original,'s.org_id=NEW.org_id AND s.registro_id=r.id AND s.semana_inicio','s.org_id=NEW.org_id AND s.activo AND s.registro_id=r.id AND s.semana_inicio');
 cambiado:=replace(cambiado,'c.org_id=NEW.org_id AND c.instrumento_id=ANY(ids)','c.org_id=NEW.org_id AND c.activo AND c.instrumento_id=ANY(ids)');
 IF cambiado=original OR position('s.activo AND s.registro_id=r.id' in cambiado)=0 OR position('c.activo AND c.instrumento_id=ANY(ids)' in cambiado)=0 THEN RAISE EXCEPTION 'No se aplicó filtro de retiros en snapshots'; END IF;
 EXECUTE cambiado;
 SELECT pg_get_functiondef('public.tend_guardar_semana(uuid,jsonb,text)'::regprocedure) INTO original;
 cambiado:=replace(original,'PERFORM set_config(''tracea.semana_motivo'',coalesce(_motivo,''''),true);','IF EXISTS(SELECT 1 FROM public.tend_semanas WHERE org_id=org AND registro_id=_registro AND semana_inicio=inicio AND NOT activo) THEN RAISE EXCEPTION ''Semana retirada: solo consulta del historial''; END IF; PERFORM set_config(''tracea.semana_motivo'',coalesce(_motivo,''''),true);');
 IF cambiado=original THEN RAISE EXCEPTION 'No se aplicó guard de semana retirada'; END IF;
 EXECUTE cambiado;
END $$;