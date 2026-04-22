-- ============================================
-- 1. BUCKETS DE STORAGE
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('tracea-recursos', 'tracea-recursos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('org-documentos', 'org-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. POLÍTICAS DE STORAGE
-- ============================================

-- tracea-recursos: lectura pública
CREATE POLICY "Public read tracea-recursos"
ON storage.objects FOR SELECT
USING (bucket_id = 'tracea-recursos');

-- org-documentos: lectura por miembros de la org (carpeta = org_id)
CREATE POLICY "Org members read own org-documentos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'org-documentos'
  AND (
    (storage.foldername(name))[1] = public.get_user_org_id()::text
    OR public.is_super_admin()
  )
);

-- org-documentos: insertar archivos en su propia carpeta
CREATE POLICY "Org members upload own org-documentos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-documentos'
  AND (
    (storage.foldername(name))[1] = public.get_user_org_id()::text
    OR public.is_super_admin()
  )
);

-- org-documentos: eliminar solo admin de la org o super admin
CREATE POLICY "Org admin delete own org-documentos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-documentos'
  AND (
    (
      (storage.foldername(name))[1] = public.get_user_org_id()::text
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
    )
    OR public.is_super_admin()
  )
);

-- ============================================
-- 3. TABLA org_documentos
-- ============================================
CREATE TABLE public.org_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  usar_en_ia BOOLEAN NOT NULL DEFAULT true,
  creado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_documentos_org_id ON public.org_documentos(org_id);

ALTER TABLE public.org_documentos ENABLE ROW LEVEL SECURITY;

-- Lectura: miembros de la org
CREATE POLICY "Org members read org_documentos"
ON public.org_documentos FOR SELECT
TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

-- Insertar: miembros de la org
CREATE POLICY "Org members insert org_documentos"
ON public.org_documentos FOR INSERT
TO authenticated
WITH CHECK (
  (org_id = public.get_user_org_id() AND creado_por = auth.uid())
  OR public.is_super_admin()
);

-- Actualizar: admin de la org
CREATE POLICY "Org admin update org_documentos"
ON public.org_documentos FOR UPDATE
TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::public.app_role))
  OR public.is_super_admin()
)
WITH CHECK (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::public.app_role))
  OR public.is_super_admin()
);

-- Eliminar: solo admin de la org
CREATE POLICY "Org admin delete org_documentos"
ON public.org_documentos FOR DELETE
TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::public.app_role))
  OR public.is_super_admin()
);

-- Trigger updated_at
CREATE TRIGGER trg_org_documentos_updated_at
BEFORE UPDATE ON public.org_documentos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Audit trail
CREATE TRIGGER trg_org_documentos_audit
AFTER INSERT OR UPDATE OR DELETE ON public.org_documentos
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_func();