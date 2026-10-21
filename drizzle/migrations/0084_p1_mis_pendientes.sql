ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perfil_confirmado_en timestamptz;

CREATE TABLE IF NOT EXISTS public.org_pendientes_semaforo(
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id),
  operativo_naranja integer NOT NULL DEFAULT 3,
  operativo_rojo integer NOT NULL DEFAULT 7,
  gestion_naranja integer NOT NULL DEFAULT 10,
  gestion_rojo integer NOT NULL DEFAULT 20,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT semaforo_orden CHECK (operativo_naranja>=1 AND operativo_rojo>operativo_naranja AND gestion_naranja>=1 AND gestion_rojo>gestion_naranja)
);
GRANT SELECT ON public.org_pendientes_semaforo TO authenticated;
GRANT ALL ON public.org_pendientes_semaforo TO service_role;
ALTER TABLE public.org_pendientes_semaforo ENABLE ROW LEVEL SECURITY;
CREATE POLICY semaforo_lectura ON public.org_pendientes_semaforo FOR SELECT TO authenticated USING (org_id=public.get_user_org_id());
CREATE TRIGGER org_pendientes_semaforo_audit AFTER INSERT OR UPDATE ON public.org_pendientes_semaforo FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE OR REPLACE FUNCTION public.pendientes_color(_perfil text,_dias integer,_vencida boolean,_on integer,_or integer,_gn integer,_gr integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
SELECT CASE WHEN _vencida THEN 'rojo'
 WHEN _dias>=(CASE WHEN _perfil='operativo' THEN _or ELSE _gr END) THEN 'rojo'
 WHEN _dias>=(CASE WHEN _perfil='operativo' THEN _on ELSE _gn END) THEN 'naranja'
 ELSE 'verde' END $$;

CREATE OR REPLACE FUNCTION public.guardar_semaforo_pendientes(_operativo_naranja integer,_operativo_rojo integer,_gestion_naranja integer,_gestion_rojo integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.get_user_org_id(); BEGIN
 IF org IS NULL OR NOT (public.rol_efectivo(auth.uid(),'admin') OR public.rol_efectivo(auth.uid(),'responsable_sanitario')) THEN RAISE EXCEPTION 'Solo admin o RS configuran el semáforo'; END IF;
 INSERT INTO public.org_pendientes_semaforo(org_id,operativo_naranja,operativo_rojo,gestion_naranja,gestion_rojo,updated_at,updated_by)
 VALUES(org,_operativo_naranja,_operativo_rojo,_gestion_naranja,_gestion_rojo,now(),auth.uid())
 ON CONFLICT (org_id) DO UPDATE SET operativo_naranja=EXCLUDED.operativo_naranja,operativo_rojo=EXCLUDED.operativo_rojo,gestion_naranja=EXCLUDED.gestion_naranja,gestion_rojo=EXCLUDED.gestion_rojo,updated_at=now(),updated_by=auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.confirmar_perfil(_nombre text,_cargo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida'; END IF;
 IF coalesce(btrim(_nombre),'')='' OR coalesce(btrim(_cargo),'')='' THEN RAISE EXCEPTION 'Nombre completo y cargo son obligatorios'; END IF;
 UPDATE public.profiles SET nombre=btrim(_nombre),cargo=btrim(_cargo),perfil_confirmado_en=now(),updated_at=now() WHERE id=auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.suplencias_traslape(_rol public.app_role,_inicio timestamptz,_fin timestamptz)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT count(*)::integer FROM public.org_suplencias s
WHERE s.org_id=public.get_user_org_id() AND s.rol_sustituido=_rol::text AND s.estado='activa' AND s.revocada_en IS NULL AND s.terminada_en IS NULL
 AND s.fecha_inicio<_fin AND _inicio<s.fecha_fin
 AND (public.rol_efectivo(auth.uid(),'admin') OR public.rol_efectivo(auth.uid(),'responsable_sanitario')) $$;

CREATE OR REPLACE FUNCTION public.pendientes_usuario(_alcance text DEFAULT 'mio')
RETURNS TABLE(modulo text,tipo text,registro uuid,titulo text,ruta text,nace_en timestamptz,fecha_limite date,perfil text,dias integer,color text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.get_user_org_id(); u uuid:=auth.uid(); es_rs boolean; es_adm boolean; es_op boolean; emp boolean:=(_alcance='empresa');
 hoy date:=(now() AT TIME ZONE 'America/Mexico_City')::date; c record; m_t boolean; m_r boolean; m_c boolean;
BEGIN
 IF org IS NULL OR u IS NULL THEN RETURN; END IF;
 es_rs:=public.rol_efectivo(u,'responsable_sanitario'); es_adm:=public.rol_efectivo(u,'admin');
 es_op:=es_rs OR es_adm OR public.rol_efectivo(u,'operador') OR public.rol_efectivo(u,'comite_tecnico');
 IF emp AND NOT (es_rs OR es_adm) THEN RAISE EXCEPTION 'Solo admin o RS ven los pendientes de la empresa'; END IF;
 IF NOT emp AND NOT EXISTS(SELECT 1 FROM public.org_members om WHERE om.org_id=org AND om.user_id=u) THEN RETURN; END IF;
 SELECT coalesce(max(s.operativo_naranja),3) o_n,coalesce(max(s.operativo_rojo),7) o_r,coalesce(max(s.gestion_naranja),10) g_n,coalesce(max(s.gestion_rojo),20) g_r INTO c FROM public.org_pendientes_semaforo s WHERE s.org_id=org;
 m_t:=public.org_tiene_modulo(org,'tendencias'); m_r:=public.org_tiene_modulo(org,'riesgos'); m_c:=public.org_tiene_modulo(org,'institutional_brain');
 RETURN QUERY WITH b(modulo,tipo,registro,titulo,ruta,nace_en,fecha_limite,perfil) AS (
  SELECT 'plataforma'::text,'perfil_sin_confirmar'::text,p.id,CASE WHEN emp AND p.id<>u THEN 'Perfil sin confirmar: '||coalesce(p.nombre,p.email) ELSE 'Confirma tu nombre completo y tu cargo' END,'/pendientes?confirmar=perfil'::text,coalesce(p.created_at,now()),NULL::date,'operativo'::text
  FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id
  WHERE om.org_id=org AND p.activo AND om.role<>'super_admin' AND p.perfil_confirmado_en IS NULL AND (emp OR p.id=u)
  UNION ALL
  SELECT 'plataforma','suplencia_por_aceptar',s.id,'Aceptar suplencia de '||CASE s.rol_sustituido WHEN 'admin' THEN 'Administrador' ELSE 'Responsable Sanitario' END||coalesce(' de '||coalesce(s.titular_nombre,s.rs_titular_nombre),''),'/configuracion/suplencias',s.created_at,(s.fecha_inicio AT TIME ZONE 'America/Mexico_City')::date,'operativo'
  FROM public.org_suplencias s WHERE s.org_id=org AND s.estado='pendiente de aceptación' AND s.revocada_en IS NULL AND s.fecha_fin>now() AND (emp OR s.suplente_user_id=u)
  UNION ALL
  SELECT 'tendencias','at_borrador',a.id,'AT '||coalesce(a.codigo,'sin código')||' en borrador','/tendencias/reporte/'||a.id,a.created_at,NULL::date,'gestion'
  FROM public.tend_registros_at a WHERE m_t AND a.org_id=org AND a.estado='borrador' AND (emp OR es_rs)
  UNION ALL
  SELECT 'tendencias','semana_sin_captura',r.id,r.nombre||' · semana del '||to_char(w.ini,'DD-MM-YYYY'),'/tendencias/captura?registro='||r.id,((w.ini+7)::timestamp AT TIME ZONE 'America/Mexico_City'),NULL::date,'operativo'
  FROM public.tend_registros r
  CROSS JOIN LATERAL (SELECT least(date_trunc('week',(r.created_at AT TIME ZONE 'America/Mexico_City'))::date,
     coalesce((SELECT date_trunc('week',min(x.semana_inicio))::date FROM public.tend_semanas x WHERE x.registro_id=r.id AND x.activo),'infinity'::date)) primero) i
  CROSS JOIN LATERAL generate_series(i.primero,hoy-7,interval '7 day') g(d)
  CROSS JOIN LATERAL (SELECT g.d::date ini) w
  WHERE m_t AND r.org_id=org AND r.activo AND (emp OR es_op)
   AND NOT EXISTS(SELECT 1 FROM public.tend_semanas x WHERE x.registro_id=r.id AND x.activo AND x.semana_inicio BETWEEN w.ini AND w.ini+6)
  UNION ALL
  SELECT 'riesgos','accion_abierta',ri.id,coalesce(f.codigo,'Folio')||' · R'||ri.numero_id||': acción pendiente','/folios/'||f.id,ri.created_at,ri.fecha_compromiso,'gestion'
  FROM public.riesgos ri JOIN public.folios f ON f.id=ri.folio_id
  WHERE m_r AND f.org_id=org AND f.estado NOT IN ('Cancelado','Cerrado') AND ri.requiere_accion AND ri.fecha_compromiso IS NOT NULL AND coalesce(btrim(ri.accion_implementada),'')=''
   AND (emp OR es_rs OR es_adm OR f.created_by=u)
  UNION ALL
  SELECT 'riesgos','folio_en_firma',f.id,coalesce(f.codigo,'Folio')||' en firma','/folios/'||f.id,f.updated_at,NULL::date,'gestion'
  FROM public.folios f WHERE m_r AND f.org_id=org AND f.estado='En Firma' AND (emp OR es_rs)
  UNION ALL
  SELECT 'institutional_brain','conocimiento_por_validar',k.id,'Conocimiento '||coalesce(k.codigo||' ','')||'por validar','/cerebro/validacion',k.created_at,NULL::date,'gestion'
  FROM public.brain_knowledge_items k WHERE m_c AND k.org_id=org AND k.estado='por_validar' AND (emp OR es_rs OR es_adm)
 )
 SELECT b.modulo,b.tipo,b.registro,b.titulo,b.ruta,b.nace_en,b.fecha_limite,b.perfil,
  greatest(0,hoy-(b.nace_en AT TIME ZONE 'America/Mexico_City')::date)::integer,
  public.pendientes_color(b.perfil,greatest(0,hoy-(b.nace_en AT TIME ZONE 'America/Mexico_City')::date)::integer,b.fecha_limite IS NOT NULL AND b.fecha_limite<hoy,c.o_n,c.o_r,c.g_n,c.g_r)
 FROM b;
END $$;
REVOKE ALL ON FUNCTION public.pendientes_usuario(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pendientes_usuario(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_semaforo_pendientes(integer,integer,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_perfil(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suplencias_traslape(public.app_role,timestamptz,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.tend_validar_firmantes_at(_org uuid, _firmantes jsonb, _elegibles jsonb, _emitir boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE f jsonb; uid uuid; p record; r text; permitidos jsonb; salida jsonb:='[]'; claves text[]:='{}'; cuenta_aut integer:=0; BEGIN
 IF jsonb_typeof(_firmantes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Firmantes AT debe ser una lista'; END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(_firmantes) LOOP
  r:=f->>'rol';
  IF r IS NULL OR r NOT IN ('Elaboró','Revisó','Autorizó') THEN RAISE EXCEPTION 'Rol de firmante inválido'; END IF;
  uid:=(f->>'user_id')::uuid;
  IF uid IS NULL THEN RAISE EXCEPTION 'Firmante requiere usuario real'; END IF;
  SELECT pr.nombre,pr.cargo INTO p FROM public.org_members m JOIN public.profiles pr ON pr.id=m.user_id WHERE m.org_id=_org AND m.user_id=uid AND pr.activo AND m.role<>'super_admin';
  IF NOT FOUND THEN RAISE EXCEPTION 'Firmante no es usuario activo de la empresa'; END IF;
  IF _emitir AND NOT EXISTS(SELECT 1 FROM public.profiles cp WHERE cp.id=uid AND cp.perfil_confirmado_en IS NOT NULL) THEN RAISE EXCEPTION 'Firmante sin perfil confirmado (nombre y cargo)'; END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.tend_validar_firmantes_at(_org uuid, _firmantes jsonb, _elegibles jsonb, _emitir boolean, _autor uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE f jsonb; uid uuid; p record; r text; permitidos jsonb; salida jsonb:='[]'; claves text[]:='{}'; cuenta_aut integer:=0; BEGIN
 IF jsonb_typeof(_firmantes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Firmantes AT debe ser una lista'; END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(_firmantes) LOOP
  r:=f->>'rol';
  IF r IS NULL OR r NOT IN ('Elaboró','Revisó','Autorizó') THEN RAISE EXCEPTION 'Rol de firmante inválido'; END IF;
  uid:=(f->>'user_id')::uuid;
  IF uid IS NULL THEN RAISE EXCEPTION 'Firmante requiere usuario real'; END IF;
  SELECT pr.nombre,pr.cargo INTO p FROM public.org_members m JOIN public.profiles pr ON pr.id=m.user_id WHERE m.org_id=_org AND m.user_id=uid AND pr.activo AND m.role<>'super_admin';
  IF NOT FOUND THEN RAISE EXCEPTION 'Firmante no es usuario activo de la empresa'; END IF;
  IF _emitir AND NOT EXISTS(SELECT 1 FROM public.profiles cp WHERE cp.id=uid AND cp.perfil_confirmado_en IS NOT NULL) THEN RAISE EXCEPTION 'Firmante sin perfil confirmado (nombre y cargo)'; END IF;
  IF (r||':'||uid::text)=ANY(claves) THEN RAISE EXCEPTION 'Firmante duplicado en el mismo rol'; END IF;
  claves:=array_append(claves,r||':'||uid::text);
  IF r='Autorizó' THEN
   cuenta_aut:=cuenta_aut+1;
   IF cuenta_aut>1 THEN RAISE EXCEPTION 'Autorizó admite un solo firmante'; END IF;
   IF NOT public.tend_firmante_autorizante(_org,uid) THEN RAISE EXCEPTION 'Autorizó solo admite RS o suplente vigente'; END IF;
  END IF;
  IF _elegibles IS NOT NULL THEN
   SELECT value->'user_ids' INTO permitidos FROM jsonb_array_elements(_elegibles) WHERE value->>'rol'=r;
   IF NOT coalesce(permitidos ? uid::text,false) AND NOT (r='Elaboró' AND uid=_autor) THEN RAISE EXCEPTION 'Firmante no pertenece a los elegibles de su rol'; END IF;
  END IF;
  salida:=salida||jsonb_build_array(jsonb_build_object('rol',r,'user_id',uid,'nombre',coalesce(f->>'nombre',p.nombre,''),'cargo',coalesce(f->>'cargo',p.cargo,'')));
 END LOOP;
 IF _emitir AND (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(salida) WHERE value->>'rol'='Elaboró') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(salida) WHERE value->>'rol'='Revisó') OR cuenta_aut<>1) THEN RAISE EXCEPTION 'Selecciona Elaboró, Revisó y Autorizó antes de emitir'; END IF;
 IF _emitir AND EXISTS(SELECT 1 FROM jsonb_array_elements(salida) WHERE coalesce(btrim(value->>'nombre'),'')='' OR coalesce(btrim(value->>'cargo'),'')='') THEN RAISE EXCEPTION 'Cada firmante requiere nombre y cargo antes de emitir'; END IF;
 RETURN salida;
END $function$;

CREATE OR REPLACE FUNCTION public.tend_usuarios_firmantes()
 RETURNS TABLE(id uuid, nombre text, cargo text, puede_autorizar boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE org uuid:=public.get_user_org_id(); BEGIN
 IF org IS NULL OR NOT public.tend_acceso(org) THEN RAISE EXCEPTION 'Sin acceso a Tendencias en la empresa activa'; END IF;
 RETURN QUERY SELECT p.id,p.nombre,p.cargo,public.tend_firmante_autorizante(org,p.id)
 FROM public.org_members m JOIN public.profiles p ON p.id=m.user_id
 WHERE m.org_id=org AND p.activo AND p.perfil_confirmado_en IS NOT NULL AND m.role<>'super_admin' ORDER BY p.nombre,p.id;
END $function$;