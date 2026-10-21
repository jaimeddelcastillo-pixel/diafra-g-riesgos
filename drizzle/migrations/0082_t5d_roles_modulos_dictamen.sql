DO $$ DECLARE p record;d text;antes text;BEGIN
FOR p IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['brain_documents_estado_guard','org_documentos_copia_guard','brain_knowledge_items_revision_guard','brain_knowledge_items_governance','retirar_documento','brain_resolver_enlace','confirmar_catalogo_documentos','puede_editar_catalogo_documentos','pendientes_configuracion','pendientes_riesgos','pendientes_cerebro']) LOOP
 d:=pg_get_functiondef(p.oid);antes:=d;
 d:=replace(d,'v_ctx.rol_en_org IN (''admin'',''responsable_sanitario'')','(public.rol_efectivo(auth.uid(),''admin'') OR public.rol_efectivo(auth.uid(),''responsable_sanitario''))');
 d:=replace(d,'coalesce(v_ctx.rol_en_org,'''') NOT IN (''admin'',''responsable_sanitario'',''super_admin'')','NOT (v_ctx.es_super_admin OR public.rol_efectivo(auth.uid(),''admin'') OR public.rol_efectivo(auth.uid(),''responsable_sanitario''))');
 d:=replace(d,'v_rol NOT IN (''admin'',''responsable_sanitario'')','NOT (public.rol_efectivo(auth.uid(),''admin'') OR public.rol_efectivo(auth.uid(),''responsable_sanitario''))');
 d:=replace(d,'v_rol NOT IN (''admin'',''responsable_sanitario'',''super_admin'')','NOT (public.is_super_admin() OR public.rol_efectivo(auth.uid(),''admin'') OR public.rol_efectivo(auth.uid(),''responsable_sanitario''))');
 d:=replace(d,'c.rol_en_org IN (''admin'',''responsable_sanitario'',''super_admin'')','(c.es_super_admin OR public.rol_efectivo(auth.uid(),''admin'') OR public.rol_efectivo(auth.uid(),''responsable_sanitario''))');
 d:=replace(d,'v_rol IN (''admin'',''responsable_sanitario'')','(public.rol_efectivo(auth.uid(),''admin'') OR public.rol_efectivo(auth.uid(),''responsable_sanitario''))');
 IF d=antes THEN RAISE EXCEPTION 'No se migró la comprobación de %',p.proname;END IF;
 EXECUTE d;
END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.dictaminar_folio_efectivo(_folio uuid,_conclusion text,_motivo text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE f record;s jsonb;BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() OR NOT public.mi_org_tiene_modulo('riesgos') OR NOT (public.rol_efectivo(auth.uid(),'responsable_sanitario') OR public.rol_efectivo(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Sin permiso para dictaminar';END IF;
 IF _conclusion NOT IN ('Aprobado','Rechazado') THEN RAISE EXCEPTION 'Conclusión inválida';END IF;
 SELECT * INTO f FROM public.folios WHERE id=_folio AND org_id=public.get_user_org_id() FOR UPDATE;
 IF NOT FOUND OR f.estado<>'En Firma' THEN RAISE EXCEPTION 'Folio no disponible';END IF;
 IF f.created_by=auth.uid() THEN RAISE EXCEPTION 'Separación de funciones: elaborador no autoriza';END IF;
 IF _conclusion='Rechazado' AND btrim(coalesce(_motivo,''))='' THEN RAISE EXCEPTION 'Rechazo requiere motivo';END IF;
 s:=coalesce(public.suplencia_contexto(auth.uid(),'responsable_sanitario'),public.suplencia_contexto(auth.uid(),'admin'));
 UPDATE public.folios SET estado=CASE WHEN _conclusion='Aprobado' THEN 'Aprobado'::public.estado_folio ELSE 'Borrador'::public.estado_folio END,conclusion=_conclusion,dictamen_por=auth.uid(),dictamen_suplencia=s WHERE id=_folio AND org_id=public.get_user_org_id();
 INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,motivo,valor_anterior,valor_nuevo) VALUES(auth.uid(),f.org_id,'folios',_folio::text,'DICTAMEN',_motivo,jsonb_build_object('estado',f.estado),jsonb_build_object('estado',_conclusion,'dictamen_por',auth.uid(),'dictamen_suplencia',s));
END $$;
REVOKE ALL ON FUNCTION public.dictaminar_folio_efectivo(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dictaminar_folio_efectivo(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.registro_suplencia_contexto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v jsonb;BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW;END IF;
 SELECT jsonb_agg(x) INTO v FROM (SELECT public.suplencia_contexto(auth.uid(),r) x FROM unnest(ARRAY['admin','responsable_sanitario']::public.app_role[]) r) a WHERE x IS NOT NULL;
 NEW.ultima_suplencia:=v;RETURN NEW;END $$;
DO $$ DECLARE t record;BEGIN
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relname=ANY(ARRAY['folios','riesgos','brain_knowledge_items','brain_documents','brain_gaps','brain_contradictions','brain_interview_assignments','brain_interview_sessions','brain_knowledge_sources','brain_memoria_viva','tend_registros','tend_semanas','tend_registros_at','tend_instrumentos','tend_areas','tend_sistemas_hvac','tend_objetivos_presion','tend_cambios_filtro','tend_formato','tend_config','org_documentos','organizations','documento_tipos','documento_tipos_config']) LOOP
 EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS ultima_suplencia jsonb',t.relname);
 EXECUTE format('CREATE TRIGGER zzzz_registro_suplencia BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.registro_suplencia_contexto()',t.relname);
 END LOOP;END $$;
