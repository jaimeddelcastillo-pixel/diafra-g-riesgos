CREATE OR REPLACE FUNCTION public.audit_suplencia_contexto()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE v jsonb;v_org uuid;v_clave text;v_cache text; BEGIN
 IF NEW.user_id IS NULL THEN RETURN NEW;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.org_suplencias s WHERE s.suplente_user_id=NEW.user_id AND s.org_id=NEW.org_id AND s.estado='activa' AND s.aceptada_en IS NOT NULL AND s.revocada_en IS NULL AND s.fecha_inicio<=now() AND now()<s.fecha_fin) THEN RETURN NEW; END IF;
 -- P1-a: el contexto de suplencia se resuelve una vez por sentencia del cliente (misma transacción, actor y empresa), no por renglón.
 v_clave:=pg_current_xact_id()::text||'|'||statement_timestamp()::text||'|'||NEW.user_id::text||'|'||NEW.org_id::text||'|'||coalesce(auth.role(),'')||'|';
 v_cache:=coalesce(current_setting('tracea.supl_ctx',true),'');
 IF v_cache<>'' AND left(v_cache,length(v_clave))=v_clave THEN
  v:=nullif(substr(v_cache,length(v_clave)+1),'')::jsonb;
 ELSE
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
  PERFORM set_config('tracea.supl_ctx',v_clave||coalesce(v::text,''),true);
 END IF;
 NEW.suplencias:=v;
 IF v IS NOT NULL THEN NEW.valor_nuevo:=coalesce(NEW.valor_nuevo,'{}'::jsonb)||jsonb_build_object('_suplencias',v); END IF;
 RETURN NEW;END $function$;