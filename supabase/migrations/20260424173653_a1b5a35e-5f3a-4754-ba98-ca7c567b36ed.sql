-- Allow org admins to hard-delete their own org documents (in addition to super admin)
DROP POLICY IF EXISTS "Super admin hard delete org_documentos" ON public.org_documentos;

CREATE POLICY "Org admin hard delete org_documentos"
ON public.org_documentos
FOR DELETE
TO authenticated
USING (
  (
    org_id = public.get_user_org_id()
    AND public.has_role(auth.uid(), 'admin'::app_role)
    AND deleted_at IS NOT NULL
  )
  OR public.is_super_admin()
);

-- SECURITY DEFINER: permanent delete for a single doc with auth checks
CREATE OR REPLACE FUNCTION public.eliminar_documento_permanente(p_doc_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_path   TEXT;
  v_deleted TIMESTAMPTZ;
BEGIN
  SELECT org_id, storage_path, deleted_at
    INTO v_org_id, v_path, v_deleted
  FROM public.org_documentos
  WHERE id = p_doc_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Documento no encontrado';
  END IF;

  IF NOT (
    (v_org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
    OR public.is_super_admin()
  ) THEN
    RAISE EXCEPTION 'No autorizado para eliminar este documento';
  END IF;

  IF v_deleted IS NULL THEN
    RAISE EXCEPTION 'El documento debe estar en la papelera antes de eliminarse permanentemente';
  END IF;

  DELETE FROM public.org_documentos WHERE id = p_doc_id;
  RETURN v_path;
END;
$$;

-- Purga de documentos con >30 días en papelera. Devuelve los storage_path borrados
-- para que el cliente / edge function pueda eliminarlos también del bucket.
CREATE OR REPLACE FUNCTION public.purgar_documentos_expirados()
RETURNS TABLE(id uuid, storage_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  WITH purgados AS (
    DELETE FROM public.org_documentos
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days'
    RETURNING org_documentos.id, org_documentos.storage_path
  )
  SELECT p.id, p.storage_path FROM purgados p;
END;
$$;