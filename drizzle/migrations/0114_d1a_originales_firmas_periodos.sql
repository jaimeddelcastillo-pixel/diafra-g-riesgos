CREATE TABLE public.documento_reservas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id), actor uuid NOT NULL, folio text NOT NULL UNIQUE, tipo text NOT NULL, nombre_archivo text NOT NULL, archivo_path text NOT NULL UNIQUE, registro jsonb NOT NULL, creado_en timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.documento_reservas TO authenticated;
GRANT ALL ON public.documento_reservas TO service_role;
ALTER TABLE public.documento_reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY reserva_lectura ON public.documento_reservas FOR SELECT TO authenticated USING(org_id=(SELECT public.get_user_org_id()) AND actor=(SELECT auth.uid()));
CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON public.documento_reservas FOR EACH ROW EXECUTE FUNCTION public.documental_solo_insercion();
CREATE POLICY documento_original_alta ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='documentos-generados' AND EXISTS(SELECT 1 FROM public.documento_reservas r WHERE r.org_id=(SELECT public.get_user_org_id()) AND r.actor=(SELECT auth.uid()) AND r.archivo_path=name AND NOT EXISTS(SELECT 1 FROM public.documentos_generados d WHERE d.folio=r.folio)));
CREATE OR REPLACE FUNCTION public.preparar_documento_archivo(_tipo text,_nombre_archivo text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.get_user_org_id(); u uuid:=auth.uid(); f org_formatos; i org_identidad_documental; fol text; reg jsonb; ext text; p profiles; empresa organizations;
BEGIN
 IF org IS NULL OR u IS NULL THEN RAISE EXCEPTION 'Sin empresa activa'; END IF;
 IF _tipo NOT IN ('indicadores.resultados_excel','indicadores.catalogo_excel','indicadores.tablero_excel','indicadores.reporte_word','auditoria.bitacora_pdf','auditoria.bitacora_excel') THEN RAISE EXCEPTION 'Tipo no disponible para archivo original'; END IF;
 ext:=lower(substring(_nombre_archivo from '\.([a-z]+)$')); IF ext IS NULL OR ext NOT IN ('xlsx','pdf','docx') THEN RAISE EXCEPTION 'Extensión inválida'; END IF;
 SELECT * INTO f FROM public.org_formatos WHERE org_id=org AND tipo=_tipo ORDER BY version DESC LIMIT 1;
 SELECT * INTO i FROM public.org_identidad_documental WHERE org_id=org ORDER BY version DESC LIMIT 1;
 SELECT * INTO p FROM public.profiles WHERE id=u; SELECT * INTO empresa FROM public.organizations WHERE id=org;
 fol:='DOC-'||to_char(now() AT TIME ZONE 'America/Mexico_City','YYYY')||'-'||lpad(nextval('public.documentos_generados_folio_seq')::text,6,'0');
 reg:=jsonb_build_object('folio',fol,'generado_en',now(),'formato',CASE WHEN f.id IS NOT NULL THEN to_jsonb(f) END,'identidad',CASE WHEN i.id IS NOT NULL THEN to_jsonb(i) END,'generador',jsonb_build_object('nombre',coalesce(p.nombre,p.email,''),'cargo',coalesce(p.cargo,'')),'empresa',empresa.nombre,'logo_path',empresa.logo_url,'archivo_path',org::text||'/'||split_part(fol,'-',2)||'/'||fol||'.'||ext);
 INSERT INTO public.documento_reservas(org_id,actor,folio,tipo,nombre_archivo,archivo_path,registro) VALUES(org,u,fol,_tipo,_nombre_archivo,reg->>'archivo_path',reg);
 RETURN reg;
END $$;
CREATE OR REPLACE FUNCTION public.confirmar_documento_archivo(_folio text,_sha256 text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r documento_reservas; reg jsonb; d documentos_generados;
BEGIN
 SELECT * INTO r FROM public.documento_reservas WHERE folio=_folio AND org_id=public.get_user_org_id() AND actor=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;
 SELECT * INTO d FROM public.documentos_generados WHERE folio=_folio;
 IF FOUND THEN IF d.archivo_sha256 IS DISTINCT FROM _sha256 THEN RAISE EXCEPTION 'Original inalterable'; END IF; RETURN; END IF;
 IF _sha256 !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='documentos-generados' AND name=r.archivo_path AND owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'Original no guardado'; END IF;
 reg:=r.registro; PERFORM set_config('tracea.motivo','Archivo original conservado con identidad documental',true);
 INSERT INTO public.documentos_generados(org_id,folio,tipo,formato_id,identidad_id,formato_version,identidad_version,nombre_archivo,generado_por,generado_en,archivo_path,archivo_sha256) VALUES(r.org_id,r.folio,r.tipo,(reg->'formato'->>'id')::uuid,(reg->'identidad'->>'id')::uuid,(reg->'formato'->>'version')::integer,(reg->'identidad'->>'version')::integer,r.nombre_archivo,r.actor,(reg->>'generado_en')::timestamptz,r.archivo_path,_sha256);
END $$;
CREATE OR REPLACE FUNCTION public.listar_documentos_archivados(_folio text DEFAULT '',_tipo text DEFAULT '',_desde date DEFAULT NULL,_hasta date DEFAULT NULL,_usuario text DEFAULT '',_pagina integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.get_user_org_id() IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Sin empresa activa'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (SELECT d.folio,d.tipo,d.nombre_archivo,d.generado_en,d.archivo_path,d.archivo_sha256,coalesce(p.nombre,p.email,'') usuario FROM public.documentos_generados d LEFT JOIN public.profiles p ON p.id=d.generado_por WHERE d.org_id=public.get_user_org_id() AND d.folio ILIKE '%'||coalesce(_folio,'')||'%' AND (coalesce(_tipo,'')='' OR d.tipo=_tipo) AND (_desde IS NULL OR d.generado_en>=(_desde::timestamp AT TIME ZONE 'America/Mexico_City')) AND (_hasta IS NULL OR d.generado_en<((_hasta+1)::timestamp AT TIME ZONE 'America/Mexico_City')) AND coalesce(p.nombre,p.email,'') ILIKE '%'||coalesce(_usuario,'')||'%' ORDER BY d.generado_en DESC,d.id DESC OFFSET greatest(0,coalesce(_pagina,0))*50 LIMIT 51) x);
END $$;
REVOKE ALL ON FUNCTION public.preparar_documento_archivo(text,text),public.confirmar_documento_archivo(text,text),public.listar_documentos_archivados(text,text,date,date,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preparar_documento_archivo(text,text),public.confirmar_documento_archivo(text,text),public.listar_documentos_archivados(text,text,date,date,text,integer) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guardar_formato_documento(_tipo text,_codigo text,_version text,_titulo text,_firmas jsonb,_vigente_desde date,_motivo text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.get_user_org_id(); nid uuid; firmas jsonb;
BEGIN
 IF org IS NULL OR NOT public.documental_puede_editar() THEN RAISE EXCEPTION 'Sin permiso para editar formatos'; END IF;
 IF length(btrim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
 IF jsonb_typeof(coalesce(_firmas,'[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'Firmas inválidas'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('rol',x->>'rol','aplica',coalesce((x->>'aplica')::boolean,true),'cargo',btrim(coalesce(x->>'cargo','')))),'[]'::jsonb) INTO firmas FROM jsonb_array_elements(coalesce(_firmas,'[]'::jsonb)) x WHERE x->>'rol' IN ('Elaboró','Revisó','Autorizó');
 PERFORM pg_advisory_xact_lock(hashtext('formato:'||org||':'||_tipo)); PERFORM set_config('tracea.motivo',btrim(_motivo),true);
 INSERT INTO public.org_formatos(org_id,tipo,version,codigo,version_formato,titulo,firmas,vigente_desde,motivo,created_by) SELECT org,_tipo,coalesce(max(version),0)+1,btrim(coalesce(_codigo,'')),btrim(coalesce(_version,'')),btrim(coalesce(_titulo,'')),firmas,_vigente_desde,btrim(_motivo),auth.uid() FROM public.org_formatos WHERE org_id=org AND tipo=_tipo RETURNING id INTO nid;
 RETURN nid;
END $$;
CREATE OR REPLACE FUNCTION public.documental_solo_insercion() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Registro documental inalterable: guarda una versión nueva'; END IF;
 IF TG_TABLE_NAME NOT IN ('documentos_generados','documento_reservas') AND length(btrim(coalesce(to_jsonb(NEW)->>'motivo','')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
 RETURN NEW;
END $$;