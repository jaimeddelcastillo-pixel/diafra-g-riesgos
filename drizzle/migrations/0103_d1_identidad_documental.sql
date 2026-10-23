-- D1: identidad documental versionada por empresa, formatos por tipo de documento y registro de documentos generados.
CREATE TABLE public.org_identidad_documental(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id),
  version integer NOT NULL, razon_social text NOT NULL DEFAULT '', domicilio text NOT NULL DEFAULT '',
  leyenda_confidencialidad text NOT NULL DEFAULT '', leyenda_copia text NOT NULL DEFAULT 'Documento controlado' CHECK (leyenda_copia IN ('Documento controlado','Copia no controlada')),
  pie text NOT NULL DEFAULT '', motivo text NOT NULL CHECK (length(btrim(motivo))>=5),
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, UNIQUE(org_id,version));
CREATE TABLE public.org_formatos(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id),
  tipo text NOT NULL CHECK (tipo ~ '^[a-z_]+\.[a-z0-9_]+$'), version integer NOT NULL,
  codigo text NOT NULL DEFAULT '', version_formato text NOT NULL DEFAULT '', titulo text NOT NULL DEFAULT '',
  firmas jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(firmas)='array'), vigente_desde date,
  motivo text NOT NULL CHECK (length(btrim(motivo))>=5), created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
  UNIQUE(org_id,tipo,version));
CREATE SEQUENCE public.documentos_generados_folio_seq;
CREATE TABLE public.documentos_generados(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id),
  folio text NOT NULL UNIQUE, tipo text NOT NULL, formato_id uuid REFERENCES public.org_formatos(id), identidad_id uuid REFERENCES public.org_identidad_documental(id),
  formato_version integer, identidad_version integer, nombre_archivo text NOT NULL DEFAULT '',
  generado_por uuid, generado_en timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_org_formatos_vigente ON public.org_formatos(org_id,tipo,version DESC);
CREATE INDEX idx_documentos_generados_org ON public.documentos_generados(org_id,generado_en DESC);

GRANT SELECT ON public.org_identidad_documental, public.org_formatos, public.documentos_generados TO authenticated;
GRANT ALL ON public.org_identidad_documental, public.org_formatos, public.documentos_generados TO service_role;
ALTER TABLE public.org_identidad_documental ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_formatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_generados ENABLE ROW LEVEL SECURITY;
CREATE POLICY identidad_select ON public.org_identidad_documental FOR SELECT TO authenticated USING (org_id=(SELECT public.get_user_org_id()));
CREATE POLICY formatos_select ON public.org_formatos FOR SELECT TO authenticated USING (org_id=(SELECT public.get_user_org_id()));
CREATE POLICY documentos_select ON public.documentos_generados FOR SELECT TO authenticated USING (org_id=(SELECT public.get_user_org_id()));

-- Insert-only: each save is a new version; nothing is updated or deleted.
CREATE OR REPLACE FUNCTION public.documental_solo_insercion() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Registro documental inalterable: guarda una versión nueva';END IF;
  IF TG_TABLE_NAME<>'documentos_generados' AND length(btrim(coalesce(NEW.motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)';END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON public.org_identidad_documental FOR EACH ROW EXECUTE FUNCTION public.documental_solo_insercion();
CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON public.org_formatos FOR EACH ROW EXECUTE FUNCTION public.documental_solo_insercion();
CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON public.documentos_generados FOR EACH ROW EXECUTE FUNCTION public.documental_solo_insercion();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.org_identidad_documental FOR EACH STATEMENT EXECUTE FUNCTION public.documental_solo_insercion();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.org_formatos FOR EACH STATEMENT EXECUTE FUNCTION public.documental_solo_insercion();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON public.documentos_generados FOR EACH STATEMENT EXECUTE FUNCTION public.documental_solo_insercion();
CREATE TRIGGER audit AFTER INSERT ON public.org_identidad_documental FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit AFTER INSERT ON public.org_formatos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit AFTER INSERT ON public.documentos_generados FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE OR REPLACE FUNCTION public.documental_puede_editar() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario') OR public.has_role(auth.uid(),'aseguramiento_calidad') $$;

CREATE OR REPLACE FUNCTION public.guardar_identidad_documental(_razon_social text,_domicilio text,_confidencialidad text,_copia text,_pie text,_motivo text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); nid uuid; BEGIN
  IF org IS NULL OR NOT public.documental_puede_editar() THEN RAISE EXCEPTION 'Sin permiso para editar la identidad documental';END IF;
  IF length(btrim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)';END IF;
  PERFORM pg_advisory_xact_lock(hashtext('identidad:'||org));
  PERFORM set_config('tracea.motivo',btrim(_motivo),true);
  INSERT INTO public.org_identidad_documental(org_id,version,razon_social,domicilio,leyenda_confidencialidad,leyenda_copia,pie,motivo,created_by)
  SELECT org,coalesce(max(version),0)+1,btrim(coalesce(_razon_social,'')),btrim(coalesce(_domicilio,'')),btrim(coalesce(_confidencialidad,'')),coalesce(nullif(_copia,''),'Documento controlado'),btrim(coalesce(_pie,'')),btrim(_motivo),auth.uid()
  FROM public.org_identidad_documental WHERE org_id=org RETURNING id INTO nid;
  RETURN nid; END $$;

CREATE OR REPLACE FUNCTION public.guardar_formato_documento(_tipo text,_codigo text,_version text,_titulo text,_firmas jsonb,_vigente_desde date,_motivo text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); nid uuid; BEGIN
  IF org IS NULL OR NOT public.documental_puede_editar() THEN RAISE EXCEPTION 'Sin permiso para editar formatos';END IF;
  IF length(btrim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)';END IF;
  PERFORM pg_advisory_xact_lock(hashtext('formato:'||org||':'||_tipo));
  PERFORM set_config('tracea.motivo',btrim(_motivo),true);
  INSERT INTO public.org_formatos(org_id,tipo,version,codigo,version_formato,titulo,firmas,vigente_desde,motivo,created_by)
  SELECT org,_tipo,coalesce(max(version),0)+1,btrim(coalesce(_codigo,'')),btrim(coalesce(_version,'')),btrim(coalesce(_titulo,'')),coalesce(_firmas,'[]'::jsonb),_vigente_desde,btrim(_motivo),auth.uid()
  FROM public.org_formatos WHERE org_id=org AND tipo=_tipo RETURNING id INTO nid;
  RETURN nid; END $$;

-- Any member of the active company registers the documents it exports; returns the versions used and the TRACEA folio.
CREATE OR REPLACE FUNCTION public.registrar_documento_generado(_tipo text,_nombre_archivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); f public.org_formatos; i public.org_identidad_documental; fol text; BEGIN
  IF org IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Sin empresa activa';END IF;
  IF _tipo IS NULL OR _tipo !~ '^[a-z_]+\.[a-z0-9_]+$' THEN RAISE EXCEPTION 'Tipo de documento inválido';END IF;
  SELECT * INTO f FROM public.org_formatos WHERE org_id=org AND tipo=_tipo ORDER BY version DESC LIMIT 1;
  SELECT * INTO i FROM public.org_identidad_documental WHERE org_id=org ORDER BY version DESC LIMIT 1;
  fol:='DOC-'||to_char(now() AT TIME ZONE 'America/Mexico_City','YYYY')||'-'||lpad(nextval('public.documentos_generados_folio_seq')::text,6,'0');
  INSERT INTO public.documentos_generados(org_id,folio,tipo,formato_id,identidad_id,formato_version,identidad_version,nombre_archivo,generado_por)
  VALUES(org,fol,_tipo,f.id,i.id,f.version,i.version,coalesce(_nombre_archivo,''),auth.uid());
  RETURN jsonb_build_object('folio',fol,'generado_en',now(),'formato',CASE WHEN f.id IS NOT NULL THEN to_jsonb(f) END,'identidad',CASE WHEN i.id IS NOT NULL THEN to_jsonb(i) END);
END $$;
REVOKE ALL ON FUNCTION public.guardar_identidad_documental(text,text,text,text,text,text), public.guardar_formato_documento(text,text,text,text,jsonb,date,text), public.registrar_documento_generado(text,text), public.documental_puede_editar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_identidad_documental(text,text,text,text,text,text), public.guardar_formato_documento(text,text,text,text,jsonb,date,text), public.registrar_documento_generado(text,text), public.documental_puede_editar() TO authenticated;
GRANT USAGE ON SEQUENCE public.documentos_generados_folio_seq TO service_role;

-- K2-a: an unchanged cell is «sin cambio» even in an open period; «Periodo abierto» blocks only new or changed cells.
CREATE OR REPLACE FUNCTION public.previsualizar_resultados_excel(_celdas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE org uuid:=public.get_user_org_id(); hoy date:=(now() AT TIME ZONE 'America/Mexico_City')::date; salida jsonb;
BEGIN
IF org IS NULL OR auth.uid() IS NULL OR NOT public.org_tiene_modulo(org,'indicadores') THEN RAISE EXCEPTION 'Sin acceso a Indicadores'; END IF;
IF jsonb_typeof(_celdas) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Archivo de resultados inválido'; END IF;
IF jsonb_array_length(_celdas)>5000 THEN RAISE EXCEPTION 'Límite de 5 000 celdas'; END IF;
WITH entrada AS MATERIALIZED (
 SELECT e.value celda,e.ordinality orden,e.value->>'tipo' tipo,e.value->>'codigo' codigo,public.kpi_excel_fecha(e.value->>'inicio') inicio,public.kpi_excel_numero(e.value->>'numerador') num,public.kpi_excel_numero(e.value->>'denominador') den,btrim(coalesce(e.value->>'referencia','')) referencia FROM jsonb_array_elements(_celdas) WITH ORDINALITY e
), catalogo AS MATERIALIZED (
 SELECT d.id,'SGC'::text tipo,'kpi_definiciones'::text tabla,d.codigo,d.activo,d.estado,d.frecuencia,d.unidad,d.meta,d.tendencia,d.nivel='SGC' sgc,d.capturistas FROM public.kpi_definiciones d WHERE d.org_id=org AND EXISTS(SELECT 1 FROM entrada e WHERE e.tipo='SGC' AND e.codigo=d.codigo)
 UNION ALL SELECT p.id,'puesto','kpi_puesto',p.codigo,p.activo,p.estado,p.frecuencia,p.unidad,p.meta,p.tendencia,false,p.capturistas FROM public.kpi_puesto p WHERE p.org_id=org AND EXISTS(SELECT 1 FROM entrada e WHERE e.tipo='puesto' AND e.codigo=p.codigo)
), permisos AS MATERIALIZED (SELECT k.*,public.kpi_puede_capturar(org,k.capturistas) permiso FROM catalogo k), filas AS (
 SELECT e.*,k.id kpi_id,k.tabla,k.unidad,k.meta,k.tendencia,r.id resultado_id,r.numerador anterior_num,r.denominador anterior_den,r.referencia_fuente anterior_ref,r.comentario,coalesce(r.unidad_copia,k.unidad) unidad_calculo,coalesce(r.meta_copia,k.meta) meta_calculo,coalesce(r.tendencia_copia,k.tendencia) tendencia_calculo,
 concat_ws('; ',CASE WHEN k.id IS NULL THEN 'KPI inexistente' WHEN NOT k.activo OR k.estado<>'validado' THEN 'KPI en borrador o inactivo' END,CASE WHEN k.id IS NOT NULL AND NOT k.permiso THEN 'Sin permiso de captura' END,
 CASE WHEN e.inicio IS NULL OR per.inicio IS NULL OR e.inicio IS DISTINCT FROM per.inicio THEN 'Periodo inválido para la frecuencia' WHEN per.fin>=hoy THEN 'Periodo abierto' END,
 CASE WHEN e.num IS NULL THEN 'Numerador inválido' END,
 CASE WHEN coalesce(r.unidad_copia,k.unidad)<>'número' AND e.den IS NULL THEN 'Denominador faltante o inválido' WHEN btrim(coalesce(e.celda->>'denominador',''))<>'' AND e.den IS NULL THEN 'Denominador inválido' END,
 CASE WHEN k.sgc AND e.referencia='' THEN 'SGC sin referencia de la fuente' END,
 CASE WHEN count(*) OVER(PARTITION BY e.tipo,e.codigo,e.celda->>'inicio')>1 THEN 'Celda duplicada' END) error
 FROM entrada e LEFT JOIN permisos k ON k.tipo=e.tipo AND k.codigo=e.codigo LEFT JOIN LATERAL public.kpi_excel_periodo(k.frecuencia,e.inicio) per ON true LEFT JOIN public.kpi_resultados r ON r.org_id=org AND r.activo AND ((k.tabla='kpi_definiciones' AND r.kpi_definicion_id=k.id) OR (k.tabla='kpi_puesto' AND r.kpi_puesto_id=k.id)) AND r.periodo_inicio=e.inicio
)
SELECT coalesce(jsonb_agg(jsonb_build_object('celda',f.celda,'tabla',f.tabla,'kpi_id',f.kpi_id,'resultado_id',f.resultado_id,'estado',CASE WHEN (f.resultado_id IS NOT NULL AND f.num IS NOT DISTINCT FROM f.anterior_num AND f.den IS NOT DISTINCT FROM f.anterior_den AND f.referencia IS NOT DISTINCT FROM f.anterior_ref AND f.error IN ('','Periodo abierto')) THEN 'sin cambio' WHEN f.error<>'' THEN 'error' WHEN f.resultado_id IS NULL THEN 'nuevo' ELSE 'cambia' END,'error',CASE WHEN (f.resultado_id IS NOT NULL AND f.num IS NOT DISTINCT FROM f.anterior_num AND f.den IS NOT DISTINCT FROM f.anterior_den AND f.referencia IS NOT DISTINCT FROM f.anterior_ref AND f.error IN ('','Periodo abierto')) THEN '' ELSE f.error END,'antes',CASE WHEN f.resultado_id IS NOT NULL THEN jsonb_build_object('numerador',f.anterior_num,'denominador',f.anterior_den,'referencia',f.anterior_ref) END,'despues',jsonb_build_object('numerador',f.num,'denominador',f.den,'referencia',f.referencia),'comentario',coalesce(f.comentario,''),'valor',calc.valor,'cumplimiento',calc.cumplimiento,'semaforo',calc.semaforo) ORDER BY f.orden),'[]'::jsonb) INTO salida FROM filas f LEFT JOIN LATERAL public.kpi_calcular(f.unidad_calculo,f.tendencia_calculo,f.meta_calculo,CASE WHEN f.error='' THEN f.num END,CASE WHEN f.error='' THEN f.den END) calc ON f.error='';
RETURN salida; END $function$;
