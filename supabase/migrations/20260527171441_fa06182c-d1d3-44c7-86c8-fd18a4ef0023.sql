
-- 1) Tabla catálogo de archivos por producto addon
CREATE TABLE public.addon_archivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producto TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.addon_archivos TO authenticated;
GRANT ALL ON public.addon_archivos TO service_role;

ALTER TABLE public.addon_archivos ENABLE ROW LEVEL SECURITY;

-- Miembros de orgs que hayan comprado el producto pueden ver el catálogo activo
CREATE POLICY "Compradores leen catálogo activo"
ON public.addon_archivos
FOR SELECT
TO authenticated
USING (
  activo = true
  AND (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.addon_purchases ap
      WHERE ap.org_id = get_user_org_id()
        AND ap.producto = addon_archivos.producto
    )
  )
);

CREATE POLICY "Super admin gestiona catálogo"
ON public.addon_archivos
FOR ALL
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE TRIGGER addon_archivos_updated_at
BEFORE UPDATE ON public.addon_archivos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_addon_archivos_producto ON public.addon_archivos(producto, orden) WHERE activo = true;

-- 2) Bucket privado para protocolos
INSERT INTO storage.buckets (id, name, public)
VALUES ('addon-protocolos', 'addon-protocolos', false)
ON CONFLICT (id) DO NOTHING;

-- Solo super admin sube/edita/borra objetos
CREATE POLICY "Super admin sube protocolos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'addon-protocolos' AND is_super_admin());

CREATE POLICY "Super admin actualiza protocolos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'addon-protocolos' AND is_super_admin())
WITH CHECK (bucket_id = 'addon-protocolos' AND is_super_admin());

CREATE POLICY "Super admin elimina protocolos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'addon-protocolos' AND is_super_admin());

-- Compradores leen objetos (necesario también para signed URLs vía service_role,
-- pero esta policy permite además acceso directo desde el cliente si quisiéramos)
CREATE POLICY "Compradores leen protocolos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'addon-protocolos'
  AND (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.addon_purchases ap
      WHERE ap.org_id = get_user_org_id()
        AND ap.producto = 'protocolos'
    )
  )
);
