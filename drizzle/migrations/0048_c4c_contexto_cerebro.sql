ALTER TABLE public.brain_knowledge_items ADD COLUMN codigo text;
ALTER TABLE public.ia_config_org ADD COLUMN usar_conocimiento_cerebro boolean NOT NULL DEFAULT false;
ALTER TABLE public.chat_mensajes ADD COLUMN contexto_usado jsonb;
WITH numerados AS (SELECT id, row_number() OVER (PARTITION BY org_id ORDER BY created_at,id) n FROM public.brain_knowledge_items) UPDATE public.brain_knowledge_items k SET codigo='K-' || lpad(n.n::text,greatest(4,length(n.n::text)),'0') FROM numerados n WHERE k.id=n.id;
CREATE UNIQUE INDEX brain_knowledge_codigo_org ON public.brain_knowledge_items(org_id,codigo);
CREATE INDEX brain_knowledge_texto_gin ON public.brain_knowledge_items USING gin(to_tsvector('spanish'::regconfig,coalesce(contenido,'')));
CREATE FUNCTION public.brain_codigo_asignar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n bigint;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.codigo IS DISTINCT FROM OLD.codigo OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN RAISE EXCEPTION 'El código de conocimiento y su empresa son inmutables'; END IF;
  RETURN NEW;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.org_id::text,741));
 SELECT coalesce(max(substring(codigo from 3)::bigint),0)+1 INTO n FROM public.brain_knowledge_items WHERE org_id=NEW.org_id;
 NEW.codigo := 'K-' || lpad(n::text,greatest(4,length(n::text)),'0'); RETURN NEW;
END $$;
CREATE TRIGGER brain_codigo_asignar BEFORE INSERT OR UPDATE ON public.brain_knowledge_items FOR EACH ROW EXECUTE FUNCTION public.brain_codigo_asignar();
CREATE FUNCTION public.contexto_cerebro(_org uuid,_folio_id uuid,_texto text,_limite int DEFAULT 12) RETURNS TABLE(id uuid,codigo text,tipo text,contenido text,area text,proceso text,fuente jsonb,validado_por text,validado_en timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF _org IS NULL OR (coalesce(auth.role(),'') <> 'service_role' AND _org IS DISTINCT FROM public.get_user_org_id()) THEN RETURN; END IF;
 IF NOT public.org_tiene_modulo(_org,'institutional_brain') THEN RETURN; END IF;
 IF _folio_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.folios f WHERE f.id=_folio_id AND f.org_id=_org) THEN RETURN; END IF;
 RETURN QUERY
 WITH consulta AS (SELECT websearch_to_tsquery('spanish',left(coalesce(_texto,''),10000)) q),
 candidatos AS (
 SELECT k.id,k.codigo,k.tipo,left(k.contenido,600) contenido,a.nombre area,p.nombre proceso,
 coalesce(s.fuente,'{}'::jsonb) fuente,v.nombre validado_por,k.validado_en,
 EXISTS(SELECT 1 FROM public.brain_vinculos b WHERE b.org_id=_org AND b.knowledge_item_id=k.id AND ((b.entidad_tipo='folio' AND b.entidad_id=_folio_id) OR (b.entidad_tipo='riesgo' AND EXISTS(SELECT 1 FROM public.riesgos r WHERE r.id=b.entidad_id AND r.folio_id=_folio_id)))) vinculado,
 ts_rank(to_tsvector('spanish',coalesce(k.contenido,'') || ' ' || coalesce(a.nombre,'') || ' ' || coalesce(p.nombre,'')),q.q) relevancia,
 k.tipo IN ('riesgo_control','regla_pno','conocimiento_operativo','desviacion_capa','validacion_calificacion','producto_proceso') prioritario
 FROM public.brain_knowledge_items k CROSS JOIN consulta q
 LEFT JOIN public.brain_areas a ON a.id=k.area_id AND a.org_id=_org
 LEFT JOIN public.brain_processes p ON p.id=k.proceso_id AND p.org_id=_org
 LEFT JOIN public.profiles v ON v.id=k.validado_por
 LEFT JOIN LATERAL (SELECT jsonb_build_object('codigo',coalesce(s.documento_codigo,d.codigo),'revision',coalesce(s.documento_revision,d.revision),'pagina',s.pagina,'nombre',coalesce(d.nombre,s.nombre_fuente,s.descripcion)) fuente FROM public.brain_knowledge_sources s LEFT JOIN public.brain_documents d ON d.id=s.documento_id AND d.org_id=_org WHERE s.knowledge_item_id=k.id AND s.org_id=_org ORDER BY (s.tipo_fuente IN ('archivo','documento')) DESC,s.created_at,s.id LIMIT 1) s ON true
 WHERE k.org_id=_org AND k.estado='validado' AND k.sustituido_por_id IS NULL
 AND (to_tsvector('spanish',coalesce(k.contenido,'')) @@ q.q OR to_tsvector('spanish',coalesce(a.nombre,'') || ' ' || coalesce(p.nombre,'')) @@ q.q OR EXISTS(SELECT 1 FROM public.brain_vinculos b WHERE b.org_id=_org AND b.knowledge_item_id=k.id AND ((b.entidad_tipo='folio' AND b.entidad_id=_folio_id) OR (b.entidad_tipo='riesgo' AND EXISTS(SELECT 1 FROM public.riesgos r WHERE r.id=b.entidad_id AND r.folio_id=_folio_id)))))
 ), ordenados AS (SELECT c.*,row_number() OVER(ORDER BY vinculado DESC,prioritario DESC,relevancia DESC,c.codigo) posicion FROM candidatos c),
 acotados AS (SELECT o.*,sum(length(concat_ws(' · ',o.codigo,o.tipo,o.area,o.proceso,o.contenido,o.fuente::text,o.validado_por,o.validado_en::text))+40) OVER(ORDER BY posicion) caracteres FROM ordenados o WHERE posicion<=least(12,greatest(0,coalesce(_limite,12))))
 SELECT c.id,c.codigo,c.tipo,c.contenido,c.area,c.proceso,c.fuente,c.validado_por,c.validado_en FROM acotados c WHERE caracteres<=6000 ORDER BY posicion;
END $$;
REVOKE ALL ON FUNCTION public.contexto_cerebro(uuid,uuid,text,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contexto_cerebro(uuid,uuid,text,int) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ia_config_org_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.composicion_riesgos IS DISTINCT FROM OLD.composicion_riesgos THEN
 INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_anterior,valor_nuevo) VALUES(auth.uid(),NEW.org_id,'ia_config_org',NEW.org_id::text,'IA_COMPOSICION_CAMBIADA',jsonb_build_object('composicion_riesgos',CASE WHEN TG_OP='UPDATE' THEN OLD.composicion_riesgos ELSE 'monolitica' END),jsonb_build_object('composicion_riesgos',NEW.composicion_riesgos));
 END IF;
 IF (TG_OP='INSERT' AND NEW.usar_conocimiento_cerebro) OR (TG_OP='UPDATE' AND NEW.usar_conocimiento_cerebro IS DISTINCT FROM OLD.usar_conocimiento_cerebro) THEN
 INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_anterior,valor_nuevo) VALUES(auth.uid(),NEW.org_id,'ia_config_org',NEW.org_id::text,'IA_CONOCIMIENTO_CEREBRO_CAMBIADO',jsonb_build_object('usar_conocimiento_cerebro',CASE WHEN TG_OP='UPDATE' THEN OLD.usar_conocimiento_cerebro ELSE false END),jsonb_build_object('usar_conocimiento_cerebro',NEW.usar_conocimiento_cerebro));
 END IF; RETURN NULL;
END $$;
CREATE FUNCTION public.riesgo_contexto_cerebro_traza() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.chat_mensajes; v_org uuid; propuesta jsonb; snapshot jsonb; c jsonb; texto text; nombre text;
BEGIN
 IF NEW.ia_origen->>'mensaje_id' IS NULL THEN RETURN NEW; END IF;
 SELECT org_id INTO v_org FROM public.folios WHERE id=NEW.folio_id;
 IF auth.uid() IS NULL OR v_org IS DISTINCT FROM public.get_user_org_id() THEN RAISE EXCEPTION 'Contexto IA fuera de la empresa activa'; END IF;
 SELECT * INTO m FROM public.chat_mensajes WHERE id=(NEW.ia_origen->>'mensaje_id')::uuid AND org_id=v_org AND user_id=auth.uid() AND role='assistant' AND folio_id=NEW.folio_id;
 IF m.id IS NULL THEN RAISE EXCEPTION 'Respuesta IA no autorizada'; END IF;
 SELECT t INTO propuesta FROM jsonb_array_elements(coalesce(m.documentos_adjuntos->'tool_uses','[]'::jsonb)) t WHERE t->>'id'=NEW.ia_origen->>'tool_id' AND t->>'name'='proponer_riesgo';
 IF propuesta IS NULL THEN RAISE EXCEPTION 'Propuesta IA no encontrada'; END IF;
 snapshot:=coalesce(m.contexto_usado,'[]'::jsonb);
 NEW.ia_origen:=jsonb_build_object('mensaje_id',m.id,'tool_id',NEW.ia_origen->>'tool_id','skills_usadas',m.skills_usadas,'modelo_ia',m.modelo_ia,'contexto_usado',snapshot,'codigos_conocimiento',(SELECT coalesce(jsonb_agg(x->>'codigo'),'[]'::jsonb) FROM jsonb_array_elements(snapshot) x));
 RETURN NEW;
END $$;
CREATE TRIGGER riesgo_contexto_cerebro_traza BEFORE INSERT ON public.riesgos FOR EACH ROW EXECUTE FUNCTION public.riesgo_contexto_cerebro_traza();
CREATE FUNCTION public.riesgo_contexto_cerebro_vincular() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb; v_org uuid; nombre text; texto text;
BEGIN
 IF NEW.ia_origen->>'mensaje_id' IS NULL THEN RETURN NULL; END IF;
 SELECT org_id INTO v_org FROM public.folios WHERE id=NEW.folio_id;
 SELECT p.nombre INTO nombre FROM public.profiles p WHERE p.id=auth.uid();
 texto := (to_jsonb(NEW)-'ia_origen')::text;
 FOR c IN SELECT value FROM jsonb_array_elements(coalesce(NEW.ia_origen->'contexto_usado','[]'::jsonb)) LOOP
 IF EXISTS(SELECT 1 FROM regexp_matches(texto,'\mK-[0-9]{4,}\M','g') x WHERE x[1]=c->>'codigo') AND EXISTS(SELECT 1 FROM public.brain_knowledge_items k WHERE k.id=(c->>'id')::uuid AND k.org_id=v_org AND k.codigo=c->>'codigo') THEN
 INSERT INTO public.brain_vinculos(org_id,knowledge_item_id,entidad_tipo,entidad_id,relacion,nota,creado_por) VALUES(v_org,(c->>'id')::uuid,'riesgo',NEW.id,'referencia','Sistema, a solicitud de ' || coalesce(nombre,auth.uid()::text),auth.uid()) ON CONFLICT(knowledge_item_id,entidad_tipo,entidad_id,relacion) DO NOTHING;
 END IF; END LOOP; RETURN NULL;
END $$;
CREATE TRIGGER riesgo_contexto_cerebro_vincular AFTER INSERT ON public.riesgos FOR EACH ROW EXECUTE FUNCTION public.riesgo_contexto_cerebro_vincular();
CREATE FUNCTION public.conocimiento_usado_en(_id uuid) RETURNS TABLE(folio_id uuid,folio text,riesgo_id uuid,riesgo text,fecha timestamptz,nota text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT f.id,f.codigo,r.id,concat('#',r.numero_id,' · ',r.peligro),b.created_at,b.nota FROM public.brain_vinculos b JOIN public.brain_knowledge_items k ON k.id=b.knowledge_item_id JOIN public.riesgos r ON b.entidad_tipo='riesgo' AND r.id=b.entidad_id JOIN public.folios f ON f.id=r.folio_id AND f.org_id=k.org_id WHERE k.id=_id AND k.org_id=public.get_user_org_id() AND public.org_tiene_modulo(k.org_id,'institutional_brain') AND b.relacion='referencia' AND b.nota LIKE 'Sistema, a solicitud de %' ORDER BY b.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.conocimiento_usado_en(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.conocimiento_usado_en(uuid) TO authenticated,service_role;
DO $$ DECLARE def text; BEGIN SELECT pg_get_functiondef('public.auditor_ver_item(uuid)'::regprocedure) INTO def; def:=replace(def,'''contenido'', k.contenido, ''tipo'', k.tipo','''codigo'', k.codigo, ''contenido'', k.contenido, ''tipo'', k.tipo'); EXECUTE def; END $$;
REVOKE ALL ON FUNCTION public.brain_codigo_asignar(),public.riesgo_contexto_cerebro_traza(),public.riesgo_contexto_cerebro_vincular() FROM PUBLIC,anon,authenticated;