-- C6a rollback (se amplía con C6a.2 y C6a.3; ejecutar en orden inverso).
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
