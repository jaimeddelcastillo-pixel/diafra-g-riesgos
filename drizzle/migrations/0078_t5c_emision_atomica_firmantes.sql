DO $patch$
DECLARE fuente text; vieja text; nueva text; BEGIN
 SELECT pg_get_functiondef('public.tend_at_guard()'::regprocedure) INTO fuente;
 vieja:='ARRAY[''estado'',''motivo_version'',''motivo_anulacion'',''updated_at'',''updated_by'']';
 nueva:='ARRAY[''estado'',''motivo_version'',''motivo_anulacion'',''firmantes_at'',''updated_at'',''updated_by'']';
 IF position(vieja IN fuente)=0 THEN RAISE EXCEPTION 'No se encontró comparación de transición AT'; END IF;
 EXECUTE replace(fuente,vieja,nueva);
 SELECT pg_get_functiondef('public.tend_validar_firmantes_at(uuid,jsonb,jsonb,boolean)'::regprocedure) INTO fuente;
 fuente:=replace(fuente,'_emitir boolean DEFAULT false)','_emitir boolean, _autor uuid)');
 fuente:=replace(fuente,'uid=auth.uid()','uid=_autor');
 IF position('_autor uuid' IN fuente)=0 THEN RAISE EXCEPTION 'No se encontró firma de validación AT'; END IF;
 EXECUTE fuente;
 SELECT pg_get_functiondef('public.tend_at_firmantes_guard()'::regprocedure) INTO fuente;
 vieja:='config,NEW.estado=''emitido'')'; nueva:='config,NEW.estado=''emitido'',NEW.elaborado_version_por)';
 IF position(vieja IN fuente)=0 THEN RAISE EXCEPTION 'No se encontró validación de firmantes AT'; END IF;
 fuente:=replace(fuente,vieja,nueva);
 vieja:='IF NEW.estado=''anulado'' OR (OLD.estado<>''borrador'' AND NEW.estado=''borrador'') THEN RETURN NEW; END IF;';
 nueva:='IF NEW.estado=''anulado'' AND NEW.firmantes_at IS DISTINCT FROM OLD.firmantes_at THEN RAISE EXCEPTION ''Anulación no puede cambiar firmantes''; END IF; '||vieja;
 IF position(vieja IN fuente)=0 THEN RAISE EXCEPTION 'No se encontró control de anulación'; END IF;
 EXECUTE replace(fuente,vieja,nueva);
END $patch$;
REVOKE ALL ON FUNCTION public.tend_validar_firmantes_at(uuid,jsonb,jsonb,boolean,uuid) FROM PUBLIC,anon,authenticated;