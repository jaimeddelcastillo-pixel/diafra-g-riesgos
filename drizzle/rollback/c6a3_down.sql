-- Rollback C6a.3 (extracción de conocimiento desde Recursos).
-- No borra conocimiento ni fuentes ya creadas; solo retira columnas y revierte la retención.

-- 1) Revertir org_documento_retencion a la versión C6a.2 (sin contar citas de conocimiento).
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
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.org_documento_retencion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_documento_retencion(uuid) TO authenticated, service_role;

-- 2) Retirar columnas de trazabilidad de extracción.
ALTER TABLE public.brain_knowledge_sources
  DROP COLUMN IF EXISTS archivo_id,
  DROP COLUMN IF EXISTS pagina,
  DROP COLUMN IF EXISTS parrafo,
  DROP COLUMN IF EXISTS seccion,
  DROP COLUMN IF EXISTS metodo;

ALTER TABLE public.brain_documents
  DROP COLUMN IF EXISTS archivo_nombre;

-- 3) La función brain-extract-document se retira del despliegue (no es objeto de base de datos).
