CREATE OR REPLACE FUNCTION public.tend_resolver_instrumentos(_org uuid,_seleccion jsonb,_instrumentos jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE ids uuid[]; hv uuid; resultado jsonb; BEGIN
IF NOT public.tend_acceso(_org) THEN RAISE EXCEPTION 'Selección fuera de la empresa activa'; END IF;
IF _seleccion->>'modo'='hvac' THEN
BEGIN hv:=(_seleccion->>'hvacId')::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Selecciona un sistema HVAC válido'; END;
IF hv IS NULL OR NOT EXISTS(SELECT 1 FROM public.tend_sistemas_hvac WHERE org_id=_org AND id=hv AND activo) THEN RAISE EXCEPTION 'Sistema HVAC no disponible en la empresa activa'; END IF;
SELECT array_agg(DISTINCT i.id) INTO ids FROM public.tend_instrumentos i WHERE i.org_id=_org AND i.activo AND EXISTS(SELECT 1 FROM public.tend_registros r LEFT JOIN public.tend_areas ia ON ia.org_id=r.org_id AND ia.id=i.area_id LEFT JOIN public.tend_areas ra ON ra.org_id=r.org_id AND ra.id=r.area_id WHERE r.org_id=_org AND r.instrumento_id=i.id AND r.activo AND r.modulo IN ('temphr','presiones','filtros') AND coalesce(r.hvac_id,CASE WHEN ia.id IS NOT NULL THEN ia.hvac_id ELSE ra.hvac_id END,(SELECT fa.hvac_id FROM public.tend_areas fa WHERE fa.org_id=_org AND fa.codigo=btrim((regexp_split_to_array(coalesce(i.area_libre,''),' vs ','i'))[1]) LIMIT 1))=hv);
ELSE
SELECT array_agg(DISTINCT i.id) INTO ids FROM public.tend_instrumentos i WHERE i.org_id=_org AND i.activo AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(_instrumentos,'[]')) k WHERE coalesce(k->>'instrumento_id',k->>'id',CASE WHEN jsonb_typeof(k)='string' THEN k#>>'{}' END)=i.id::text);
END IF;
SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.codigo),'[]') INTO resultado FROM public.tend_instrumentos i WHERE i.org_id=_org AND i.id=ANY(ids);
IF jsonb_array_length(resultado)=0 THEN RAISE EXCEPTION 'No se puede emitir: la selección no contiene instrumentos activos'; END IF;
RETURN resultado; END $$;