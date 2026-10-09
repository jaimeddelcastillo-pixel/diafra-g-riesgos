-- C6a.4
CREATE TABLE public.brain_extracciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  archivo_id uuid NOT NULL REFERENCES public.org_documentos(id),
  documento_id uuid REFERENCES public.brain_documents(id) ON DELETE SET NULL,
  sha256 text NOT NULL,
  metodo text NOT NULL,
  modelo text NOT NULL,
  paginas_totales integer,
  paginas_leidas integer,
  truncado boolean NOT NULL DEFAULT false,
  texto text,
  solicitado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brain_extracciones_archivo_idx ON public.brain_extracciones(archivo_id);
GRANT SELECT ON public.brain_extracciones TO authenticated;
GRANT ALL ON public.brain_extracciones TO service_role;
ALTER TABLE public.brain_extracciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY brain_extracciones_select_org ON public.brain_extracciones FOR SELECT TO authenticated
  USING (((org_id = public.get_user_org_id()) OR public.is_super_admin()) AND public.mi_org_tiene_modulo('institutional_brain'));
CREATE TRIGGER trg_audit_brain_extracciones AFTER INSERT OR DELETE OR UPDATE ON public.brain_extracciones
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

ALTER TABLE public.brain_knowledge_sources ADD COLUMN extraccion_id uuid REFERENCES public.brain_extracciones(id);

-- Retención: archivos con extracciones no se purgan
CREATE OR REPLACE FUNCTION public.org_documento_retencion(p_id uuid)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_clas text;
BEGIN
  SELECT clasificacion INTO v_clas FROM public.org_documentos WHERE id = p_id;
  IF v_clas = 'controlado' THEN RETURN 'controlado'; END IF;
  IF to_regclass('public.brain_documents') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.brain_documents b WHERE b.archivo_id = p_id) THEN RETURN 'cerebro'; END IF;
  IF to_regclass('public.brain_knowledge_sources') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.brain_knowledge_sources s WHERE s.archivo_id = p_id) THEN RETURN 'cerebro'; END IF;
  IF to_regclass('public.brain_extracciones') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.brain_extracciones e WHERE e.archivo_id = p_id) THEN RETURN 'cerebro'; END IF;
  RETURN NULL;
END $function$;

-- Parte D: propuestas
ALTER TABLE public.brain_documents
  ADD COLUMN estado_propuesto text CHECK (estado_propuesto IN ('obsoleto','cancelado')),
  ADD COLUMN estado_evidencia text,
  ADD COLUMN estado_confianza text CHECK (estado_confianza IN ('alta','media','baja')),
  ADD COLUMN requiere_confirmacion boolean NOT NULL DEFAULT false,
  ADD COLUMN estado_propuesto_en timestamptz,
  ADD COLUMN enlace_por_confirmar boolean NOT NULL DEFAULT false,
  ADD COLUMN enlace_revision_detectada text,
  ADD COLUMN enlace_evidencia text;

ALTER TABLE public.org_documentos
  ADD COLUMN copia_no_controlada_propuesta boolean NOT NULL DEFAULT false,
  ADD COLUMN copia_no_controlada_evidencia text,
  ADD COLUMN copia_no_controlada boolean NOT NULL DEFAULT false;

-- Guarda: estado y propuestas solo admin/RS de la empresa activa o super_admin. Procesos del servidor (sin usuario) pueden registrar propuestas.
CREATE OR REPLACE FUNCTION public.brain_documents_estado_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_ctx record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.estado_propuesto IS DISTINCT FROM OLD.estado_propuesto
     OR NEW.estado_evidencia IS DISTINCT FROM OLD.estado_evidencia
     OR NEW.estado_confianza IS DISTINCT FROM OLD.estado_confianza
     OR NEW.requiere_confirmacion IS DISTINCT FROM OLD.requiere_confirmacion
     OR NEW.enlace_por_confirmar IS DISTINCT FROM OLD.enlace_por_confirmar
     OR NEW.enlace_revision_detectada IS DISTINCT FROM OLD.enlace_revision_detectada
     OR NEW.enlace_evidencia IS DISTINCT FROM OLD.enlace_evidencia THEN
    SELECT * INTO v_ctx FROM public.contexto_org_actual();
    IF NOT (coalesce(v_ctx.es_super_admin,false)
            OR (v_ctx.org_id = NEW.org_id AND v_ctx.rol_en_org IN ('admin','responsable_sanitario'))) THEN
      RAISE EXCEPTION 'Solo administradores o responsable sanitario de esta empresa pueden cambiar el estado del documento o sus propuestas';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER trg_brain_documents_estado_guard BEFORE UPDATE ON public.brain_documents
  FOR EACH ROW EXECUTE FUNCTION public.brain_documents_estado_guard();

CREATE OR REPLACE FUNCTION public.org_documentos_copia_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_ctx record;
BEGIN
  IF NEW.copia_no_controlada AND NEW.clasificacion = 'controlado' THEN
    RAISE EXCEPTION 'Una copia no controlada no puede quedar clasificada como controlado';
  END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.copia_no_controlada IS DISTINCT FROM OLD.copia_no_controlada
     OR NEW.copia_no_controlada_propuesta IS DISTINCT FROM OLD.copia_no_controlada_propuesta
     OR NEW.copia_no_controlada_evidencia IS DISTINCT FROM OLD.copia_no_controlada_evidencia THEN
    SELECT * INTO v_ctx FROM public.contexto_org_actual();
    IF NOT (coalesce(v_ctx.es_super_admin,false)
            OR (v_ctx.org_id = NEW.org_id AND v_ctx.rol_en_org IN ('admin','responsable_sanitario'))) THEN
      RAISE EXCEPTION 'Solo administradores o responsable sanitario pueden confirmar o descartar la propuesta de copia no controlada';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER trg_org_documentos_copia_guard BEFORE UPDATE ON public.org_documentos
  FOR EACH ROW EXECUTE FUNCTION public.org_documentos_copia_guard();

-- Parte F: revisión atendida
ALTER TABLE public.brain_knowledge_items
  ADD COLUMN revision_confirmada text,
  ADD COLUMN revision_confirmada_por uuid,
  ADD COLUMN revision_confirmada_en timestamptz,
  ADD COLUMN revision_comentario text;

CREATE OR REPLACE FUNCTION public.brain_knowledge_items_revision_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_ctx record;
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado IN ('obsoleto','sustituido','rechazado') THEN
    NEW.requiere_revision := false;
    RETURN NEW;
  END IF;
  IF (OLD.requiere_revision AND NOT coalesce(NEW.requiere_revision,false))
     OR NEW.revision_confirmada IS DISTINCT FROM OLD.revision_confirmada
     OR NEW.revision_comentario IS DISTINCT FROM OLD.revision_comentario THEN
    IF auth.uid() IS NOT NULL THEN
      SELECT * INTO v_ctx FROM public.contexto_org_actual();
      IF NOT (coalesce(v_ctx.es_super_admin,false)
              OR (v_ctx.org_id = NEW.org_id AND v_ctx.rol_en_org IN ('admin','responsable_sanitario'))) THEN
        RAISE EXCEPTION 'Solo administradores o responsable sanitario pueden atender la revisión';
      END IF;
    END IF;
    IF OLD.requiere_revision AND NOT coalesce(NEW.requiere_revision,false) THEN
      IF coalesce(btrim(NEW.revision_confirmada),'') = '' THEN
        RAISE EXCEPTION 'Para quitar la marca indica la revisión que sigue vigente';
      END IF;
      NEW.revision_confirmada_por := auth.uid();
      NEW.revision_confirmada_en := now();
    END IF;
  ELSE
    NEW.revision_confirmada_por := OLD.revision_confirmada_por;
    NEW.revision_confirmada_en := OLD.revision_confirmada_en;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER trg_brain_knowledge_items_revision BEFORE UPDATE ON public.brain_knowledge_items
  FOR EACH ROW EXECUTE FUNCTION public.brain_knowledge_items_revision_guard();

-- Punto 3: vigencia también marca lo extraído de archivos
CREATE OR REPLACE FUNCTION public.brain_documents_vigencia()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_obs boolean; v_motivo text;
BEGIN
  IF coalesce(btrim(NEW.codigo),'') = '' THEN RETURN NEW; END IF;
  v_obs := public.normalizar_txt(NEW.estado) IN ('obsoleto','obsoleta','no vigente','cancelado','cancelada','retirado','retirada','baja');
  IF TG_OP = 'UPDATE' AND NOT (NEW.revision IS DISTINCT FROM OLD.revision
       OR (v_obs AND public.normalizar_txt(OLD.estado) IS DISTINCT FROM public.normalizar_txt(NEW.estado))) THEN
    RETURN NEW;
  END IF;
  v_motivo := CASE WHEN v_obs
    THEN format('El Listado Maestro marcó %s como %s.', NEW.codigo, NEW.estado)
    ELSE format('El Listado Maestro tiene vigente la revisión %s de %s; la fuente cita otra revisión.', coalesce(NEW.revision,'(sin revisión)'), NEW.codigo) END;
  UPDATE public.brain_knowledge_items k
     SET requiere_revision = true, motivo_revision = v_motivo
   WHERE k.org_id = NEW.org_id
     AND k.estado NOT IN ('obsoleto','sustituido','rechazado')
     AND EXISTS (
       SELECT 1 FROM public.brain_knowledge_sources s
        WHERE s.knowledge_item_id = k.id AND s.tipo_fuente IN ('documento','archivo')
          AND (s.documento_id = NEW.id OR public.codigo_tokens(s.documento_codigo) = public.codigo_tokens(NEW.codigo))
          AND (v_obs OR coalesce(btrim(s.documento_revision),'') IS DISTINCT FROM coalesce(btrim(NEW.revision),'')));
  RETURN NEW;
END $function$;