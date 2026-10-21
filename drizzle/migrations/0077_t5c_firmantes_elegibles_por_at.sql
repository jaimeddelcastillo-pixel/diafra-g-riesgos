ALTER TABLE public.tend_formato ADD COLUMN firmantes_elegibles jsonb;
ALTER TABLE public.tend_registros_at ADD COLUMN firmantes_at jsonb;
COMMENT ON COLUMN public.tend_formato.firmantes_elegibles IS 'T5c: elegibles y predeterminado por rol; NULL conserva configuración histórica con firmantes fijos.';
COMMENT ON COLUMN public.tend_registros_at.firmantes_at IS 'T5c: firmantes elegidos por AT, congelados al emitir; NULL conserva comportamiento histórico.';

CREATE FUNCTION public.tend_firmante_autorizante(_org uuid,_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.org_members m JOIN public.profiles p ON p.id=m.user_id
 WHERE m.org_id=_org AND m.user_id=_user AND p.activo AND m.role<>'super_admin' AND
 (m.role='responsable_sanitario' OR EXISTS(SELECT 1 FROM public.org_suplencias s
 WHERE s.org_id=_org AND s.suplente_user_id=_user AND s.revocada_en IS NULL
 AND now()>=s.fecha_inicio AND now()<s.fecha_fin AND 'autorizar'=ANY(s.facultades))))
$fn$;
REVOKE ALL ON FUNCTION public.tend_firmante_autorizante(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.tend_usuarios_firmantes() RETURNS TABLE(id uuid,nombre text,cargo text,puede_autorizar boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $fn$
DECLARE org uuid:=public.get_user_org_id(); BEGIN
 IF org IS NULL OR NOT public.tend_acceso(org) THEN RAISE EXCEPTION 'Sin acceso a Tendencias en la empresa activa'; END IF;
 RETURN QUERY SELECT p.id,p.nombre,p.cargo,public.tend_firmante_autorizante(org,p.id)
 FROM public.org_members m JOIN public.profiles p ON p.id=m.user_id
 WHERE m.org_id=org AND p.activo AND m.role<>'super_admin' ORDER BY p.nombre,p.id;
END $fn$;
REVOKE ALL ON FUNCTION public.tend_usuarios_firmantes() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tend_usuarios_firmantes() TO authenticated,service_role;

CREATE FUNCTION public.tend_validar_elegibles(_org uuid,_config jsonb) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $fn$
DECLARE r jsonb; u jsonb; uid uuid; roles text[]:='{}'; BEGIN
 IF _config IS NULL THEN RETURN; END IF;
 IF jsonb_typeof(_config)<>'array' THEN RAISE EXCEPTION 'Elegibles debe ser una lista por rol'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(_config) LOOP
  IF coalesce(r->>'rol','') NOT IN ('Elaboró','Revisó','Autorizó') OR (r->>'rol')=ANY(roles) OR jsonb_typeof(r->'user_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Rol de elegibles inválido o duplicado'; END IF;
  roles:=array_append(roles,r->>'rol');
  IF (SELECT count(*) FROM jsonb_array_elements(r->'user_ids'))<>(SELECT count(DISTINCT value) FROM jsonb_array_elements(r->'user_ids')) THEN RAISE EXCEPTION 'Usuario elegible duplicado'; END IF;
  FOR u IN SELECT value FROM jsonb_array_elements(r->'user_ids') LOOP
   uid:=(u#>>'{}')::uuid;
   IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.org_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.org_id=_org AND m.user_id=uid AND p.activo AND m.role<>'super_admin') THEN RAISE EXCEPTION 'Elegible no es usuario activo de la empresa'; END IF;
   IF r->>'rol'='Autorizó' AND NOT public.tend_firmante_autorizante(_org,uid) THEN RAISE EXCEPTION 'Autorizó solo admite RS o suplente vigente'; END IF;
  END LOOP;
  IF nullif(r->>'default_user_id','') IS NOT NULL AND NOT (r->'user_ids' ? (r->>'default_user_id')) THEN RAISE EXCEPTION 'Predeterminado no pertenece a elegibles'; END IF;
 END LOOP;
END $fn$;
REVOKE ALL ON FUNCTION public.tend_validar_elegibles(uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.tend_formato_elegibles_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 IF NEW.firmantes_elegibles IS NOT NULL AND (TG_OP='INSERT' OR NEW.firmantes_elegibles IS DISTINCT FROM OLD.firmantes_elegibles) THEN
  IF NEW.org_id IS DISTINCT FROM public.get_user_org_id() OR NOT public.tend_acceso(NEW.org_id,true,ARRAY['admin','responsable_sanitario']) THEN RAISE EXCEPTION 'Solo admin/RS configura elegibles de la empresa activa'; END IF;
  PERFORM public.tend_validar_elegibles(NEW.org_id,NEW.firmantes_elegibles);
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER z_tend_formato_elegibles BEFORE INSERT OR UPDATE ON public.tend_formato FOR EACH ROW EXECUTE FUNCTION public.tend_formato_elegibles_guard();

CREATE FUNCTION public.tend_validar_firmantes_at(_org uuid,_firmantes jsonb,_elegibles jsonb,_emitir boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $fn$
DECLARE f jsonb; uid uuid; p record; r text; permitidos jsonb; salida jsonb:='[]'; claves text[]:='{}'; cuenta_aut integer:=0; BEGIN
 IF jsonb_typeof(_firmantes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Firmantes AT debe ser una lista'; END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(_firmantes) LOOP
  r:=f->>'rol';
  IF r IS NULL OR r NOT IN ('Elaboró','Revisó','Autorizó') THEN RAISE EXCEPTION 'Rol de firmante inválido'; END IF;
  uid:=(f->>'user_id')::uuid;
  IF uid IS NULL THEN RAISE EXCEPTION 'Firmante requiere usuario real'; END IF;
  SELECT pr.nombre,pr.cargo INTO p FROM public.org_members m JOIN public.profiles pr ON pr.id=m.user_id WHERE m.org_id=_org AND m.user_id=uid AND pr.activo AND m.role<>'super_admin';
  IF NOT FOUND THEN RAISE EXCEPTION 'Firmante no es usuario activo de la empresa'; END IF;
  IF (r||':'||uid::text)=ANY(claves) THEN RAISE EXCEPTION 'Firmante duplicado en el mismo rol'; END IF;
  claves:=array_append(claves,r||':'||uid::text);
  IF r='Autorizó' THEN
   cuenta_aut:=cuenta_aut+1;
   IF cuenta_aut>1 THEN RAISE EXCEPTION 'Autorizó admite un solo firmante'; END IF;
   IF NOT public.tend_firmante_autorizante(_org,uid) THEN RAISE EXCEPTION 'Autorizó solo admite RS o suplente vigente'; END IF;
  END IF;
  IF _elegibles IS NOT NULL THEN
   SELECT value->'user_ids' INTO permitidos FROM jsonb_array_elements(_elegibles) WHERE value->>'rol'=r;
   IF NOT coalesce(permitidos ? uid::text,false) AND NOT (r='Elaboró' AND uid=auth.uid()) THEN RAISE EXCEPTION 'Firmante no pertenece a los elegibles de su rol'; END IF;
  END IF;
  salida:=salida||jsonb_build_array(jsonb_build_object('rol',r,'user_id',uid,'nombre',coalesce(f->>'nombre',p.nombre,''),'cargo',coalesce(f->>'cargo',p.cargo,'')));
 END LOOP;
 IF _emitir AND (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(salida) WHERE value->>'rol'='Elaboró') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(salida) WHERE value->>'rol'='Revisó') OR cuenta_aut<>1) THEN RAISE EXCEPTION 'Selecciona Elaboró, Revisó y Autorizó antes de emitir'; END IF;
 IF _emitir AND EXISTS(SELECT 1 FROM jsonb_array_elements(salida) WHERE coalesce(btrim(value->>'nombre'),'')='' OR coalesce(btrim(value->>'cargo'),'')='') THEN RAISE EXCEPTION 'Cada firmante requiere nombre y cargo antes de emitir'; END IF;
 RETURN salida;
END $fn$;
REVOKE ALL ON FUNCTION public.tend_validar_firmantes_at(uuid,jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.tend_at_firmantes_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE config jsonb; autor record; BEGIN
 IF NEW.firmantes_at IS NULL THEN
  IF TG_OP='UPDATE' AND OLD.firmantes_at IS NOT NULL THEN RAISE EXCEPTION 'No se puede eliminar la lista de firmantes AT'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.estado<>'borrador' AND NEW.firmantes_at IS DISTINCT FROM OLD.firmantes_at THEN RAISE EXCEPTION 'Firmantes emitidos inmutables'; END IF;
  IF NEW.estado='anulado' OR (OLD.estado<>'borrador' AND NEW.estado='borrador') THEN RETURN NEW; END IF;
 END IF;
 IF NEW.org_id IS DISTINCT FROM public.get_user_org_id() OR NOT public.tend_acceso(NEW.org_id,true) THEN RAISE EXCEPTION 'Sin permiso de firmantes en la empresa activa'; END IF;
 SELECT firmantes_elegibles INTO config FROM public.tend_formato WHERE org_id=NEW.org_id ORDER BY version DESC LIMIT 1;
 IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.firmantes_at) WHERE value->>'rol'='Elaboró' AND value->>'user_id'=auth.uid()::text) THEN
  SELECT nombre,cargo INTO autor FROM public.profiles WHERE id=auth.uid() AND activo;
  NEW.firmantes_at:=NEW.firmantes_at||jsonb_build_array(jsonb_build_object('rol','Elaboró','user_id',auth.uid(),'nombre',coalesce(autor.nombre,''),'cargo',coalesce(autor.cargo,'')));
 END IF;
 NEW.firmantes_at:=public.tend_validar_firmantes_at(NEW.org_id,NEW.firmantes_at,config,NEW.estado='emitido');
 RETURN NEW;
END $fn$;
CREATE TRIGGER u_tend_at_firmantes BEFORE INSERT OR UPDATE ON public.tend_registros_at FOR EACH ROW EXECUTE FUNCTION public.tend_at_firmantes_guard();

CREATE FUNCTION public.tend_at_firmantes_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND OLD.estado='borrador' AND NEW.estado='emitido' AND NEW.firmantes_at IS NOT NULL THEN
  NEW.formato_snapshot:=jsonb_set(NEW.formato_snapshot,'{firmantes}',NEW.firmantes_at,true);
  NEW.datos_snapshot:=jsonb_set(NEW.datos_snapshot,'{registro_at,firmantes_at}',NEW.firmantes_at,true);
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER zzz_tend_at_firmantes_snapshot BEFORE INSERT OR UPDATE ON public.tend_registros_at FOR EACH ROW EXECUTE FUNCTION public.tend_at_firmantes_snapshot();

DO $patch$
DECLARE fuente text; vieja text; nueva text; BEGIN
 SELECT pg_get_functiondef('public.tend_at_guard()'::regprocedure) INTO fuente;
 vieja:='''seleccion'',''ia_origen'',''updated_at'',''updated_by''';
 nueva:='''seleccion'',''ia_origen'',''firmantes_at'',''updated_at'',''updated_by''';
 IF position(vieja IN fuente)=0 THEN RAISE EXCEPTION 'No se encontró la lista de edición del guard AT'; END IF;
 EXECUTE replace(fuente,vieja,nueva);
END $patch$;