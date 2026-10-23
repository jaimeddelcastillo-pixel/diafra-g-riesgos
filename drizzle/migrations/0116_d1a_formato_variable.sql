CREATE OR REPLACE FUNCTION public.guardar_formato_documento(_tipo text,_codigo text,_version text,_titulo text,_firmas jsonb,_vigente_desde date,_motivo text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.get_user_org_id(); nid uuid; v_firmas jsonb;
BEGIN
 IF org IS NULL OR NOT public.documental_puede_editar() THEN RAISE EXCEPTION 'Sin permiso para editar formatos'; END IF;
 IF length(btrim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
 IF jsonb_typeof(coalesce(_firmas,'[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'Firmas inválidas'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('rol',x->>'rol','aplica',coalesce((x->>'aplica')::boolean,true),'cargo',btrim(coalesce(x->>'cargo','')))),'[]'::jsonb) INTO v_firmas FROM jsonb_array_elements(coalesce(_firmas,'[]'::jsonb)) x WHERE x->>'rol' IN ('Elaboró','Revisó','Autorizó');
 PERFORM pg_advisory_xact_lock(hashtext('formato:'||org||':'||_tipo)); PERFORM set_config('tracea.motivo',btrim(_motivo),true);
 INSERT INTO public.org_formatos(org_id,tipo,version,codigo,version_formato,titulo,firmas,vigente_desde,motivo,created_by) SELECT org,_tipo,coalesce(max(version),0)+1,btrim(coalesce(_codigo,'')),btrim(coalesce(_version,'')),btrim(coalesce(_titulo,'')),v_firmas,_vigente_desde,btrim(_motivo),auth.uid() FROM public.org_formatos WHERE org_id=org AND tipo=_tipo RETURNING id INTO nid;
 RETURN nid;
END $$;