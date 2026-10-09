-- C6a.3: extracción de conocimiento desde archivos de Recursos.
ALTER TABLE public.brain_knowledge_sources
  ADD COLUMN IF NOT EXISTS archivo_id uuid REFERENCES public.org_documentos(id),
  ADD COLUMN IF NOT EXISTS pagina integer,
  ADD COLUMN IF NOT EXISTS parrafo integer,
  ADD COLUMN IF NOT EXISTS seccion text,
  ADD COLUMN IF NOT EXISTS metodo text;

ALTER TABLE public.brain_documents
  ADD COLUMN IF NOT EXISTS archivo_nombre text;

-- Retención ampliada: también retiene archivos con extracciones o conocimiento que los cita.
CREATE OR REPLACE FUNCTION public.org_documento_retencion(p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clas text;
BEGIN
  SELECT clasificacion INTO v_clas FROM public.org_documentos WHERE id = p_id;
  IF v_clas = 'controlado' THEN RETURN 'controlado'; END IF;
  IF to_regclass('public.brain_documents') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.brain_documents b WHERE b.archivo_id = p_id) THEN
    RETURN 'cerebro';
  END IF;
  IF to_regclass('public.brain_knowledge_sources') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.brain_knowledge_sources s WHERE s.archivo_id = p_id) THEN
    RETURN 'cerebro';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.org_documento_retencion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_documento_retencion(uuid) TO authenticated, service_role;