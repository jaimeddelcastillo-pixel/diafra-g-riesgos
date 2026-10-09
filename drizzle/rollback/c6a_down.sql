-- C6a rollback (se amplía con C6a.2 y C6a.3; ejecutar en orden inverso).
-- ===== C6a.2 (migración 0015_c6a2_retencion_enlace_vigencia) — ejecutar ANTES que el bloque C6a.1 =====
DROP TRIGGER IF EXISTS trg_brain_documents_vigencia ON public.brain_documents;
DROP FUNCTION IF EXISTS public.brain_documents_vigencia();
ALTER TABLE public.brain_knowledge_items DROP COLUMN IF EXISTS motivo_revision;
ALTER TABLE public.brain_knowledge_items DROP COLUMN IF EXISTS requiere_revision;
DROP FUNCTION IF EXISTS public.brain_resolver_enlace(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.brain_sugerencias_enlace();
DROP TABLE IF EXISTS public.brain_enlace_descartes;
DROP FUNCTION IF EXISTS public.codigo_tokens(text);
CREATE OR REPLACE FUNCTION public.purgar_documentos_eliminados() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_count INTEGER;
BEGIN
  WITH deleted AS (DELETE FROM public.org_documentos WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days' RETURNING id)
  SELECT COUNT(*) INTO v_count FROM deleted;
  RETURN v_count;
END $$;
CREATE OR REPLACE FUNCTION public.purgar_documentos_expirados() RETURNS TABLE(id uuid, storage_path text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN QUERY WITH purgados AS (
    DELETE FROM public.org_documentos WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'
    RETURNING org_documentos.id, org_documentos.storage_path)
  SELECT p.id, p.storage_path FROM purgados p;
END $$;
DROP FUNCTION IF EXISTS public.retirar_documento(uuid, text);
DROP TRIGGER IF EXISTS trg_org_documentos_retencion ON public.org_documentos;
DROP FUNCTION IF EXISTS public.org_documentos_retencion_guard();
DROP FUNCTION IF EXISTS public.documentos_retenidos(uuid[]);
DROP FUNCTION IF EXISTS public.org_documento_retencion(uuid);
DROP INDEX IF EXISTS public.brain_documents_archivo_idx;
ALTER TABLE public.brain_documents DROP COLUMN IF EXISTS archivo_id;
-- Ojo: al quitar las columnas de retiro se pierde quién/cuándo/motivo; la bitácora conserva DOCUMENTO_RETIRADO.
ALTER TABLE public.org_documentos DROP COLUMN IF EXISTS motivo_retiro;
ALTER TABLE public.org_documentos DROP COLUMN IF EXISTS retirado_por;
ALTER TABLE public.org_documentos DROP COLUMN IF EXISTS retirado_en;
ALTER TABLE public.org_documentos DROP COLUMN IF EXISTS nombre_archivo_original;

-- ===== C6a.1 (migración 0014_c6a1_catalogo_tipos_documento) =====
CREATE POLICY "Org admin update org-documentos files" ON storage.objects FOR UPDATE
  USING ((bucket_id = 'org-documentos') AND (is_super_admin() OR (((storage.foldername(name))[1] = (get_user_org_id())::text) AND has_role(auth.uid(), 'admin'::app_role))))
  WITH CHECK ((bucket_id = 'org-documentos') AND (is_super_admin() OR (((storage.foldername(name))[1] = (get_user_org_id())::text) AND has_role(auth.uid(), 'admin'::app_role))));

DROP TRIGGER IF EXISTS trg_org_documentos_inmutable ON public.org_documentos;
DROP FUNCTION IF EXISTS public.org_documentos_inmutable();

DROP FUNCTION IF EXISTS public.reclasificar_documentos();
DROP FUNCTION IF EXISTS public.documento_tipos_uso();
DROP FUNCTION IF EXISTS public.restaurar_documento_tipos();
DROP FUNCTION IF EXISTS public.quitar_documento_tipo(uuid);
DROP FUNCTION IF EXISTS public.clasificar_tipos_documento(uuid, jsonb);
DROP FUNCTION IF EXISTS public.clasificar_tipo_documento(uuid, text, text);

ALTER TABLE public.org_documentos DROP COLUMN IF EXISTS sha256_verificado_en;
ALTER TABLE public.org_documentos DROP COLUMN IF EXISTS sha256_servidor;
ALTER TABLE public.org_documentos DROP COLUMN IF EXISTS clasificacion;
ALTER TABLE public.org_documentos DROP COLUMN IF EXISTS tipo_clave;
ALTER TABLE public.brain_documents DROP COLUMN IF EXISTS tipo_clave;

DROP TRIGGER IF EXISTS trg_seed_documento_tipos ON public.organizations;
DROP FUNCTION IF EXISTS public.seed_documento_tipos_trigger();
DROP FUNCTION IF EXISTS public.seed_documento_tipos(uuid);

DROP TABLE IF EXISTS public.documento_tipos_config;
DROP TABLE IF EXISTS public.documento_tipos;
DROP FUNCTION IF EXISTS public.puede_editar_catalogo_documentos();
DROP FUNCTION IF EXISTS public.normalizar_txt(text);
-- Los eventos ya escritos en la bitácora se conservan (bitácora inalterable).
