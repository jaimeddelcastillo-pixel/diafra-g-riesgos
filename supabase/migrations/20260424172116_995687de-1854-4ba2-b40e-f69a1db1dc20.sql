-- 1. Agregar campos de soft delete, versionado y hash a org_documentos
ALTER TABLE public.org_documentos
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS version_num INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_doc_id UUID,
  ADD COLUMN IF NOT EXISTS es_version_actual BOOLEAN NOT NULL DEFAULT true;

-- Índice para acelerar la consulta de papelera y purga
CREATE INDEX IF NOT EXISTS idx_org_documentos_deleted_at
  ON public.org_documentos (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_documentos_parent
  ON public.org_documentos (parent_doc_id)
  WHERE parent_doc_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_documentos_org_actual
  ON public.org_documentos (org_id, es_version_actual)
  WHERE deleted_at IS NULL AND es_version_actual = true;

-- 2. Reemplazar políticas para soportar papelera

-- Eliminar políticas existentes que conflictúan con el nuevo esquema
DROP POLICY IF EXISTS "Org members read org_documentos" ON public.org_documentos;
DROP POLICY IF EXISTS "Org admin delete org_documentos" ON public.org_documentos;
DROP POLICY IF EXISTS "Org admin update org_documentos" ON public.org_documentos;

-- Lectura: miembros ven solo documentos NO eliminados
CREATE POLICY "Org members read active org_documentos"
  ON public.org_documentos
  FOR SELECT
  TO authenticated
  USING (
    (org_id = public.get_user_org_id() AND deleted_at IS NULL)
    OR is_super_admin()
  );

-- Lectura adicional: admins de la org ven también documentos en papelera
CREATE POLICY "Org admin read trash org_documentos"
  ON public.org_documentos
  FOR SELECT
  TO authenticated
  USING (
    (org_id = public.get_user_org_id()
      AND public.has_role(auth.uid(), 'admin'::app_role))
    OR is_super_admin()
  );

-- Update: admins de la org pueden actualizar cualquier documento de su org
CREATE POLICY "Org admin update org_documentos"
  ON public.org_documentos
  FOR UPDATE
  TO authenticated
  USING (
    (org_id = public.get_user_org_id()
      AND public.has_role(auth.uid(), 'admin'::app_role))
    OR is_super_admin()
  )
  WITH CHECK (
    (org_id = public.get_user_org_id()
      AND public.has_role(auth.uid(), 'admin'::app_role))
    OR is_super_admin()
  );

-- Delete físico: SOLO super_admin (los admins de org usan soft delete vía UPDATE deleted_at)
CREATE POLICY "Super admin hard delete org_documentos"
  ON public.org_documentos
  FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- 3. Función para restaurar documento desde papelera
CREATE OR REPLACE FUNCTION public.restaurar_documento(p_doc_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT org_id INTO v_org_id
  FROM public.org_documentos
  WHERE id = p_doc_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Documento no encontrado';
  END IF;

  IF NOT (
    (v_org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
    OR public.is_super_admin()
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.org_documentos
  SET deleted_at = NULL,
      deleted_by = NULL,
      updated_at = NOW()
  WHERE id = p_doc_id;

  RETURN TRUE;
END;
$$;

-- 4. Función de purga automática (>30 días en papelera)
CREATE OR REPLACE FUNCTION public.purgar_documentos_eliminados()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM public.org_documentos
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  RETURN v_count;
END;
$$;

-- 5. Trigger para auto-incrementar version_num cuando se sube un nuevo documento
-- referenciando parent_doc_id, y marcar la versión anterior como no-actual
CREATE OR REPLACE FUNCTION public.handle_doc_versioning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_doc_id IS NOT NULL THEN
    -- Calcular el siguiente número de versión basado en el padre
    SELECT COALESCE(MAX(version_num), 0) + 1
    INTO NEW.version_num
    FROM public.org_documentos
    WHERE parent_doc_id = NEW.parent_doc_id
       OR id = NEW.parent_doc_id;

    -- Marcar todas las versiones anteriores como no-actuales
    UPDATE public.org_documentos
    SET es_version_actual = false
    WHERE (parent_doc_id = NEW.parent_doc_id OR id = NEW.parent_doc_id)
      AND id != NEW.id;

    NEW.es_version_actual := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_doc_versioning ON public.org_documentos;
CREATE TRIGGER trg_doc_versioning
  BEFORE INSERT ON public.org_documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_doc_versioning();