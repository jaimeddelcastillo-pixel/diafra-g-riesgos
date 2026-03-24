-- Add firma_url column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS firma_url text;

-- Create firmas storage bucket (public for reading signatures)
INSERT INTO storage.buckets (id, name, public)
VALUES ('firmas', 'firmas', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Admins can upload signatures
CREATE POLICY "Admin upload firmas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'firmas'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::public.app_role)
  )
);

-- RLS: Anyone authenticated can read signatures
CREATE POLICY "Authenticated read firmas"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'firmas');

-- RLS: Admins can delete signatures
CREATE POLICY "Admin manage firmas"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'firmas'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::public.app_role)
  )
);