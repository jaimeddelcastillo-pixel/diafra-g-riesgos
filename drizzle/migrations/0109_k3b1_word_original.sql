ALTER TABLE public.kpi_reportes ADD COLUMN emision_preparada jsonb;
ALTER TABLE public.documentos_generados ADD COLUMN archivo_path text;
ALTER TABLE public.documentos_generados ADD COLUMN archivo_sha256 text;
COMMENT ON COLUMN public.kpi_reportes.emision_preparada IS 'Server-only reserved snapshot for recoverable Word issuance; never a published report until the stored original is confirmed.';
CREATE POLICY documentos_original_lectura ON storage.objects FOR SELECT TO authenticated USING (bucket_id='documentos-generados' AND EXISTS (SELECT 1 FROM public.documentos_generados d WHERE d.org_id=(SELECT public.get_user_org_id()) AND d.archivo_path=name));
CREATE OR REPLACE FUNCTION public.preparar_emision_kpi_word(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; r kpi_reportes; e text; ley text; reg jsonb; firm jsonb; u uuid:=auth.uid(); f org_formatos; i org_identidad_documental; empresa organizations; token uuid; snap jsonb;
BEGIN
 org:=public.kpi_reporte_preparar('Preparación de Word original');
 SELECT * INTO r FROM kpi_reportes WHERE id=_id AND org_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reporte no encontrado'; END IF;
 IF r.estado='emitido' THEN RETURN jsonb_build_object('emitido',true,'reporte',to_jsonb(r)); END IF;
 IF r.estado<>'borrador' OR r.etapa<>'autorizacion' THEN RAISE EXCEPTION 'El reporte no está listo para autorizar'; END IF;
 IF u=r.elaboro_por OR u=ANY(r.revisores) THEN RAISE EXCEPTION 'Quien autoriza no puede ser quien elaboró ni quien revisó'; END IF;
 ley:=public.kpi_reporte_autoriza(org,u);
 IF ley IS NULL THEN RAISE EXCEPTION 'Solo Aseguramiento de Calidad (o su suplente o designado) autoriza'; END IF;
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=u AND activo AND perfil_confirmado_en IS NOT NULL) THEN RAISE EXCEPTION 'Confirma tu perfil antes de firmar'; END IF;
 e:=public.kpi_reporte_faltantes(r); IF e IS NOT NULL THEN RAISE EXCEPTION '%',e; END IF;
 IF r.emision_preparada IS NOT NULL THEN
  IF r.emision_preparada->>'actor'<>u::text THEN RAISE EXCEPTION 'Otra persona está preparando la emisión'; END IF;
  RETURN r.emision_preparada;
 END IF;
 SELECT * INTO empresa FROM organizations WHERE id=org;
 SELECT * INTO f FROM org_formatos WHERE org_id=org AND tipo='indicadores.reporte_word' ORDER BY version DESC LIMIT 1;
 SELECT * INTO i FROM org_identidad_documental WHERE org_id=org ORDER BY version DESC LIMIT 1;
 reg:=jsonb_build_object('folio','DOC-'||to_char(now() AT TIME ZONE 'America/Mexico_City','YYYY')||'-'||lpad(nextval('public.documentos_generados_folio_seq')::text,6,'0'),'generado_en',now(),'formato',CASE WHEN f.id IS NOT NULL THEN to_jsonb(f) END,'identidad',CASE WHEN i.id IS NOT NULL THEN to_jsonb(i) END,'tipo','indicadores.reporte_word','empresa',empresa.nombre,'logo_origen',empresa.logo_url);
 SELECT jsonb_build_object(
 'elaboro',(SELECT jsonb_build_object('user_id',p.id,'nombre',coalesce(p.nombre,p.email),'cargo',coalesce(p.cargo,''),'fecha',r.created_at) FROM profiles p WHERE p.id=r.elaboro_por),
 'revisaron',(SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'nombre',coalesce(p.nombre,p.email),'cargo',coalesce(p.cargo,''),'fecha',x->>'fecha') ORDER BY x->>'fecha'),'[]'::jsonb) FROM jsonb_array_elements(r.revisiones) x JOIN profiles p ON p.id=(x->>'user_id')::uuid),
 'autorizo',(SELECT jsonb_build_object('user_id',p.id,'nombre',coalesce(p.nombre,p.email),'cargo',coalesce(p.cargo,''),'fecha',now(),'leyenda',ley) FROM profiles p WHERE p.id=u)) INTO firm;
 token:=gen_random_uuid();
 snap:=jsonb_build_object('token',token,'actor',u,'org_id',org,'reporte',to_jsonb(r)||jsonb_build_object('estado','emitido','etapa','cerrado','firmantes',firm,'formato_snapshot',reg,'datos_snapshot',public.kpi_resumen_periodo(r.tipo_periodo,r.periodo_inicio,'{}'),'emitido_en',reg->>'generado_en'),'path',org::text||'/'||(reg->>'folio')||'.docx');
 UPDATE kpi_reportes SET emision_preparada=snap WHERE id=_id AND org_id=org;
 RETURN snap;
END $$;
REVOKE ALL ON FUNCTION public.preparar_emision_kpi_word(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preparar_emision_kpi_word(uuid) TO authenticated;
-- Only the trusted file-producing function can finalize. Actor/company/token are checked against the reservation, not client org_id.
CREATE OR REPLACE FUNCTION public.confirmar_emision_kpi_word(_id uuid,_token uuid,_logo jsonb,_sha256 text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r kpi_reportes; s jsonb; reg jsonb; org uuid; u uuid; path text;
BEGIN
 SELECT * INTO r FROM kpi_reportes WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reporte no encontrado'; END IF;
 s:=r.emision_preparada; org:=r.org_id; u:=(s->>'actor')::uuid; path:=s->>'path';
 IF r.estado='emitido' AND r.formato_snapshot->>'archivo_sha256'=_sha256 THEN RETURN r.formato_snapshot; END IF;
 IF s IS NULL OR s->>'token'<>_token::text OR r.estado<>'borrador' OR r.etapa<>'autorizacion' THEN RAISE EXCEPTION 'Emisión desactualizada'; END IF;
 IF u=r.elaboro_por OR u=ANY(r.revisores) OR public.kpi_reporte_autoriza(org,u) IS NULL THEN RAISE EXCEPTION 'Autorización ya no vigente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=u AND activo AND perfil_confirmado_en IS NOT NULL) THEN RAISE EXCEPTION 'Perfil no confirmado'; END IF;
 IF _sha256 !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='documentos-generados' AND name=path) THEN RAISE EXCEPTION 'El original no está guardado'; END IF;
 IF _logo IS NOT NULL AND _logo<>'null'::jsonb AND ((_logo->>'format') NOT IN ('PNG','JPEG') OR coalesce(_logo->>'dataUrl','') !~ '^data:image/(png|jpeg);base64,') THEN RAISE EXCEPTION 'Logo inválido'; END IF;
 reg:=s->'reporte'->'formato_snapshot'||jsonb_build_object('logo',_logo,'archivo_path',path,'archivo_sha256',_sha256);
 PERFORM set_config('tracea.kpi_reportes_rpc','1',true); PERFORM set_config('tracea.kpi_reportes_transicion','1',true); PERFORM set_config('tracea.motivo','Emisión con Word original inmutable',true);
 INSERT INTO documentos_generados(org_id,folio,tipo,formato_id,identidad_id,formato_version,identidad_version,nombre_archivo,generado_por,generado_en,archivo_path,archivo_sha256)
 VALUES(org,reg->>'folio','indicadores.reporte_word',(reg->'formato'->>'id')::uuid,(reg->'identidad'->>'id')::uuid,(reg->'formato'->>'version')::int,(reg->'identidad'->>'version')::int,r.codigo||'-v'||r.version||'.docx',u,(reg->>'generado_en')::timestamptz,path,_sha256);
 UPDATE kpi_reportes SET estado='emitido',etapa='cerrado',emitido_en=(reg->>'generado_en')::timestamptz,emitido_por=u,firmantes=s->'reporte'->'firmantes',datos_snapshot=s->'reporte'->'datos_snapshot',formato_snapshot=reg,emision_preparada=NULL WHERE id=_id AND org_id=org;
 PERFORM set_config('tracea.kpi_reportes_transicion','',true);
 RETURN reg;
END $$;
REVOKE ALL ON FUNCTION public.confirmar_emision_kpi_word(uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_emision_kpi_word(uuid,uuid,jsonb,text) TO service_role;
CREATE OR REPLACE FUNCTION public.emitir_kpi_reporte(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN RAISE EXCEPTION 'Emite mediante emitir-kpi-word para conservar el Word original'; END $$;
COMMENT ON FUNCTION public.emitir_kpi_reporte(uuid) IS 'DEPRECATED: use emitir-kpi-word, which stores the original before server-only confirmation.';