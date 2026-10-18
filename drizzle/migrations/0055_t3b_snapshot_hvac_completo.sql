CREATE FUNCTION public.tend_resolver_instrumentos(_org uuid,_seleccion jsonb,_instrumentos jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE ids uuid[]; hv uuid; resultado jsonb; BEGIN
 IF NOT public.tend_acceso(_org) THEN RAISE EXCEPTION 'Selección fuera de la empresa activa'; END IF;
 IF _seleccion->>'modo'='hvac' THEN
 BEGIN hv:=(_seleccion->>'hvacId')::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Selecciona un sistema HVAC válido'; END;
 IF hv IS NULL OR NOT EXISTS(SELECT 1 FROM public.tend_sistemas_hvac WHERE org_id=_org AND id=hv AND activo) THEN RAISE EXCEPTION 'Sistema HVAC no disponible en la empresa activa'; END IF;
 SELECT array_agg(DISTINCT i.id) INTO ids FROM public.tend_instrumentos i LEFT JOIN public.tend_areas a ON a.org_id=i.org_id AND a.id=i.area_id WHERE i.org_id=_org AND i.activo AND (a.hvac_id=hv OR EXISTS(SELECT 1 FROM public.tend_registros r LEFT JOIN public.tend_areas ra ON ra.org_id=r.org_id AND ra.id=r.area_id WHERE r.org_id=_org AND r.instrumento_id=i.id AND r.activo AND r.modulo IN ('temphr','presiones','filtros') AND coalesce(r.hvac_id,a.hvac_id,ra.hvac_id,(SELECT fa.hvac_id FROM public.tend_areas fa WHERE fa.org_id=_org AND fa.codigo=btrim(split_part(regexp_replace(coalesce(i.area_libre,''),' vs ',' vs ','gi'),' vs ',1)) LIMIT 1))=hv));
 ELSE
 SELECT array_agg(DISTINCT i.id) INTO ids FROM public.tend_instrumentos i WHERE i.org_id=_org AND i.activo AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(_instrumentos,'[]')) k WHERE coalesce(k->>'instrumento_id',k->>'id',CASE WHEN jsonb_typeof(k)='string' THEN k#>>'{}' END)=i.id::text);
 END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.codigo),'[]') INTO resultado FROM public.tend_instrumentos i WHERE i.org_id=_org AND i.id=ANY(ids);
 IF jsonb_array_length(resultado)=0 THEN RAISE EXCEPTION 'No se puede emitir: la selección no contiene instrumentos activos'; END IF;
 RETURN resultado; END $$;
REVOKE ALL ON FUNCTION public.tend_resolver_instrumentos(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tend_resolver_instrumentos(uuid,jsonb,jsonb) TO authenticated;
DO $$ DECLARE original text; cambiado text; patron text:='IF jsonb_array_length(NEW.instrumentos)=0 THEN'; BEGIN
 SELECT pg_get_functiondef('public.tend_at_guard()'::regprocedure) INTO original;
 cambiado:=replace(original,patron,'NEW.instrumentos:=public.tend_resolver_instrumentos(NEW.org_id,NEW.seleccion,NEW.instrumentos); '||patron);
 IF cambiado=original OR position('NEW.instrumentos:=public.tend_resolver_instrumentos' in cambiado)=0 THEN RAISE EXCEPTION 'No se aplicó resolución HVAC en guard AT'; END IF;
 EXECUTE cambiado; END $$;
CREATE OR REPLACE FUNCTION public.tend_at_snapshots() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p record; ids uuid[]; historial jsonb; previa text; empresa record; BEGIN
 SELECT nombre,cargo,email INTO p FROM public.profiles WHERE id=auth.uid() AND activo;
 IF TG_OP='INSERT' THEN NEW.elaborado_nombre:=p.nombre; NEW.elaborado_cargo:=p.cargo; NEW.anulado_nombre:=NULL; NEW.anulado_cargo:=NULL; NEW.anulado_email:=NULL; NEW.rs_sustituido_nombre:=NULL;
 ELSE
 NEW.elaborado_nombre:=OLD.elaborado_nombre; NEW.elaborado_cargo:=OLD.elaborado_cargo; NEW.anulado_nombre:=OLD.anulado_nombre; NEW.anulado_cargo:=OLD.anulado_cargo; NEW.anulado_email:=OLD.anulado_email; NEW.rs_sustituido_nombre:=OLD.rs_sustituido_nombre;
 IF OLD.estado='emitido' AND NEW.estado='borrador' THEN NEW.elaborado_nombre:=p.nombre; NEW.elaborado_cargo:=p.cargo; NEW.formato_snapshot:=NULL; NEW.datos_snapshot:=NULL; NEW.rs_sustituido_nombre:=NULL; END IF;
 IF NEW.estado='anulado' AND OLD.estado<>'anulado' THEN NEW.anulado_nombre:=p.nombre; NEW.anulado_cargo:=p.cargo; NEW.anulado_email:=p.email; END IF;
 IF NEW.estado='emitido' AND OLD.estado='borrador' THEN
 SELECT to_jsonb(f) INTO NEW.formato_snapshot FROM public.tend_formato f WHERE f.org_id=NEW.org_id ORDER BY f.version DESC LIMIT 1;
 IF NEW.formato_snapshot IS NULL THEN RAISE EXCEPTION 'Configura el formato antes de emitir'; END IF;
 SELECT nombre,logo_url INTO empresa FROM public.organizations WHERE id=NEW.org_id;
 NEW.formato_snapshot:=NEW.formato_snapshot||jsonb_build_object('identidad',jsonb_build_object('nombre',coalesce(nullif(NEW.formato_snapshot->'textos'->>'empresa',''),empresa.nombre),'logoDescripcion',coalesce(nullif(NEW.formato_snapshot->'textos'->>'logoDescripcion',''),'Logo '||empresa.nombre),'confidencialidad',coalesce(nullif(NEW.formato_snapshot->'textos'->>'confidencialidad',''),'Documento confidencial propiedad de '||empresa.nombre||'. Queda prohibido su uso, divulgación y/o reproducción total o parcial sin previa autorización.')),'logo',coalesce(nullif(NEW.formato_snapshot->>'logo',''),empresa.logo_url));
 SELECT array_agg((k->>'id')::uuid) INTO ids FROM jsonb_array_elements(NEW.instrumentos) k;
 IF coalesce(array_length(ids,1),0)=0 THEN RAISE EXCEPTION 'No se puede emitir: la selección no contiene instrumentos activos'; END IF;
 IF NEW.en_suplencia THEN SELECT rs_titular_nombre INTO NEW.rs_sustituido_nombre FROM public.org_suplencias WHERE org_id=NEW.org_id AND id=NEW.suplencia_id; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.version),'[]') INTO historial FROM public.tend_registros_at_historial h WHERE h.org_id=NEW.org_id AND h.registro_id=NEW.id;
 SELECT NEW.codigo||' v'||lpad(h.version::text,2,'0') INTO previa FROM public.tend_registros_at_historial h WHERE h.org_id=NEW.org_id AND h.registro_id=NEW.id AND h.datos->>'estado'='emitido' ORDER BY h.version DESC LIMIT 1;
 NEW.datos_snapshot:=jsonb_build_object('schema_version',2,'fecha_calculo',current_date,'registro_at',to_jsonb(NEW)-ARRAY['formato_snapshot','datos_snapshot'],'historial',historial,'sustituye',coalesce(previa,'N/A'),
 'registros',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('semanas',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.semana_inicio,s.id) FROM public.tend_semanas s WHERE s.org_id=NEW.org_id AND s.registro_id=r.id AND s.semana_inicio<=NEW.periodo_hasta AND s.semana_inicio+6>=NEW.periodo_desde),'[]'::jsonb)) ORDER BY r.id) FROM public.tend_registros r WHERE r.org_id=NEW.org_id AND r.instrumento_id=ANY(ids) AND r.activo AND r.modulo IN ('temphr','presiones','filtros')),'[]'::jsonb),
 'instrumentos',NEW.instrumentos,
 'objetivos',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.codigo) FROM public.tend_objetivos_presion o WHERE o.org_id=NEW.org_id AND (o.instrumento_id=ANY(ids) OR EXISTS(SELECT 1 FROM public.tend_semanas s JOIN public.tend_registros r ON r.org_id=s.org_id AND r.id=s.registro_id WHERE s.org_id=NEW.org_id AND r.instrumento_id=ANY(ids) AND s.objetivo_presion_id=o.id AND s.semana_inicio<=NEW.periodo_hasta AND s.semana_inicio+6>=NEW.periodo_desde))),'[]'::jsonb),
 'areas',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.codigo) FROM public.tend_areas a WHERE a.org_id=NEW.org_id),'[]'::jsonb),
 'hvac',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.codigo) FROM public.tend_sistemas_hvac h WHERE h.org_id=NEW.org_id),'[]'::jsonb),
 'cambios',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.fecha,c.id) FROM public.tend_cambios_filtro c WHERE c.org_id=NEW.org_id AND c.instrumento_id=ANY(ids)),'[]'::jsonb));
 IF jsonb_array_length(NEW.datos_snapshot->'registros')=0 THEN RAISE EXCEPTION 'No se puede emitir: los instrumentos seleccionados no tienen registros activos de tendencias'; END IF;
 END IF; END IF; RETURN NEW; END $$;