ALTER TABLE public.audit_trail ADD COLUMN IF NOT EXISTS suplencias jsonb;
ALTER TABLE public.folio_comite ADD COLUMN IF NOT EXISTS firma_por uuid, ADD COLUMN IF NOT EXISTS firma_suplencia jsonb;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS dictamen_por uuid, ADD COLUMN IF NOT EXISTS dictamen_suplencia jsonb;
CREATE OR REPLACE FUNCTION public.suplencia_contexto(_usuario uuid,_rol public.app_role)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('suplencia_id',s.id,'rol',s.rol_sustituido,'titular_user_id',coalesce(s.titular_user_id,s.rs_titular_user_id),'titular_nombre',coalesce(s.titular_nombre,s.rs_titular_nombre),'actor_user_id',_usuario,'leyenda','por suplencia de '||coalesce(s.titular_nombre,s.rs_titular_nombre,''))
 FROM public.org_suplencias s WHERE s.org_id=public.get_user_org_id() AND s.suplente_user_id=_usuario AND s.rol_sustituido=_rol::text
 AND public.rol_efectivo(_usuario,_rol) AND s.estado='activa' AND s.aceptada_en IS NOT NULL AND s.revocada_en IS NULL AND s.fecha_inicio<=now() AND now()<s.fecha_fin
 AND NOT EXISTS(SELECT 1 FROM public.org_members m WHERE m.org_id=s.org_id AND m.user_id=_usuario AND m.role=_rol) LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.suplencia_contexto(uuid,public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suplencia_contexto(uuid,public.app_role) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.audit_suplencia_contexto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v jsonb;v_org uuid; BEGIN
 IF NEW.user_id IS NULL THEN RETURN NEW;END IF;
 v_org:=public.get_user_org_id();
 IF v_org IS NULL AND auth.role()='service_role' THEN
 SELECT jsonb_agg(jsonb_build_object('suplencia_id',s.id,'rol',s.rol_sustituido,'titular_user_id',coalesce(s.titular_user_id,s.rs_titular_user_id),'titular_nombre',coalesce(s.titular_nombre,s.rs_titular_nombre),'actor_user_id',NEW.user_id,'leyenda','por suplencia de '||coalesce(s.titular_nombre,s.rs_titular_nombre,''))) INTO v
 FROM public.org_suplencias s JOIN public.org_members m ON m.org_id=s.org_id AND m.user_id=NEW.user_id JOIN public.profiles p ON p.id=m.user_id AND p.activo
 JOIN public.org_members t ON t.org_id=s.org_id AND t.user_id=coalesce(s.titular_user_id,s.rs_titular_user_id) AND t.role::text=s.rol_sustituido
 JOIN public.profiles tp ON tp.id=t.user_id AND tp.activo
 WHERE s.org_id=NEW.org_id AND s.suplente_user_id=NEW.user_id AND s.estado='activa' AND s.aceptada_en IS NOT NULL AND s.revocada_en IS NULL AND s.fecha_inicio<=now() AND now()<s.fecha_fin AND m.role::text<>s.rol_sustituido;
 ELSIF NEW.org_id=v_org THEN
 SELECT jsonb_agg(x) INTO v FROM (SELECT public.suplencia_contexto(NEW.user_id,r) x FROM unnest(ARRAY['admin','responsable_sanitario']::public.app_role[]) r) a WHERE x IS NOT NULL;
 END IF;
 NEW.suplencias:=v;
 IF v IS NOT NULL THEN NEW.valor_nuevo:=coalesce(NEW.valor_nuevo,'{}'::jsonb)||jsonb_build_object('_suplencias',v); END IF;
 RETURN NEW;END $$;
CREATE TRIGGER audit_suplencia_contexto BEFORE INSERT ON public.audit_trail FOR EACH ROW EXECUTE FUNCTION public.audit_suplencia_contexto();
CREATE OR REPLACE FUNCTION public.firmar_folio_suplencia(_folio uuid,_hash text,_ip text,_agente text,_compromiso text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f record;e record;s jsonb;v uuid;BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() OR NOT public.mi_org_tiene_modulo('riesgos') THEN RAISE EXCEPTION 'Sin permiso de firma';END IF;
 SELECT * INTO f FROM public.folios WHERE id=_folio AND org_id=public.get_user_org_id() FOR UPDATE;
 IF NOT FOUND OR f.estado<>'En Firma' THEN RAISE EXCEPTION 'Folio no disponible para firma';END IF;
 IF f.created_by=auth.uid() THEN RAISE EXCEPTION 'Separación de funciones: quien elaboró no firma';END IF;
 s:=public.suplencia_contexto(auth.uid(),'responsable_sanitario');
 SELECT * INTO e FROM public.folio_comite WHERE folio_id=_folio AND (user_id=auth.uid() OR (s IS NOT NULL AND public.rol_efectivo(auth.uid(),'responsable_sanitario') AND user_id=(s->>'titular_user_id')::uuid)) ORDER BY (user_id=auth.uid()) DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR e.firmado THEN RAISE EXCEPTION 'No hay firma pendiente asignada al usuario o titular sustituido';END IF;
 IF coalesce(btrim(_hash),'')='' OR coalesce(btrim(_compromiso),'')='' THEN RAISE EXCEPTION 'Hash y compromiso obligatorios';END IF;
 UPDATE public.folio_comite SET firmado=true,fecha_firma=now(),ip_firma=_ip,user_agent=_agente,texto_compromiso=_compromiso,hash_documento=_hash,firma_por=auth.uid(),firma_suplencia=s WHERE id=e.id;
 INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_nuevo) VALUES(auth.uid(),f.org_id,'folio_comite',e.id::text,'FIRMA',jsonb_build_object('folio_id',_folio,'hash_documento',_hash,'firma_por',auth.uid(),'firma_suplencia',s));
 RETURN e.id;END $$;
REVOKE ALL ON FUNCTION public.firmar_folio_suplencia(uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firmar_folio_suplencia(uuid,text,text,text,text) TO authenticated;
DO $$ DECLARE d text;BEGIN
 SELECT pg_get_functiondef('public.tend_at_guard()'::regprocedure) INTO d;
 d:=replace(d,'public.has_role(auth.uid(),''responsable_sanitario'')','public.rol_efectivo(auth.uid(),''responsable_sanitario'')');
 d:=replace(d,'IF su IS NOT NULL OR NEW.estado=''anulado'' OR NOT coalesce(v_auto,false) THEN','IF true THEN');
 EXECUTE d;
END $$;
