CREATE OR REPLACE FUNCTION public.contexto_borrador_kpi_word(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid:=public.get_user_org_id(); r public.kpi_reportes; cfg public.kpi_reporte_config; f public.org_formatos; i public.org_identidad_documental; empresa public.organizations; BEGIN
 IF org IS NULL OR auth.uid() IS NULL OR NOT public.kpi_acceso(org) THEN RAISE EXCEPTION 'Sin acceso a Indicadores'; END IF;
 SELECT * INTO r FROM public.kpi_reportes WHERE id=_id AND org_id=org;
 IF NOT FOUND OR r.estado<>'borrador' THEN RAISE EXCEPTION 'Borrador no encontrado'; END IF;
 SELECT * INTO cfg FROM public.kpi_reporte_config WHERE org_id=org ORDER BY version DESC LIMIT 1;
 IF cfg.textos_fijos AND r.emision_preparada IS NULL THEN r.objetivo:=cfg.objetivo; r.alcance:=cfg.alcance; r.metodologia:=cfg.metodologia; END IF;
 SELECT * INTO f FROM public.org_formatos WHERE org_id=org AND tipo='indicadores.reporte_word' ORDER BY version DESC LIMIT 1;
 SELECT * INTO i FROM public.org_identidad_documental WHERE org_id=org ORDER BY version DESC LIMIT 1;
 SELECT * INTO empresa FROM public.organizations WHERE id=org;
 RETURN jsonb_build_object('reporte',to_jsonb(r),'registro',jsonb_build_object('folio','','generado_en',now(),'formato',CASE WHEN f.id IS NOT NULL THEN to_jsonb(f) END,'identidad',CASE WHEN i.id IS NOT NULL THEN to_jsonb(i) END,'empresa',empresa.nombre,'logo_path',empresa.logo_url));
END $$;
REVOKE ALL ON FUNCTION public.contexto_borrador_kpi_word(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contexto_borrador_kpi_word(uuid) TO authenticated,service_role;