-- T2: current atdiafra ce2e802265c93248e33be4a8e58c057dc7fac5e6; no source data imported.
ALTER TABLE public.modulos DROP CONSTRAINT modulos_estado_check;
ALTER TABLE public.modulos ADD CONSTRAINT modulos_estado_check CHECK(estado IN ('activo','proximamente','beta'));
CREATE TABLE public.tend_sistemas_hvac (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),migrado_desde text,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,codigo text NOT NULL,nombre_uma text NOT NULL,descripcion text NOT NULL DEFAULT '',etapas text[] NOT NULL DEFAULT '{}',activo boolean NOT NULL DEFAULT true,UNIQUE(org_id,codigo),UNIQUE(org_id,id));
GRANT SELECT,INSERT,UPDATE ON public.tend_sistemas_hvac TO authenticated; GRANT ALL ON public.tend_sistemas_hvac TO service_role; ALTER TABLE public.tend_sistemas_hvac ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.tend_areas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),migrado_desde text,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,codigo text NOT NULL,nombre text NOT NULL,iso text NOT NULL CHECK(iso IN ('ISO-5','ISO-6','ISO-7','ISO-8','ISO-9')),hvac_id uuid,activo boolean NOT NULL DEFAULT true,UNIQUE(org_id,codigo),FOREIGN KEY(org_id,hvac_id) REFERENCES public.tend_sistemas_hvac(org_id,id),UNIQUE(org_id,id));
GRANT SELECT,INSERT,UPDATE ON public.tend_areas TO authenticated; GRANT ALL ON public.tend_areas TO service_role; ALTER TABLE public.tend_areas ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.tend_instrumentos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),migrado_desde text,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,codigo text NOT NULL,tipo text NOT NULL CHECK(tipo IN ('termohigrometro','manometro_filtro','manometro_diferencial','otro')),area_id uuid,area_libre text,parametro text NOT NULL,especificacion text,activo boolean NOT NULL DEFAULT true,lie_pa numeric,lse_pa numeric,baseline_pa numeric,baseline_tolerancia_pct numeric DEFAULT 25,codigo_bitacora text,dp_final_fabricante numeric,op_min_pa numeric,op_max_pa numeric,spec_estado text CHECK(spec_estado IN ('validada','pendiente','na')),spec_texto text,spec_lie numeric,spec_lse numeric,spec_lie_estricto boolean NOT NULL DEFAULT false,spec_lse_estricto boolean NOT NULL DEFAULT false,spec_texto_hr text,spec_lie_hr numeric,spec_lse_hr numeric,spec_referencia text,spec_fecha_validacion date,area_estado text NOT NULL DEFAULT 'validada' CHECK(area_estado IN ('validada','pendiente')),area_nota text,UNIQUE(org_id,codigo),FOREIGN KEY(org_id,area_id) REFERENCES public.tend_areas(org_id,id),UNIQUE(org_id,id));
GRANT SELECT,INSERT,UPDATE ON public.tend_instrumentos TO authenticated; GRANT ALL ON public.tend_instrumentos TO service_role; ALTER TABLE public.tend_instrumentos ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.tend_objetivos_presion (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),migrado_desde text,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,tipo text NOT NULL DEFAULT 'par_cuartos' CHECK(tipo='par_cuartos'),codigo text NOT NULL,nombre text NOT NULL,par_cuartos_id uuid,cuarto_x_id uuid,cuarto_y_id uuid,iso text,instrumento_id uuid,unidad text NOT NULL DEFAULT 'Pa',limite_normativo_pa numeric,lie_pa numeric,lse_pa numeric,activo boolean NOT NULL DEFAULT true,UNIQUE(org_id,tipo,codigo),FOREIGN KEY(org_id,cuarto_x_id) REFERENCES public.tend_areas(org_id,id),FOREIGN KEY(org_id,cuarto_y_id) REFERENCES public.tend_areas(org_id,id),FOREIGN KEY(org_id,instrumento_id) REFERENCES public.tend_instrumentos(org_id,id),UNIQUE(org_id,id));
GRANT SELECT,INSERT,UPDATE ON public.tend_objetivos_presion TO authenticated; GRANT ALL ON public.tend_objetivos_presion TO service_role; ALTER TABLE public.tend_objetivos_presion ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.tend_cambios_filtro (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),migrado_desde text,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,instrumento_id uuid NOT NULL,fecha date NOT NULL,nota text NOT NULL DEFAULT '',FOREIGN KEY(org_id,instrumento_id) REFERENCES public.tend_instrumentos(org_id,id),UNIQUE(org_id,id));
GRANT SELECT,INSERT,UPDATE ON public.tend_cambios_filtro TO authenticated; GRANT ALL ON public.tend_cambios_filtro TO service_role; ALTER TABLE public.tend_cambios_filtro ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.tend_registros (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),migrado_desde text,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,modulo text NOT NULL,nombre text NOT NULL,instrumento_id uuid,par_cuartos_id uuid,hvac_id uuid,etapa text,area_id uuid,codigo_area_libre text,nombre_area_libre text,iso text,lse numeric,lie numeric,lse_t numeric,lie_t numeric,lse_hr numeric,lie_hr numeric,activo boolean NOT NULL DEFAULT true,FOREIGN KEY(org_id,instrumento_id) REFERENCES public.tend_instrumentos(org_id,id),FOREIGN KEY(org_id,hvac_id) REFERENCES public.tend_sistemas_hvac(org_id,id),FOREIGN KEY(org_id,area_id) REFERENCES public.tend_areas(org_id,id),UNIQUE(org_id,id));
GRANT SELECT,INSERT,UPDATE ON public.tend_registros TO authenticated; GRANT ALL ON public.tend_registros TO service_role; ALTER TABLE public.tend_registros ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.tend_semanas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),migrado_desde text,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,registro_id uuid NOT NULL,semana_inicio date NOT NULL,mes text NOT NULL,anio text NOT NULL,unidad text NOT NULL,lecturas jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(lecturas)='array'),lecturas_hr jsonb,observaciones text NOT NULL DEFAULT '',source text NOT NULL DEFAULT 'manual',saved_at timestamptz NOT NULL DEFAULT now(),objetivo_presion_id uuid,foto_path text,UNIQUE(org_id,registro_id,semana_inicio),FOREIGN KEY(org_id,registro_id) REFERENCES public.tend_registros(org_id,id),FOREIGN KEY(org_id,objetivo_presion_id) REFERENCES public.tend_objetivos_presion(org_id,id),UNIQUE(org_id,id));
GRANT SELECT,INSERT,UPDATE ON public.tend_semanas TO authenticated; GRANT ALL ON public.tend_semanas TO service_role; ALTER TABLE public.tend_semanas ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.tend_formato (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),migrado_desde text,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,version integer NOT NULL DEFAULT 1 CHECK(version>0),version_formato text NOT NULL DEFAULT 'FOR-VAL-16-02 (00)',logo text,firmantes jsonb NOT NULL DEFAULT '[]',textos jsonb NOT NULL DEFAULT '{}',tabla_iso jsonb NOT NULL DEFAULT '[]',created_by_email text,UNIQUE(org_id,version),UNIQUE(org_id,id));
GRANT SELECT,INSERT,UPDATE ON public.tend_formato TO authenticated; GRANT ALL ON public.tend_formato TO service_role; ALTER TABLE public.tend_formato ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.tend_config (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),migrado_desde text,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,permitir_autoemision boolean NOT NULL DEFAULT false,UNIQUE(org_id),UNIQUE(org_id,id));
GRANT SELECT,INSERT,UPDATE ON public.tend_config TO authenticated; GRANT ALL ON public.tend_config TO service_role; ALTER TABLE public.tend_config ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.tend_registros_at (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),migrado_desde text,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,codigo text NOT NULL CHECK(codigo ~ '^AT-[0-9]{4}-[0-9]{3}$'),fecha date NOT NULL DEFAULT current_date,sistema text NOT NULL,periodo_desde date NOT NULL,periodo_hasta date NOT NULL CHECK(periodo_hasta>=periodo_desde),periodo_etiqueta text,instrumentos jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(instrumentos)='array'),usuario_id uuid,usuario_email text,dictamen_global text,justificaciones jsonb NOT NULL DEFAULT '{}',texto jsonb NOT NULL DEFAULT '{}',created_by_email text,updated_by_email text,version integer NOT NULL DEFAULT 1 CHECK(version>0),estado text NOT NULL DEFAULT 'borrador' CHECK(estado IN ('borrador','emitido','anulado')),emitido_at timestamptz,emitido_by uuid,emitido_por uuid,emitido_by_email text,emitido_nombre text,emitido_cargo text,motivo_version text,seleccion jsonb,ia_origen jsonb,en_suplencia boolean NOT NULL DEFAULT false,suplencia_id uuid,autoemitido boolean NOT NULL DEFAULT false,elaborado_version_por uuid,modificadores_version uuid[] NOT NULL DEFAULT '{}',anulado_en timestamptz,anulado_por uuid,motivo_anulacion text,anulacion_en_suplencia boolean NOT NULL DEFAULT false,anulacion_suplencia_id uuid,UNIQUE(org_id,codigo),UNIQUE(org_id,id));
GRANT SELECT,INSERT,UPDATE ON public.tend_registros_at TO authenticated; GRANT ALL ON public.tend_registros_at TO service_role; ALTER TABLE public.tend_registros_at ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.tend_registros_at_historial (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),migrado_desde text,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,registro_id uuid NOT NULL,codigo text NOT NULL,version integer NOT NULL,datos jsonb NOT NULL,usuario_id uuid,usuario_email text,fecha timestamptz NOT NULL DEFAULT now(),operacion text NOT NULL DEFAULT 'VERSION',UNIQUE(org_id,registro_id,version),FOREIGN KEY(org_id,registro_id) REFERENCES public.tend_registros_at(org_id,id),UNIQUE(org_id,id));
GRANT SELECT ON public.tend_registros_at_historial TO authenticated; GRANT ALL ON public.tend_registros_at_historial TO service_role; ALTER TABLE public.tend_registros_at_historial ENABLE ROW LEVEL SECURITY;
COMMENT ON COLUMN public.tend_instrumentos.lie_pa IS 'DEPRECATED: use spec_lie for normative limits; retained for source parity';
COMMENT ON COLUMN public.tend_instrumentos.lse_pa IS 'DEPRECATED: use spec_lse for normative limits; retained for source parity';
COMMENT ON COLUMN public.tend_objetivos_presion.par_cuartos_id IS 'Legacy source identifier; no pares_cuartos table in current design';
COMMENT ON COLUMN public.tend_registros.par_cuartos_id IS 'Legacy source identifier; no pares_cuartos table in current design';
CREATE TABLE public.org_suplencias (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),suplente_user_id uuid NOT NULL,suplente_nombre text NOT NULL DEFAULT '',suplente_cargo text NOT NULL DEFAULT '',facultades text[] NOT NULL,fecha_inicio timestamptz NOT NULL,fecha_fin timestamptz NOT NULL,motivo text NOT NULL,documento_respaldo text,registrada_por uuid,revocada_en timestamptz,revocada_por uuid,aviso_rs_requerido boolean NOT NULL DEFAULT false,aviso_rs_enviado_en timestamptz,aviso_rs_error text,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,UNIQUE(org_id,id),CHECK(cardinality(facultades)>0 AND facultades <@ ARRAY['autorizar','anular']::text[]),FOREIGN KEY(org_id,suplente_user_id) REFERENCES public.org_members(org_id,user_id));
GRANT SELECT,INSERT,UPDATE ON public.org_suplencias TO authenticated; GRANT ALL ON public.org_suplencias TO service_role; ALTER TABLE public.org_suplencias ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.org_suplencias(org_id,suplente_user_id,fecha_fin);
ALTER TABLE public.tend_registros_at ADD CONSTRAINT tend_at_suplencia_fk FOREIGN KEY(org_id,suplencia_id) REFERENCES public.org_suplencias(org_id,id);
ALTER TABLE public.tend_registros_at ADD CONSTRAINT tend_at_anulacion_suplencia_fk FOREIGN KEY(org_id,anulacion_suplencia_id) REFERENCES public.org_suplencias(org_id,id);
CREATE FUNCTION public.tend_acceso(_org uuid,_escritura boolean DEFAULT false,_roles text[] DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 SELECT * INTO c FROM public.contexto_org_actual();
 IF c.org_id IS DISTINCT FROM _org OR NOT public.mi_org_tiene_modulo('tendencias') OR NOT public.org_tiene_modulo(public.get_user_org_id(),'tendencias') THEN RETURN false; END IF;
 IF c.es_super_admin THEN RETURN NOT _escritura AND c.soporte_log_id IS NOT NULL; END IF;
 RETURN EXISTS(SELECT 1 FROM public.org_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.org_id=_org AND m.user_id=auth.uid() AND p.activo AND (_roles IS NULL OR m.role::text=ANY(_roles)));
END $$;
REVOKE ALL ON FUNCTION public.tend_acceso(uuid,boolean,text[]) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.tend_acceso(uuid,boolean,text[]) TO authenticated,service_role;
CREATE FUNCTION public.org_suplencias_acceso(_org uuid,_escritura boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 SELECT * INTO c FROM public.contexto_org_actual();
 IF c.org_id IS DISTINCT FROM _org THEN RETURN false; END IF;
 IF c.es_super_admin THEN RETURN NOT _escritura AND c.soporte_log_id IS NOT NULL; END IF;
 RETURN EXISTS(SELECT 1 FROM public.org_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.org_id=_org AND m.user_id=auth.uid() AND p.activo AND (NOT _escritura OR m.role IN ('admin','responsable_sanitario')));
END $$;
REVOKE ALL ON FUNCTION public.org_suplencias_acceso(uuid,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.org_suplencias_acceso(uuid,boolean) TO authenticated,service_role;
CREATE POLICY suplencias_select ON public.org_suplencias FOR SELECT TO authenticated USING(public.org_suplencias_acceso(org_id));
CREATE POLICY suplencias_insert ON public.org_suplencias FOR INSERT TO authenticated WITH CHECK(public.org_suplencias_acceso(org_id,true));
CREATE POLICY suplencias_update ON public.org_suplencias FOR UPDATE TO authenticated USING(public.org_suplencias_acceso(org_id,true)) WITH CHECK(public.org_suplencias_acceso(org_id,true));
CREATE FUNCTION public.org_suplencias_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n text; c text; BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Suplencias no se borran: revocar'; END IF;
 IF NOT public.org_suplencias_acceso(NEW.org_id,true) THEN RAISE EXCEPTION 'Sin permiso para registrar o revocar suplencias'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.org_id::text,712));
 IF TG_OP='INSERT' THEN
  IF NEW.fecha_fin<=NEW.fecha_inicio OR NEW.fecha_fin<=now() THEN RAISE EXCEPTION 'Fecha fin obligatoria y posterior al inicio y al alta'; END IF;
  IF btrim(NEW.motivo)='' THEN RAISE EXCEPTION 'Motivo obligatorio'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=NEW.suplente_user_id AND role='super_admin') OR EXISTS(SELECT 1 FROM public.org_members WHERE user_id=NEW.suplente_user_id AND role='super_admin') THEN RAISE EXCEPTION 'Super admin nunca es suplente'; END IF;
  SELECT p.nombre,p.cargo INTO n,c FROM public.org_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.org_id=NEW.org_id AND m.user_id=NEW.suplente_user_id AND p.activo;
  IF coalesce(btrim(n),'')='' OR coalesce(btrim(c),'')='' THEN RAISE EXCEPTION 'Suplente requiere membresía activa, nombre y cargo'; END IF;
  IF EXISTS(SELECT 1 FROM public.org_suplencias s WHERE s.org_id=NEW.org_id AND s.revocada_en IS NULL AND s.facultades && NEW.facultades AND s.fecha_inicio<NEW.fecha_fin AND s.fecha_fin>NEW.fecha_inicio) THEN RAISE EXCEPTION 'Solo una suplencia vigente por facultad'; END IF;
  NEW.suplente_nombre:=n; NEW.suplente_cargo:=c; NEW.registrada_por:=auth.uid(); NEW.created_by:=auth.uid(); NEW.created_at:=now(); NEW.revocada_en:=NULL; NEW.revocada_por:=NULL;
  NEW.aviso_rs_requerido:=NOT public.has_role(auth.uid(),'responsable_sanitario'); NEW.aviso_rs_enviado_en:=NULL; NEW.aviso_rs_error:=NULL;
 ELSE
  IF (to_jsonb(NEW)-ARRAY['revocada_en','revocada_por','updated_at','updated_by']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revocada_en','revocada_por','updated_at','updated_by']) OR OLD.revocada_en IS NOT NULL OR NEW.revocada_en IS NULL THEN RAISE EXCEPTION 'Solo se permite revocar la suplencia; aviso reservado para T3'; END IF;
  NEW.revocada_en:=now(); NEW.revocada_por:=auth.uid();
 END IF;
 NEW.updated_by:=auth.uid(); NEW.updated_at:=now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.org_suplencias_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER suplencias_guard BEFORE INSERT OR UPDATE OR DELETE ON public.org_suplencias FOR EACH ROW EXECUTE FUNCTION public.org_suplencias_guard();
CREATE TRIGGER suplencias_audit AFTER INSERT OR UPDATE ON public.org_suplencias FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE FUNCTION public.tend_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r text[]; BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Tendencias: retirar o anular, nunca borrar'; END IF;
 r:=CASE WHEN TG_TABLE_NAME IN ('tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion','tend_formato','tend_config') THEN ARRAY['admin'] ELSE ARRAY['operador','comite_tecnico','admin','responsable_sanitario'] END;
 IF NOT public.tend_acceso(NEW.org_id,true,r) THEN RAISE EXCEPTION 'Sin permiso de escritura en Tendencias'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN RAISE EXCEPTION 'Identidad y autor originales inmutables'; END IF;
 IF TG_OP='INSERT' THEN NEW.created_by:=auth.uid(); NEW.created_at:=now(); END IF;
 NEW.updated_by:=auth.uid(); NEW.updated_at:=now();
 IF TG_TABLE_NAME='tend_semanas' AND coalesce(to_jsonb(NEW)->>'foto_path','')<>'' AND (split_part(to_jsonb(NEW)->>'foto_path','/',1)<>NEW.org_id::text OR (to_jsonb(NEW)->>'foto_path') ~ '(^|/)\.\.(/|$)') THEN RAISE EXCEPTION 'Foto fuera de empresa'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tend_guard() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.tend_historial_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Historial AT inmutable, incluso service_role'; END IF;
 IF pg_trigger_depth()<2 OR NOT public.tend_acceso(NEW.org_id,true) THEN RAISE EXCEPTION 'Historial solo generado por versionado'; END IF;
 NEW.created_by:=auth.uid(); NEW.updated_by:=auth.uid(); NEW.created_at:=now(); NEW.updated_at:=now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tend_historial_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tend_historial_guard BEFORE INSERT OR UPDATE OR DELETE ON public.tend_registros_at_historial FOR EACH ROW EXECUTE FUNCTION public.tend_historial_guard();
CREATE TRIGGER tend_historial_truncate BEFORE TRUNCATE ON public.tend_registros_at_historial FOR EACH STATEMENT EXECUTE FUNCTION public.tend_historial_guard();
CREATE FUNCTION public.tend_suplencia(_org uuid,_facultad text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT s.id FROM public.org_suplencias s JOIN public.org_members m ON m.org_id=s.org_id AND m.user_id=s.suplente_user_id JOIN public.profiles p ON p.id=m.user_id WHERE public.tend_acceso(_org,true) AND s.org_id=_org AND s.suplente_user_id=auth.uid() AND p.activo AND s.revocada_en IS NULL AND now()>=s.fecha_inicio AND now()<s.fecha_fin AND _facultad=ANY(s.facultades) LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.tend_suplencia(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.tend_suplencia(uuid,text) TO authenticated,service_role;
CREATE FUNCTION public.tend_at_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE su uuid; v_auto boolean; e text; n text; c text; k jsonb; ki uuid; restantes integer;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Registros AT nunca se borran'; END IF;
 IF NOT public.tend_acceso(NEW.org_id,true) THEN RAISE EXCEPTION 'Sin permiso de escritura en Tendencias'; END IF;
 SELECT email,nombre,cargo INTO e,n,c FROM public.profiles WHERE id=auth.uid() AND activo;
 IF TG_OP='INSERT' THEN
  IF NOT public.tend_acceso(NEW.org_id,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']) OR NEW.estado<>'borrador' THEN RAISE EXCEPTION 'Captura solo en borrador'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.org_id::text || extract(year from NEW.fecha)::text,713));
  IF NEW.codigo IS NULL OR NEW.codigo='' THEN
   SELECT coalesce(max(right(codigo,3)::integer),0)+1 INTO restantes FROM public.tend_registros_at WHERE org_id=NEW.org_id AND substring(codigo,4,4)=extract(year from NEW.fecha)::text;
   IF restantes>999 THEN RAISE EXCEPTION 'Consecutivo anual agotado'; END IF;
   NEW.codigo:='AT-'||extract(year from NEW.fecha)::text||'-'||lpad(restantes::text,3,'0');
  END IF;
  IF substring(NEW.codigo,4,4)<>extract(year from NEW.fecha)::text THEN RAISE EXCEPTION 'Código no corresponde al año'; END IF;
  NEW.version:=1; NEW.created_by:=auth.uid(); NEW.created_at:=now(); NEW.created_by_email:=e; NEW.usuario_id:=auth.uid(); NEW.usuario_email:=e; NEW.elaborado_version_por:=auth.uid(); NEW.modificadores_version:=ARRAY[auth.uid()];
  NEW.emitido_at:=NULL; NEW.emitido_by:=NULL; NEW.emitido_por:=NULL; NEW.emitido_by_email:=NULL; NEW.emitido_nombre:=NULL; NEW.emitido_cargo:=NULL; NEW.en_suplencia:=false; NEW.suplencia_id:=NULL; NEW.autoemitido:=false; NEW.anulado_en:=NULL; NEW.anulado_por:=NULL; NEW.motivo_anulacion:=NULL; NEW.anulacion_en_suplencia:=false; NEW.anulacion_suplencia_id:=NULL;
 ELSE
  IF NEW.id<>OLD.id OR NEW.org_id<>OLD.org_id OR NEW.codigo<>OLD.codigo THEN RAISE EXCEPTION 'Identidad AT inmutable'; END IF;
  IF OLD.estado='anulado' THEN RAISE EXCEPTION 'Registro anulado inmutable'; END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
   IF (to_jsonb(NEW)-ARRAY['estado','motivo_version','motivo_anulacion','updated_at','updated_by']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['estado','motivo_version','motivo_anulacion','updated_at','updated_by']) THEN RAISE EXCEPTION 'Cambio de estado no puede alterar contenido'; END IF;
   IF NEW.estado='borrador' AND OLD.estado='emitido' THEN
    IF NOT public.tend_acceso(NEW.org_id,true,ARRAY['admin','responsable_sanitario']) OR coalesce(btrim(NEW.motivo_version),'')='' THEN RAISE EXCEPTION 'Nueva versión solo admin/RS con motivo'; END IF;
    NEW.elaborado_version_por:=auth.uid(); NEW.modificadores_version:=ARRAY[auth.uid()]; NEW.emitido_at:=NULL; NEW.emitido_por:=NULL; NEW.emitido_by:=NULL; NEW.emitido_by_email:=NULL; NEW.emitido_nombre:=NULL; NEW.emitido_cargo:=NULL; NEW.en_suplencia:=false; NEW.suplencia_id:=NULL; NEW.autoemitido:=false;
   ELSIF NEW.estado IN ('emitido','anulado') THEN
    IF NEW.estado='emitido' AND OLD.estado<>'borrador' OR NEW.estado='anulado' AND OLD.estado<>'emitido' THEN RAISE EXCEPTION 'Transición AT no permitida'; END IF;
    su:=public.tend_suplencia(NEW.org_id,CASE WHEN NEW.estado='emitido' THEN 'autorizar' ELSE 'anular' END);
    IF NOT public.has_role(auth.uid(),'responsable_sanitario') AND su IS NULL THEN RAISE EXCEPTION 'Solo RS o suplente vigente autoriza/anula'; END IF;
    SELECT permitir_autoemision INTO v_auto FROM public.tend_config WHERE org_id=NEW.org_id;
    IF auth.uid()=OLD.elaborado_version_por OR auth.uid()=ANY(OLD.modificadores_version) THEN
     IF su IS NOT NULL OR NEW.estado='anulado' OR NOT coalesce(v_auto,false) THEN RAISE EXCEPTION 'Separación de funciones: elaborador/modificador no autoriza ni anula'; END IF;
     NEW.autoemitido:=true;
    ELSE NEW.autoemitido:=false; END IF;
    IF NEW.estado='emitido' THEN
     IF coalesce(btrim(n),'')='' OR coalesce(btrim(c),'')='' THEN RAISE EXCEPTION 'Emisor requiere nombre y cargo'; END IF;
     IF jsonb_array_length(NEW.instrumentos)=0 THEN RAISE EXCEPTION 'Emisión requiere instrumentos con especificación resuelta'; END IF;
     FOR k IN SELECT value FROM jsonb_array_elements(NEW.instrumentos) LOOP
      BEGIN ki:=coalesce(k->>'instrumento_id',k->>'id',CASE WHEN jsonb_typeof(k)='string' THEN k#>>'{}' END)::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Instrumento inválido en AT'; END;
      IF ki IS NULL OR NOT EXISTS(SELECT 1 FROM public.tend_instrumentos WHERE org_id=NEW.org_id AND id=ki AND activo AND spec_estado IN ('validada','na') AND area_estado='validada') OR k->>'spec_estado'='pendiente' OR k->>'area_estado'='pendiente' THEN RAISE EXCEPTION 'Especificaciones o áreas pendientes bloquean emisión'; END IF;
     END LOOP;
     NEW.emitido_at:=now(); NEW.emitido_por:=auth.uid(); NEW.emitido_by:=auth.uid(); NEW.emitido_by_email:=e; NEW.emitido_nombre:=n; NEW.emitido_cargo:=c; NEW.en_suplencia:=su IS NOT NULL; NEW.suplencia_id:=su;
    ELSE
     IF coalesce(btrim(NEW.motivo_anulacion),'')='' THEN RAISE EXCEPTION 'Anulación requiere motivo'; END IF;
     NEW.anulado_en:=now(); NEW.anulado_por:=auth.uid(); NEW.anulacion_en_suplencia:=su IS NOT NULL; NEW.anulacion_suplencia_id:=su; NEW.autoemitido:=OLD.autoemitido;
    END IF;
    IF su IS NOT NULL THEN INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_anterior,valor_nuevo) VALUES(auth.uid(),NEW.org_id,'org_suplencias',su::text,'SUPLENCIA_USADA',NULL,jsonb_build_object('registro_at_id',NEW.id,'version',OLD.version,'facultad',CASE WHEN NEW.estado='emitido' THEN 'autorizar' ELSE 'anular' END)); END IF;
   ELSE RAISE EXCEPTION 'Transición AT no permitida'; END IF;
  ELSE
   IF OLD.estado<>'borrador' THEN RAISE EXCEPTION 'Emitido: solo nueva versión o anular con motivo'; END IF;
   IF NOT public.tend_acceso(NEW.org_id,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']) THEN RAISE EXCEPTION 'Sin permiso para captura'; END IF;
   IF (to_jsonb(NEW)-ARRAY['fecha','sistema','periodo_desde','periodo_hasta','periodo_etiqueta','instrumentos','dictamen_global','justificaciones','texto','seleccion','ia_origen','updated_at','updated_by']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['fecha','sistema','periodo_desde','periodo_hasta','periodo_etiqueta','instrumentos','dictamen_global','justificaciones','texto','seleccion','ia_origen','updated_at','updated_by']) THEN RAISE EXCEPTION 'Metadatos de control no editables'; END IF;
   NEW.modificadores_version:=ARRAY(SELECT DISTINCT unnest(OLD.modificadores_version||ARRAY[auth.uid()]));
  END IF;
  INSERT INTO public.tend_registros_at_historial(org_id,registro_id,codigo,version,datos,usuario_id,usuario_email,operacion) VALUES(OLD.org_id,OLD.id,OLD.codigo,OLD.version,to_jsonb(OLD),auth.uid(),e,CASE WHEN OLD.estado<>NEW.estado THEN upper(NEW.estado) ELSE 'VERSION' END);
  NEW.created_by:=OLD.created_by; NEW.created_at:=OLD.created_at; NEW.created_by_email:=OLD.created_by_email; NEW.usuario_id:=OLD.usuario_id; NEW.usuario_email:=OLD.usuario_email; NEW.version:=OLD.version+1;
 END IF;
 NEW.updated_by:=auth.uid(); NEW.updated_by_email:=e; NEW.updated_at:=now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tend_at_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tend_at_guard BEFORE INSERT OR UPDATE OR DELETE ON public.tend_registros_at FOR EACH ROW EXECUTE FUNCTION public.tend_at_guard();
DO $$ DECLARE t text; roles text[]; BEGIN
 FOREACH t IN ARRAY ARRAY['tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion','tend_cambios_filtro','tend_registros','tend_semanas','tend_formato','tend_config','tend_registros_at','tend_registros_at_historial'] LOOP
  EXECUTE format('CREATE INDEX ON public.%I(org_id)',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING(public.tend_acceso(org_id))',t||'_select',t);
  EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()',t||'_audit',t);
  IF t='tend_registros_at_historial' THEN CONTINUE; END IF;
  roles:=CASE WHEN t IN ('tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion','tend_formato','tend_config') THEN ARRAY['admin'] ELSE ARRAY['operador','comite_tecnico','admin','responsable_sanitario'] END;
  EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK(public.tend_acceso(org_id,true,%L::text[]))',t||'_insert',t,roles);
  IF t='tend_registros_at' THEN
   EXECUTE 'CREATE POLICY tend_registros_at_update ON public.tend_registros_at FOR UPDATE TO authenticated USING(public.tend_acceso(org_id,true,NULL)) WITH CHECK(public.tend_acceso(org_id,true,NULL))';
  ELSE
   EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING(public.tend_acceso(org_id,true,%L::text[])) WITH CHECK(public.tend_acceso(org_id,true,%L::text[]))',t||'_update',t,roles,roles);
   EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tend_guard()',t||'_guard',t);
  END IF;
  EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.tend_historial_guard()',t||'_no_truncate',t);
 END LOOP;
END $$;
CREATE TRIGGER suplencias_no_truncate BEFORE TRUNCATE ON public.org_suplencias FOR EACH STATEMENT EXECUTE FUNCTION public.tend_historial_guard();
CREATE FUNCTION public.org_suplencias_auditar_vencimientos() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record; n integer:=0; BEGIN
 PERFORM pg_advisory_xact_lock(714001);
 FOR s IN SELECT * FROM public.org_suplencias x WHERE x.fecha_fin<=now() AND x.revocada_en IS NULL AND NOT EXISTS(SELECT 1 FROM public.audit_trail a WHERE a.tabla='org_suplencias' AND a.registro_id=x.id::text AND a.accion='SUPLENCIA_VENCIDA') LOOP
  INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_anterior,valor_nuevo) VALUES(NULL,s.org_id,'org_suplencias',s.id::text,'SUPLENCIA_VENCIDA',to_jsonb(s),to_jsonb(s)||jsonb_build_object('vigente',false,'vencida_en',s.fecha_fin)); n:=n+1;
 END LOOP; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.org_suplencias_auditar_vencimientos() FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION public.org_suplencias_auditar_vencimientos() IS 'Hourly scheduled audit only; expiry permissions take effect immediately via fecha_fin';
DO $$ BEGIN PERFORM cron.schedule('t2-suplencias-vencimientos','0 * * * *','SELECT public.org_suplencias_auditar_vencimientos()'); END $$;
CREATE OR REPLACE FUNCTION public.org_tiene_modulo(_org uuid,_modulo text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.modulos mm WHERE mm.clave=_modulo AND mm.estado='proximamente') AND ((NOT EXISTS(SELECT 1 FROM public.modulos mm WHERE mm.clave=_modulo AND mm.estado='beta') AND EXISTS(SELECT 1 FROM public.organizations o JOIN public.plan_modulos pm ON pm.plan=o.plan AND pm.modulo=_modulo WHERE o.id=_org)) OR EXISTS(SELECT 1 FROM public.organization_features f WHERE f.org_id=_org AND f.feature_key=_modulo AND f.activo AND (f.expira_en IS NULL OR f.expira_en>now())))
$$;
CREATE OR REPLACE FUNCTION public.mis_modulos() RETURNS TABLE(clave text,nombre text,descripcion text,orden integer,estado text,tiene_acceso boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT m.clave,m.nombre,m.descripcion,m.orden,m.estado,(m.estado IN ('activo','beta') AND public.get_user_org_id() IS NOT NULL AND public.org_tiene_modulo(public.get_user_org_id(),m.clave)) FROM public.modulos m WHERE auth.uid() IS NOT NULL AND m.activo ORDER BY m.orden NULLS LAST,m.clave
$$;
CREATE FUNCTION public.tend_beta_comercial_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.modulo='tendencias' AND EXISTS(SELECT 1 FROM public.modulos WHERE clave='tendencias' AND estado='beta') THEN RAISE EXCEPTION 'Tendencias beta: solo activación manual, sin precio ni plan'; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tend_beta_comercial_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tend_beta_plan_guard BEFORE INSERT OR UPDATE ON public.plan_modulos FOR EACH ROW EXECUTE FUNCTION public.tend_beta_comercial_guard();
CREATE TRIGGER tend_beta_precio_guard BEFORE INSERT OR UPDATE ON public.precios FOR EACH ROW EXECUTE FUNCTION public.tend_beta_comercial_guard();
CREATE POLICY tend_bitacoras_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='tend-bitacoras' AND public.tend_acceso(CASE WHEN split_part(name,'/',1) ~ '^[0-9a-fA-F-]{36}$' THEN split_part(name,'/',1)::uuid ELSE NULL END));
CREATE POLICY tend_bitacoras_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='tend-bitacoras' AND name !~ '(^|/)\.\.(/|$)' AND public.tend_acceso(CASE WHEN split_part(name,'/',1) ~ '^[0-9a-fA-F-]{36}$' THEN split_part(name,'/',1)::uuid ELSE NULL END,true,ARRAY['operador','comite_tecnico','admin','responsable_sanitario']));
-- No UPDATE/DELETE storage policy: originals are not overwritten or deleted.