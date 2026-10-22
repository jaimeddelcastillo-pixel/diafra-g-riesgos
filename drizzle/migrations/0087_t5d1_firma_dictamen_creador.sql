ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS dictamen_autoemitido boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.firmar_folio_suplencia(_folio uuid,_hash text,_ip text,_agente text,_compromiso text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f record;e record;s jsonb;v uuid;BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() OR NOT public.mi_org_tiene_modulo('riesgos') THEN RAISE EXCEPTION 'Sin permiso de firma';END IF;
 SELECT * INTO f FROM public.folios WHERE id=_folio AND org_id=public.get_user_org_id() FOR UPDATE;
 IF NOT FOUND OR f.estado<>'En Firma' THEN RAISE EXCEPTION 'Folio no disponible para firma';END IF;
 s:=public.suplencia_contexto(auth.uid(),'responsable_sanitario');
 SELECT * INTO e FROM public.folio_comite WHERE folio_id=_folio AND (user_id=auth.uid() OR (s IS NOT NULL AND public.rol_efectivo(auth.uid(),'responsable_sanitario') AND user_id=(s->>'titular_user_id')::uuid)) ORDER BY (user_id=auth.uid()) DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR e.firmado THEN RAISE EXCEPTION 'No hay firma pendiente asignada al usuario o titular sustituido';END IF;
 IF coalesce(btrim(_hash),'')='' OR coalesce(btrim(_compromiso),'')='' THEN RAISE EXCEPTION 'Hash y compromiso obligatorios';END IF;
 UPDATE public.folio_comite SET firmado=true,fecha_firma=now(),ip_firma=_ip,user_agent=_agente,texto_compromiso=_compromiso,hash_documento=_hash,firma_por=auth.uid(),firma_suplencia=s WHERE id=e.id;
 INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_nuevo) VALUES(auth.uid(),f.org_id,'folio_comite',e.id::text,'FIRMA',jsonb_build_object('folio_id',_folio,'hash_documento',_hash,'firma_por',auth.uid(),'firma_suplencia',s));
 RETURN e.id;END $$;
REVOKE ALL ON FUNCTION public.firmar_folio_suplencia(uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firmar_folio_suplencia(uuid,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.dictaminar_folio_efectivo(_folio uuid,_conclusion text,_motivo text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE f record;s jsonb;v_auto boolean;BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() OR NOT public.mi_org_tiene_modulo('riesgos') OR NOT (public.rol_efectivo(auth.uid(),'responsable_sanitario') OR public.rol_efectivo(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Sin permiso para dictaminar';END IF;
 IF _conclusion NOT IN ('Aprobado','Rechazado') THEN RAISE EXCEPTION 'Conclusión inválida';END IF;
 SELECT * INTO f FROM public.folios WHERE id=_folio AND org_id=public.get_user_org_id() FOR UPDATE;
 IF NOT FOUND OR f.estado<>'En Firma' THEN RAISE EXCEPTION 'Folio no disponible';END IF;
 v_auto:=f.created_by=auth.uid();
 IF v_auto AND btrim(coalesce(_motivo,''))='' THEN RAISE EXCEPTION 'Autoemisión requiere motivo (empresa pequeña)';END IF;
 IF _conclusion='Rechazado' AND btrim(coalesce(_motivo,''))='' THEN RAISE EXCEPTION 'Rechazo requiere motivo';END IF;
 s:=coalesce(public.suplencia_contexto(auth.uid(),'responsable_sanitario'),public.suplencia_contexto(auth.uid(),'admin'));
 UPDATE public.folios SET estado=CASE WHEN _conclusion='Aprobado' THEN 'Aprobado'::public.estado_folio ELSE 'Borrador'::public.estado_folio END,conclusion=_conclusion,dictamen_por=auth.uid(),dictamen_suplencia=s,dictamen_autoemitido=v_auto WHERE id=_folio AND org_id=public.get_user_org_id();
 INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,motivo,valor_anterior,valor_nuevo) VALUES(auth.uid(),f.org_id,'folios',_folio::text,'DICTAMEN',_motivo,jsonb_build_object('estado',f.estado),jsonb_build_object('estado',_conclusion,'dictamen_por',auth.uid(),'dictamen_suplencia',s,'autoemitido',v_auto));
END $$;
REVOKE ALL ON FUNCTION public.dictaminar_folio_efectivo(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dictaminar_folio_efectivo(uuid,text,text) TO authenticated;