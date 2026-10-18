ALTER TABLE public.tend_registros_at ADD COLUMN elaborado_nombre text, ADD COLUMN elaborado_cargo text, ADD COLUMN anulado_nombre text, ADD COLUMN anulado_cargo text, ADD COLUMN anulado_email text, ADD COLUMN rs_sustituido_nombre text, ADD COLUMN formato_snapshot jsonb, ADD COLUMN datos_snapshot jsonb;
ALTER TABLE public.org_suplencias ADD COLUMN rs_titular_user_id uuid, ADD COLUMN rs_titular_nombre text, ADD COLUMN rs_titular_cargo text;
DO $ddl$ DECLARE d text; original text; BEGIN
 SELECT pg_get_functiondef('public.tend_at_guard()'::regprocedure) INTO original;
 d:=replace(original,'ELSIF NEW.estado IN (''emitido'',''anulado'') THEN', 'ELSIF NEW.estado=''anulado'' AND OLD.estado=''borrador'' THEN
 su:=public.tend_suplencia(NEW.org_id,''anular'');
 IF auth.uid() IS DISTINCT FROM OLD.elaborado_version_por AND NOT public.tend_acceso(NEW.org_id,true,ARRAY[''admin'',''responsable_sanitario'']) AND su IS NULL THEN RAISE EXCEPTION ''Solo autor, admin, RS o suplente vigente anula borrador''; END IF;
 IF coalesce(btrim(NEW.motivo_anulacion),'''')='''' THEN RAISE EXCEPTION ''Anulación requiere motivo''; END IF;
 NEW.anulado_en:=now(); NEW.anulado_por:=auth.uid(); NEW.anulacion_en_suplencia:=su IS NOT NULL; NEW.anulacion_suplencia_id:=su;
 IF su IS NOT NULL THEN INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_nuevo) VALUES(auth.uid(),NEW.org_id,''org_suplencias'',su::text,''SUPLENCIA_USADA'',jsonb_build_object(''registro_at_id'',NEW.id,''facultad'',''anular'')); END IF;
 ELSIF NEW.estado IN (''emitido'',''anulado'') THEN');
 IF d=original OR position('Solo autor, admin, RS o suplente vigente anula borrador' in d)=0 THEN RAISE EXCEPTION 'No se modificó tend_at_guard'; END IF;
 EXECUTE d;
 SELECT pg_get_functiondef('public.org_suplencias_guard()'::regprocedure) INTO original;
 d:=replace(original,'IF NOT public.org_suplencias_acceso(NEW.org_id,true) THEN', 'IF TG_OP=''UPDATE'' AND auth.uid() IS NULL AND auth.role()=''service_role'' AND current_setting(''tracea.aviso_sistema'',true)=''resultado'' THEN
 IF (to_jsonb(NEW)-ARRAY[''aviso_rs_enviado_en'',''aviso_rs_error'',''updated_at'',''updated_by'']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY[''aviso_rs_enviado_en'',''aviso_rs_error'',''updated_at'',''updated_by'']) THEN RAISE EXCEPTION ''Sistema solo registra resultado de aviso''; END IF;
 NEW.updated_at:=now(); NEW.updated_by:=NULL; RETURN NEW;
 END IF;
 IF NOT public.org_suplencias_acceso(NEW.org_id,true) THEN');
 IF d=original OR position('Sistema solo registra resultado de aviso' in d)=0 THEN RAISE EXCEPTION 'No se modificó org_suplencias_guard'; END IF;
 EXECUTE d;
END $ddl$;
CREATE FUNCTION public.tend_snapshot_input_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' THEN
 IF NEW.formato_snapshot IS NOT NULL OR NEW.datos_snapshot IS NOT NULL THEN RAISE EXCEPTION 'Snapshots reservados al servidor'; END IF;
 ELSE
 IF NEW.formato_snapshot IS DISTINCT FROM OLD.formato_snapshot OR NEW.datos_snapshot IS DISTINCT FROM OLD.datos_snapshot THEN RAISE EXCEPTION 'Snapshots reservados al servidor'; END IF;
 END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.tend_snapshot_input_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_tend_at_snapshot_proteger BEFORE INSERT OR UPDATE ON public.tend_registros_at FOR EACH ROW EXECUTE FUNCTION public.tend_snapshot_input_guard();
CREATE FUNCTION public.tend_at_snapshots() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p record; ids uuid[]; BEGIN
 SELECT nombre,cargo,email INTO p FROM public.profiles WHERE id=auth.uid() AND activo;
 IF TG_OP='INSERT' THEN
 NEW.elaborado_nombre:=p.nombre; NEW.elaborado_cargo:=p.cargo; NEW.anulado_nombre:=NULL; NEW.anulado_cargo:=NULL; NEW.anulado_email:=NULL; NEW.rs_sustituido_nombre:=NULL;
 ELSE
 NEW.elaborado_nombre:=OLD.elaborado_nombre; NEW.elaborado_cargo:=OLD.elaborado_cargo; NEW.anulado_nombre:=OLD.anulado_nombre; NEW.anulado_cargo:=OLD.anulado_cargo; NEW.anulado_email:=OLD.anulado_email; NEW.rs_sustituido_nombre:=OLD.rs_sustituido_nombre;
 IF OLD.estado='emitido' AND NEW.estado='borrador' THEN NEW.elaborado_nombre:=p.nombre; NEW.elaborado_cargo:=p.cargo; NEW.formato_snapshot:=NULL; NEW.datos_snapshot:=NULL; NEW.rs_sustituido_nombre:=NULL; END IF;
 IF NEW.estado='anulado' AND OLD.estado<>'anulado' THEN NEW.anulado_nombre:=p.nombre; NEW.anulado_cargo:=p.cargo; NEW.anulado_email:=p.email; END IF;
 IF NEW.estado='emitido' AND OLD.estado='borrador' THEN
 SELECT to_jsonb(f) INTO NEW.formato_snapshot FROM public.tend_formato f WHERE f.org_id=NEW.org_id ORDER BY f.version DESC LIMIT 1;
 IF NEW.formato_snapshot IS NULL THEN RAISE EXCEPTION 'Configura el formato antes de emitir'; END IF;
 SELECT array_agg(coalesce(k->>'instrumento_id',k->>'id',CASE WHEN jsonb_typeof(k)='string' THEN k#>>'{}' END)::uuid) INTO ids FROM jsonb_array_elements(NEW.instrumentos) k;
 NEW.datos_snapshot:=jsonb_build_object(
 'registros',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('semanas',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.semana_inicio,s.id) FROM public.tend_semanas s WHERE s.org_id=NEW.org_id AND s.registro_id=r.id AND s.semana_inicio<=NEW.periodo_hasta AND s.semana_inicio+6>=NEW.periodo_desde),'[]'::jsonb))) FROM public.tend_registros r WHERE r.org_id=NEW.org_id AND r.instrumento_id=ANY(ids) AND r.activo),'[]'::jsonb),
 'instrumentos',coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM public.tend_instrumentos i WHERE i.org_id=NEW.org_id AND i.id=ANY(ids)),'[]'::jsonb),
 'areas',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM public.tend_areas a WHERE a.org_id=NEW.org_id),'[]'::jsonb),
 'hvac',coalesce((SELECT jsonb_agg(to_jsonb(h)) FROM public.tend_sistemas_hvac h WHERE h.org_id=NEW.org_id),'[]'::jsonb),
 'cambios',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.tend_cambios_filtro c WHERE c.org_id=NEW.org_id AND c.instrumento_id=ANY(ids)),'[]'::jsonb));
 IF NEW.en_suplencia THEN SELECT rs_titular_nombre INTO NEW.rs_sustituido_nombre FROM public.org_suplencias WHERE org_id=NEW.org_id AND id=NEW.suplencia_id; END IF;
 END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tend_at_snapshots() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER z_tend_at_snapshots BEFORE INSERT OR UPDATE ON public.tend_registros_at FOR EACH ROW EXECUTE FUNCTION public.tend_at_snapshots();
CREATE FUNCTION public.org_suplencia_titular_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' THEN
 SELECT p.id,p.nombre,p.cargo INTO NEW.rs_titular_user_id,NEW.rs_titular_nombre,NEW.rs_titular_cargo FROM public.org_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.org_id=NEW.org_id AND m.role='responsable_sanitario' AND p.activo ORDER BY m.created_at,m.id LIMIT 1;
 IF NEW.rs_titular_user_id IS NULL THEN RAISE EXCEPTION 'Empresa sin Responsable Sanitario titular activo'; END IF;
 ELSE NEW.rs_titular_user_id:=OLD.rs_titular_user_id; NEW.rs_titular_nombre:=OLD.rs_titular_nombre; NEW.rs_titular_cargo:=OLD.rs_titular_cargo; END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.org_suplencia_titular_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER z_suplencia_titular_snapshot BEFORE INSERT OR UPDATE ON public.org_suplencias FOR EACH ROW EXECUTE FUNCTION public.org_suplencia_titular_snapshot();
CREATE FUNCTION public.org_suplencia_aviso_resultado(_id uuid,_enviado boolean,_error text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Resultado de correo reservado al sistema'; END IF;
 PERFORM set_config('tracea.aviso_sistema','resultado',true);
 UPDATE public.org_suplencias SET aviso_rs_enviado_en=CASE WHEN _enviado THEN now() ELSE NULL END,aviso_rs_error=CASE WHEN _enviado THEN NULL ELSE left(coalesce(_error,'Envío no completado'),2000) END WHERE id=_id AND aviso_rs_requerido AND aviso_rs_enviado_en IS NULL;
 PERFORM set_config('tracea.aviso_sistema','',true);
END $$;
REVOKE ALL ON FUNCTION public.org_suplencia_aviso_resultado(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.org_suplencia_aviso_resultado(uuid,boolean,text) TO service_role;