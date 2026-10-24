ALTER TABLE public.kpi_reporte_config ADD COLUMN textos_fijos boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.guardar_kpi_reporte_textos(_objetivo text, _alcance text, _metodologia text, _autorizadores uuid[], _motivo text, _textos_fijos boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; prev public.kpi_reporte_config; nid uuid; BEGIN
 IF length(trim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
 org:=public.kpi_reporte_preparar(_motivo);
 IF NOT public.kpi_acceso(org,true) THEN RAISE EXCEPTION 'Sin permiso para configurar reportes'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('kpi_reporte_config:'||org::text));
 SELECT * INTO prev FROM public.kpi_reporte_config WHERE org_id=org ORDER BY version DESC LIMIT 1;
 IF coalesce(_autorizadores,'{}') IS DISTINCT FROM coalesce(prev.autorizadores,'{}') THEN
  IF NOT public.rol_efectivo(auth.uid(),'admin') THEN RAISE EXCEPTION 'Solo el admin designa quién autoriza en ausencia de Aseguramiento de Calidad'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(coalesce(_autorizadores,'{}')) a WHERE NOT EXISTS(SELECT 1 FROM public.org_members m JOIN public.profiles p ON p.id=m.user_id AND p.activo WHERE m.org_id=org AND m.user_id=a)) THEN RAISE EXCEPTION 'Autorizador fuera de la empresa'; END IF;
 END IF;
 INSERT INTO public.kpi_reporte_config(org_id,version,objetivo,alcance,metodologia,autorizadores,motivo,created_by,textos_fijos)
 VALUES(org,coalesce(prev.version,0)+1,coalesce(_objetivo,''),coalesce(_alcance,''),coalesce(_metodologia,''),coalesce(_autorizadores,'{}'),trim(_motivo),auth.uid(),coalesce(_textos_fijos,false)) RETURNING id INTO nid;
 RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.guardar_kpi_reporte_textos(text,text,text,uuid[],text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.guardar_kpi_reporte_textos(text,text,text,uuid[],text,boolean) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guardar_kpi_reporte_config(_objetivo text,_alcance text,_metodologia text,_autorizadores uuid[],_motivo text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE fijo boolean; BEGIN
 SELECT textos_fijos INTO fijo FROM public.kpi_reporte_config WHERE org_id=public.get_user_org_id() ORDER BY version DESC LIMIT 1;
 RETURN public.guardar_kpi_reporte_textos(_objetivo,_alcance,_metodologia,_autorizadores,_motivo,coalesce(fijo,false));
END $$;
CREATE OR REPLACE FUNCTION public.kpi_reportes_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE cfg public.kpi_reporte_config; BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Nunca se borra: usa anular'; END IF;
 IF TG_TABLE_NAME IN ('kpi_reportes_historial','kpi_reporte_config') THEN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Registro inmutable'; END IF;
  IF coalesce(current_setting('tracea.kpi_reportes_rpc',true),'')<>'1' THEN RAISE EXCEPTION 'Solo mediante las funciones de reportes'; END IF; RETURN NEW;
 END IF;
 IF coalesce(current_setting('tracea.kpi_reportes_rpc',true),'')<>'1' THEN RAISE EXCEPTION 'Solo mediante las funciones de reportes'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.estado='anulado' THEN RAISE EXCEPTION 'Un reporte anulado no cambia'; END IF;
  IF OLD.estado='emitido' AND coalesce(current_setting('tracea.kpi_reportes_transicion',true),'')<>'1' THEN RAISE EXCEPTION 'Un reporte emitido no se edita'; END IF;
  IF OLD.emision_preparada IS NOT NULL AND coalesce(current_setting('tracea.kpi_reportes_transicion',true),'')<>'1' AND (to_jsonb(NEW)-'emision_preparada'-'updated_at'-'updated_by') IS DISTINCT FROM (to_jsonb(OLD)-'emision_preparada'-'updated_at'-'updated_by') THEN RAISE EXCEPTION 'La emisión está en curso'; END IF;
 END IF;
 IF NEW.estado='borrador' AND NEW.emision_preparada IS NULL THEN
  SELECT * INTO cfg FROM public.kpi_reporte_config WHERE org_id=NEW.org_id ORDER BY version DESC LIMIT 1;
  IF cfg.textos_fijos THEN NEW.objetivo:=cfg.objetivo; NEW.alcance:=cfg.alcance; NEW.metodologia:=cfg.metodologia; END IF;
 END IF;
 NEW.updated_at:=now(); NEW.updated_by:=auth.uid(); RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.preparar_emision_kpi_word(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; r public.kpi_reportes; cfg public.kpi_reporte_config; e text; ley text; reg jsonb; firm jsonb; u uuid:=auth.uid(); f public.org_formatos; i public.org_identidad_documental; empresa public.organizations; token uuid; snap jsonb;
BEGIN
 org:=public.kpi_reporte_preparar('Preparación de Word original');
 SELECT * INTO r FROM public.kpi_reportes WHERE id=_id AND org_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reporte no encontrado'; END IF;
 IF r.estado='emitido' THEN RETURN jsonb_build_object('emitido',true,'reporte',to_jsonb(r)); END IF;
 IF r.estado<>'borrador' OR r.etapa<>'autorizacion' THEN RAISE EXCEPTION 'El reporte no está listo para autorizar'; END IF;
 IF u=r.elaboro_por OR u=ANY(r.revisores) THEN RAISE EXCEPTION 'Quien autoriza no puede ser quien elaboró ni quien revisó'; END IF;
 ley:=public.kpi_reporte_autoriza(org,u);
 IF ley IS NULL THEN RAISE EXCEPTION 'Solo Aseguramiento de Calidad (o su suplente o designado) autoriza'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=u AND activo AND perfil_confirmado_en IS NOT NULL) THEN RAISE EXCEPTION 'Confirma tu perfil antes de firmar'; END IF;
 e:=public.kpi_reporte_faltantes(r); IF e IS NOT NULL THEN RAISE EXCEPTION '%',e; END IF;
 IF r.emision_preparada IS NOT NULL THEN
  IF r.emision_preparada->>'actor'<>u::text THEN RAISE EXCEPTION 'Otra persona está preparando la emisión'; END IF;
  RETURN r.emision_preparada;
 END IF;
 SELECT * INTO cfg FROM public.kpi_reporte_config WHERE org_id=org ORDER BY version DESC LIMIT 1;
 IF cfg.textos_fijos THEN r.objetivo:=cfg.objetivo; r.alcance:=cfg.alcance; r.metodologia:=cfg.metodologia; END IF;
 SELECT * INTO empresa FROM public.organizations WHERE id=org;
 SELECT * INTO f FROM public.org_formatos WHERE org_id=org AND tipo='indicadores.reporte_word' ORDER BY version DESC LIMIT 1;
 SELECT * INTO i FROM public.org_identidad_documental WHERE org_id=org ORDER BY version DESC LIMIT 1;
 reg:=jsonb_build_object('folio','DOC-'||to_char(now() AT TIME ZONE 'America/Mexico_City','YYYY')||'-'||lpad(nextval('public.documentos_generados_folio_seq')::text,6,'0'),'generado_en',now(),'formato',CASE WHEN f.id IS NOT NULL THEN to_jsonb(f) END,'identidad',CASE WHEN i.id IS NOT NULL THEN to_jsonb(i) END,'tipo','indicadores.reporte_word','empresa',empresa.nombre,'logo_origen',empresa.logo_url);
 SELECT jsonb_build_object(
 'elaboro',(SELECT jsonb_build_object('user_id',p.id,'nombre',coalesce(p.nombre,p.email),'cargo',coalesce(p.cargo,''),'fecha',r.created_at) FROM public.profiles p WHERE p.id=r.elaboro_por),
 'revisaron',(SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'nombre',coalesce(p.nombre,p.email),'cargo',coalesce(p.cargo,''),'fecha',x->>'fecha') ORDER BY x->>'fecha'),'[]'::jsonb) FROM jsonb_array_elements(r.revisiones) x JOIN public.profiles p ON p.id=(x->>'user_id')::uuid),
 'autorizo',(SELECT jsonb_build_object('user_id',p.id,'nombre',coalesce(p.nombre,p.email),'cargo',coalesce(p.cargo,''),'fecha',now(),'leyenda',ley) FROM public.profiles p WHERE p.id=u)) INTO firm;
 token:=gen_random_uuid();
 snap:=jsonb_build_object('token',token,'actor',u,'org_id',org,'reporte',to_jsonb(r)||jsonb_build_object('estado','emitido','etapa','cerrado','firmantes',firm,'formato_snapshot',reg,'datos_snapshot',public.kpi_resumen_periodo(r.tipo_periodo,r.periodo_inicio,'{}'),'emitido_en',reg->>'generado_en'),'path',org::text||'/'||(reg->>'folio')||'.docx');
 UPDATE public.kpi_reportes SET emision_preparada=snap WHERE id=_id AND org_id=org;
 RETURN snap;
END $$;