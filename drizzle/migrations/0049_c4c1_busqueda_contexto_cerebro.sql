CREATE OR REPLACE FUNCTION public.contexto_cerebro(_org uuid,_folio_id uuid,_texto text,_limite int DEFAULT 12) RETURNS TABLE(id uuid,codigo text,tipo text,contenido text,area text,proceso text,fuente jsonb,validado_por text,validado_en timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF _org IS NULL OR (coalesce(auth.role(),'') <> 'service_role' AND _org IS DISTINCT FROM public.get_user_org_id()) THEN RETURN; END IF;
 IF NOT public.org_tiene_modulo(_org,'institutional_brain') THEN RETURN; END IF;
 IF _folio_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.folios f WHERE f.id=_folio_id AND f.org_id=_org) THEN RETURN; END IF;
 RETURN QUERY
 WITH entrada AS (SELECT left(coalesce(_texto,''),10000) texto),
 consulta AS (
 SELECT coalesce((SELECT to_tsquery('spanish',string_agg(quote_literal(l),' | ')) FROM unnest(tsvector_to_array(to_tsvector('spanish',regexp_replace(e.texto,'\mK-[0-9]{4,}\M','','gi')))) l),' '::tsquery) q,
 ARRAY(SELECT upper(m[1]) FROM regexp_matches(e.texto,'\m(K-[0-9]{4,})\M','gi') m) codigos,
 coalesce((SELECT to_tsquery('spanish',string_agg(quote_literal(l),' | ')) FROM public.folios f CROSS JOIN LATERAL unnest(tsvector_to_array(to_tsvector('spanish',coalesce(f.proceso_equipo,'')))) l WHERE f.id=_folio_id AND f.org_id=_org),' '::tsquery) contexto
 FROM entrada e),
 base AS (
 SELECT k.id,k.codigo,k.tipo,left(k.contenido,600) contenido,a.nombre area,p.nombre proceso,
 coalesce(s.fuente,'{}'::jsonb) fuente,v.nombre validado_por,k.validado_en,
 k.codigo=ANY(q.codigos) explicito,
 to_tsvector('spanish',coalesce(k.contenido,'') || ' ' || coalesce(a.nombre,'') || ' ' || coalesce(p.nombre,'')) @@ q.q coincide,
 ts_rank(to_tsvector('spanish',coalesce(k.contenido,'') || ' ' || coalesce(a.nombre,'') || ' ' || coalesce(p.nombre,'')),q.q) relevancia,
 to_tsvector('spanish',coalesce(a.nombre,'') || ' ' || coalesce(p.nombre,'')) @@ q.contexto relacionado
 FROM public.brain_knowledge_items k CROSS JOIN consulta q
 LEFT JOIN public.brain_areas a ON a.id=k.area_id AND a.org_id=_org
 LEFT JOIN public.brain_processes p ON p.id=k.proceso_id AND p.org_id=_org
 LEFT JOIN public.profiles v ON v.id=k.validado_por
 LEFT JOIN LATERAL (SELECT jsonb_build_object('codigo',coalesce(s.documento_codigo,d.codigo),'revision',coalesce(s.documento_revision,d.revision),'pagina',s.pagina,'nombre',coalesce(d.nombre,s.nombre_fuente,s.descripcion)) fuente FROM public.brain_knowledge_sources s LEFT JOIN public.brain_documents d ON d.id=s.documento_id AND d.org_id=_org WHERE s.knowledge_item_id=k.id AND s.org_id=_org ORDER BY (s.tipo_fuente IN ('archivo','documento')) DESC,s.created_at,s.id LIMIT 1) s ON true
 WHERE k.org_id=_org AND k.estado='validado' AND k.sustituido_por_id IS NULL
 ), modo AS (SELECT EXISTS(SELECT 1 FROM base WHERE explicito OR coincide) directo),
 candidatos AS (SELECT b.* FROM base b CROSS JOIN modo m WHERE CASE WHEN m.directo THEN b.explicito OR b.coincide ELSE b.relacionado END),
 ordenados AS (SELECT c.*,row_number() OVER(ORDER BY explicito DESC,relevancia DESC,c.codigo) posicion FROM candidatos c),
 acotados AS (SELECT o.*,sum(length(concat_ws(' · ',o.codigo,o.tipo,o.area,o.proceso,o.contenido,o.fuente::text,o.validado_por,o.validado_en::text))+40) OVER(ORDER BY posicion) caracteres FROM ordenados o CROSS JOIN modo m WHERE posicion<=least(CASE WHEN m.directo THEN 12 ELSE 5 END,greatest(0,coalesce(_limite,12))))
 SELECT c.id,c.codigo,c.tipo,c.contenido,c.area,c.proceso,c.fuente,c.validado_por,c.validado_en FROM acotados c WHERE caracteres<=6000 ORDER BY posicion;
END $$;
REVOKE ALL ON FUNCTION public.contexto_cerebro(uuid,uuid,text,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contexto_cerebro(uuid,uuid,text,int) TO authenticated,service_role;
COMMENT ON FUNCTION public.contexto_cerebro(uuid,uuid,text,int) IS 'C4c.1: códigos explícitos primero, búsqueda OR española con ts_rank, fallback hasta 5 por proceso/área del folio; solo validados de la empresa autorizada.';