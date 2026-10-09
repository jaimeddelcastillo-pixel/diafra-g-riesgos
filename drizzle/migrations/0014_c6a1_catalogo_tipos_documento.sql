CREATE OR REPLACE FUNCTION public.normalizar_txt(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT btrim(regexp_replace(regexp_replace(
    translate(lower(coalesce(_t,'')), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'),
    '[^a-z0-9\s]', ' ', 'g'), '\s+', ' ', 'g'))
$$;

CREATE TABLE public.documento_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clave text NOT NULL CHECK (clave ~ '^[a-z0-9_]{1,40}$'),
  nombre text NOT NULL CHECK (length(btrim(nombre)) BETWEEN 1 AND 200),
  claves_codigo text[] NOT NULL DEFAULT '{}',
  sinonimos text[] NOT NULL DEFAULT '{}',
  es_registro boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  orden int NOT NULL DEFAULT 100,
  es_propio boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documento_tipos_org_clave_uq UNIQUE NULLS NOT DISTINCT (org_id, clave)
);
CREATE INDEX documento_tipos_org_idx ON public.documento_tipos(org_id);

CREATE TABLE public.documento_tipos_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  posicion_tipo_en_codigo int NOT NULL DEFAULT 1 CHECK (posicion_tipo_en_codigo BETWEEN 1 AND 10),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_tipos TO authenticated;
GRANT ALL ON public.documento_tipos TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.documento_tipos_config TO authenticated;
GRANT ALL ON public.documento_tipos_config TO service_role;

ALTER TABLE public.documento_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento_tipos_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.puede_editar_catalogo_documentos()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT c.rol_en_org IN ('admin','responsable_sanitario','super_admin')
                   FROM public.contexto_org_actual() c LIMIT 1), false)
$$;
GRANT EXECUTE ON FUNCTION public.puede_editar_catalogo_documentos() TO authenticated;

CREATE POLICY doc_tipos_select ON public.documento_tipos FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY doc_tipos_insert ON public.documento_tipos FOR INSERT TO authenticated
  WITH CHECK ((org_id IS NULL AND public.is_super_admin())
    OR (org_id = public.get_user_org_id() AND public.puede_editar_catalogo_documentos()));
CREATE POLICY doc_tipos_update ON public.documento_tipos FOR UPDATE TO authenticated
  USING ((org_id IS NULL AND public.is_super_admin())
    OR (org_id = public.get_user_org_id() AND public.puede_editar_catalogo_documentos()))
  WITH CHECK ((org_id IS NULL AND public.is_super_admin())
    OR (org_id = public.get_user_org_id() AND public.puede_editar_catalogo_documentos()));
CREATE POLICY doc_tipos_delete ON public.documento_tipos FOR DELETE TO authenticated
  USING (org_id IS NULL AND public.is_super_admin());

CREATE POLICY doc_tipos_cfg_select ON public.documento_tipos_config FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY doc_tipos_cfg_insert ON public.documento_tipos_config FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND public.puede_editar_catalogo_documentos());
CREATE POLICY doc_tipos_cfg_update ON public.documento_tipos_config FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND public.puede_editar_catalogo_documentos())
  WITH CHECK (org_id = public.get_user_org_id() AND public.puede_editar_catalogo_documentos());

CREATE TRIGGER trg_documento_tipos_updated_at BEFORE UPDATE ON public.documento_tipos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_documento_tipos_config_updated_at BEFORE UPDATE ON public.documento_tipos_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_documento_tipos AFTER INSERT OR UPDATE OR DELETE ON public.documento_tipos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER trg_audit_documento_tipos_config AFTER INSERT OR UPDATE OR DELETE ON public.documento_tipos_config
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

INSERT INTO public.documento_tipos (org_id, clave, nombre, claves_codigo, sinonimos, es_registro, orden) VALUES
 (NULL,'dfl','Diagrama de flujo','{DFL}','{diagrama de flujo,diagramas de flujo,flujograma}',false,1),
 (NULL,'bit','Bitácora','{BIT}','{bitacora,bitacoras}',false,2),
 (NULL,'eti','Etiqueta','{ETI}','{etiqueta,etiquetas}',false,3),
 (NULL,'for','Formato','{FOR}','{formato,formatos,registro,registros,formulario}',false,4),
 (NULL,'fet','Ficha técnica','{FET}','{ficha tecnica,fichas tecnicas,hoja tecnica}',false,5),
 (NULL,'intec','Informe técnico','{INTEC}','{informe tecnico,informes tecnicos,informe,informes}',false,6),
 (NULL,'int','Instructivo de trabajo','{INT}','{instructivo,instructivos,instructivo de trabajo,instruccion de trabajo,instrucciones de trabajo}',false,7),
 (NULL,'lis','Listado','{LIS}','{listado,listados,lista,listado maestro}',false,8),
 (NULL,'man','Manual','{MAN}','{manual,manuales,manual de calidad}',false,9),
 (NULL,'mat','Matriz','{MAT}','{matriz,matrices}',false,10),
 (NULL,'org','Organigrama','{ORG}','{organigrama,organigramas}',false,11),
 (NULL,'pmv','Plan maestro de validación','{PMV}','{plan maestro de validacion,vmp}',false,12),
 (NULL,'pmt','Plan maestro de transición','{PMT}','{plan maestro de transicion}',false,13),
 (NULL,'pno','Procedimiento normalizado de operación','{PNO}','{pno,procedimiento,procedimientos,procedimiento normalizado de operacion,procedimiento normalizado de operaciones,procedimiento estandar de operacion,sop,poe}',false,14),
 (NULL,'pro','Programa','{PRO}','{programa,programas}',false,15),
 (NULL,'pol','Política','{POL}','{politica,politicas,politica de calidad}',false,16),
 (NULL,'esp','Especificación','{ESP}','{especificacion,especificaciones}',false,17),
 (NULL,'pla','Plano','{PLA}','{plano,planos}',false,18),
 (NULL,'prt','Protocolo (calificación / validación)','{PRT}','{protocolo,protocolos,protocolo de calificacion,protocolo de validacion}',false,19),
 (NULL,'coa','Certificado de análisis / calidad (COA)','{COA}','{coa,certificado de analisis,certificado de calidad,certificados de analisis}',false,20),
 (NULL,'cer','Certificado (calibración y otros)','{CER}','{certificado,certificados,certificado de calibracion}',false,21),
 (NULL,'acu','Contrato / acuerdo de calidad','{ACU}','{contrato,contratos,acuerdo de calidad,convenio de calidad,contrato de calidad}',false,22),
 (NULL,'mpr','Mapa de procesos','{MPR}','{mapa de procesos,mapa procesos}',false,23),
 (NULL,'ari','Análisis de riesgo','{ARI}','{analisis de riesgo,analisis de riesgos,amef,fmea}',false,24),
 (NULL,'aut','Autorización regulatoria','{AUT}','{autorizacion regulatoria,registro sanitario,licencia sanitaria,aviso de funcionamiento}',false,25),
 (NULL,'nor','Norma / referencia externa','{NOR}','{norma,normas,referencia externa,farmacopea}',false,26),
 (NULL,'capa','CAPA','{}','{capa,accion correctiva,accion preventiva,acciones correctivas y preventivas}',true,27),
 (NULL,'desv','Desviación / No conformidad','{}','{desviacion,desviaciones,no conformidad,no conformidades}',true,28),
 (NULL,'cc','Control de cambios','{}','{control de cambios,control de cambio,solicitud de cambio}',true,29),
 (NULL,'rep','Reporte','{}','{reporte,reportes}',true,30),
 (NULL,'otro','Otro','{}','{otro,otros}',false,31);

CREATE OR REPLACE FUNCTION public.seed_documento_tipos(_org_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.documento_tipos_config (org_id) VALUES (_org_id) ON CONFLICT (org_id) DO NOTHING;
  INSERT INTO public.documento_tipos (org_id, clave, nombre, claves_codigo, sinonimos, es_registro, activo, orden, es_propio)
  SELECT _org_id, p.clave, p.nombre, p.claves_codigo, p.sinonimos, p.es_registro, true, p.orden, false
    FROM public.documento_tipos p
   WHERE p.org_id IS NULL AND p.activo
     AND NOT EXISTS (SELECT 1 FROM public.documento_tipos t WHERE t.org_id = _org_id AND t.clave = p.clave);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.seed_documento_tipos(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.seed_documento_tipos_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.seed_documento_tipos(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER trg_seed_documento_tipos AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.seed_documento_tipos_trigger();

SELECT public.seed_documento_tipos(o.id) FROM public.organizations o;

ALTER TABLE public.brain_documents ADD COLUMN tipo_clave text;
ALTER TABLE public.org_documentos ADD COLUMN tipo_clave text;
ALTER TABLE public.org_documentos ADD COLUMN clasificacion text NOT NULL DEFAULT 'trabajo'
  CHECK (clasificacion IN ('controlado','trabajo','referencia'));
ALTER TABLE public.org_documentos ADD COLUMN sha256_servidor text;
ALTER TABLE public.org_documentos ADD COLUMN sha256_verificado_en timestamptz;

CREATE OR REPLACE FUNCTION public.clasificar_tipo_documento(p_org uuid, p_codigo text, p_tipo text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pos int; v_seg text; v_t text; v_clave text;
BEGIN
  IF auth.uid() IS NOT NULL AND p_org IS DISTINCT FROM public.get_user_org_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Empresa fuera de contexto';
  END IF;
  SELECT posicion_tipo_en_codigo INTO v_pos FROM public.documento_tipos_config WHERE org_id = p_org;
  v_seg := upper(btrim(split_part(coalesce(p_codigo,''), '-', coalesce(v_pos,1))));
  IF v_seg <> '' THEN
    SELECT t.clave INTO v_clave FROM public.documento_tipos t
     WHERE t.org_id = p_org AND t.activo
       AND EXISTS (SELECT 1 FROM unnest(t.claves_codigo) k WHERE upper(btrim(k)) = v_seg)
     ORDER BY t.orden, t.clave LIMIT 1;
    IF v_clave IS NOT NULL THEN RETURN v_clave; END IF;
  END IF;
  v_t := public.normalizar_txt(p_tipo);
  IF v_t <> '' THEN
    SELECT t.clave INTO v_clave FROM public.documento_tipos t
     WHERE t.org_id = p_org AND t.activo
       AND EXISTS (SELECT 1 FROM unnest(t.sinonimos || ARRAY[t.nombre, t.clave]) s WHERE public.normalizar_txt(s) = v_t)
     ORDER BY t.orden, t.clave LIMIT 1;
    IF v_clave IS NOT NULL THEN RETURN v_clave; END IF;
  END IF;
  RETURN 'otro';
END $$;
GRANT EXECUTE ON FUNCTION public.clasificar_tipo_documento(uuid,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.clasificar_tipos_documento(p_org uuid, p_items jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(public.clasificar_tipo_documento(p_org, e->>'codigo', e->>'tipo') ORDER BY i), '[]'::jsonb)
    FROM jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) WITH ORDINALITY AS x(e, i)
$$;
GRANT EXECUTE ON FUNCTION public.clasificar_tipos_documento(uuid,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.quitar_documento_tipo(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.documento_tipos; n int;
BEGIN
  SELECT * INTO t FROM public.documento_tipos WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tipo no encontrado'; END IF;
  IF t.org_id IS NULL OR t.org_id IS DISTINCT FROM public.get_user_org_id() OR NOT public.puede_editar_catalogo_documentos() THEN
    RAISE EXCEPTION 'Sin permiso para modificar este catálogo';
  END IF;
  SELECT (SELECT count(*) FROM public.brain_documents b WHERE b.org_id = t.org_id AND b.tipo_clave = t.clave)
       + (SELECT count(*) FROM public.org_documentos d WHERE d.org_id = t.org_id AND d.tipo_clave = t.clave)
    INTO n;
  IF n > 0 THEN
    UPDATE public.documento_tipos SET activo = false WHERE id = p_id;
    RETURN 'desactivado';
  END IF;
  DELETE FROM public.documento_tipos WHERE id = p_id;
  RETURN 'eliminado';
END $$;
GRANT EXECUTE ON FUNCTION public.quitar_documento_tipo(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.restaurar_documento_tipos()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := public.get_user_org_id();
BEGIN
  IF v_org IS NULL OR NOT public.puede_editar_catalogo_documentos() THEN
    RAISE EXCEPTION 'Sin permiso para modificar este catálogo';
  END IF;
  RETURN public.seed_documento_tipos(v_org);
END $$;
GRANT EXECUTE ON FUNCTION public.restaurar_documento_tipos() TO authenticated;

CREATE OR REPLACE FUNCTION public.documento_tipos_uso()
RETURNS TABLE(clave text, documentos bigint, archivos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.clave,
    (SELECT count(*) FROM public.brain_documents b WHERE b.org_id = t.org_id AND b.tipo_clave = t.clave),
    (SELECT count(*) FROM public.org_documentos d WHERE d.org_id = t.org_id AND d.tipo_clave = t.clave AND d.deleted_at IS NULL)
  FROM public.documento_tipos t WHERE t.org_id = public.get_user_org_id()
$$;
GRANT EXECUTE ON FUNCTION public.documento_tipos_uso() TO authenticated;

CREATE OR REPLACE FUNCTION public.reclasificar_documentos()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := public.get_user_org_id(); v_rev int; v_cam int;
BEGIN
  IF v_org IS NULL OR NOT public.puede_editar_catalogo_documentos() THEN
    RAISE EXCEPTION 'Sin permiso para reclasificar';
  END IF;
  SELECT count(*) INTO v_rev FROM public.brain_documents WHERE org_id = v_org;
  WITH n AS (
    SELECT b.id, public.clasificar_tipo_documento(v_org, b.codigo,
             substring(coalesce(b.notas,'') from 'Tipo en listado: ([^\n]*)')) AS nueva
      FROM public.brain_documents b WHERE b.org_id = v_org
  )
  UPDATE public.brain_documents b SET tipo_clave = n.nueva
    FROM n WHERE b.id = n.id AND b.tipo_clave IS DISTINCT FROM n.nueva;
  GET DIAGNOSTICS v_cam = ROW_COUNT;
  RETURN jsonb_build_object('revisados', v_rev, 'cambiados', v_cam);
END $$;
GRANT EXECUTE ON FUNCTION public.reclasificar_documentos() TO authenticated;

CREATE OR REPLACE FUNCTION public.org_documentos_inmutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR (OLD.sha256 IS NOT NULL AND NEW.sha256 IS DISTINCT FROM OLD.sha256)
     OR (OLD.sha256_servidor IS NOT NULL AND NEW.sha256_servidor IS DISTINCT FROM OLD.sha256_servidor)
     OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'El archivo original y su huella no se pueden modificar. Sube una nueva revisión.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_org_documentos_inmutable BEFORE UPDATE ON public.org_documentos
  FOR EACH ROW EXECUTE FUNCTION public.org_documentos_inmutable();

DROP POLICY IF EXISTS "Org admin update org-documentos files" ON storage.objects;