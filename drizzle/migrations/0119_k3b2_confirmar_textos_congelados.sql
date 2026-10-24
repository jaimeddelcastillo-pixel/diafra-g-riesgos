CREATE OR REPLACE FUNCTION public.confirmar_emision_kpi_word(_id uuid, _token uuid, _logo jsonb, _sha256 text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.kpi_reportes; s jsonb; reg jsonb; org uuid; u uuid; path text;
BEGIN
 SELECT * INTO r FROM public.kpi_reportes WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reporte no encontrado'; END IF;
 s:=r.emision_preparada; org:=r.org_id; u:=(s->>'actor')::uuid; path:=s->>'path';
 IF r.estado='emitido' AND r.formato_snapshot->>'archivo_sha256'=_sha256 THEN RETURN r.formato_snapshot; END IF;
 IF s IS NULL OR s->>'token'<>_token::text OR r.estado<>'borrador' OR r.etapa<>'autorizacion' THEN RAISE EXCEPTION 'Emisión desactualizada'; END IF;
 IF u=r.elaboro_por OR u=ANY(r.revisores) OR public.kpi_reporte_autoriza(org,u) IS NULL THEN RAISE EXCEPTION 'Autorización ya no vigente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=u AND activo AND perfil_confirmado_en IS NOT NULL) THEN RAISE EXCEPTION 'Perfil no confirmado'; END IF;
 IF _sha256 !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='documentos-generados' AND name=path) THEN RAISE EXCEPTION 'El original no está guardado'; END IF;
 IF s ? 'logo' AND s->'logo' IS DISTINCT FROM coalesce(_logo,'null'::jsonb) THEN RAISE EXCEPTION 'El logo difiere del congelado'; END IF;
 IF _logo IS NOT NULL AND _logo<>'null'::jsonb AND ((_logo->>'format') NOT IN ('PNG','JPEG') OR coalesce(_logo->>'dataUrl','') !~ '^data:image/(png|jpeg);base64,') THEN RAISE EXCEPTION 'Logo inválido'; END IF;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('request.jwt.claims',(coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb||jsonb_build_object('sub',u))::text,true);
 reg:=s->'reporte'->'formato_snapshot'||jsonb_build_object('logo',_logo,'archivo_path',path,'archivo_sha256',_sha256);
 PERFORM set_config('tracea.kpi_reportes_rpc','1',true); PERFORM set_config('tracea.kpi_reportes_transicion','1',true); PERFORM set_config('tracea.motivo','Emisión con Word original inmutable',true);
 INSERT INTO public.documentos_generados(org_id,folio,tipo,formato_id,identidad_id,formato_version,identidad_version,nombre_archivo,generado_por,generado_en,archivo_path,archivo_sha256)
 VALUES(org,reg->>'folio','indicadores.reporte_word',(reg->'formato'->>'id')::uuid,(reg->'identidad'->>'id')::uuid,(reg->'formato'->>'version')::int,(reg->'identidad'->>'version')::int,r.codigo||'-v'||r.version||'.docx',u,(reg->>'generado_en')::timestamptz,path,_sha256);
 UPDATE public.kpi_reportes SET estado='emitido',etapa='cerrado',objetivo=s->'reporte'->>'objetivo',alcance=s->'reporte'->>'alcance',metodologia=s->'reporte'->>'metodologia',emitido_en=(reg->>'generado_en')::timestamptz,emitido_por=u,firmantes=s->'reporte'->'firmantes',datos_snapshot=s->'reporte'->'datos_snapshot',formato_snapshot=reg,emision_preparada=NULL WHERE id=_id AND org_id=org;
 PERFORM set_config('tracea.kpi_reportes_transicion','',true);
 RETURN reg;
END $$;