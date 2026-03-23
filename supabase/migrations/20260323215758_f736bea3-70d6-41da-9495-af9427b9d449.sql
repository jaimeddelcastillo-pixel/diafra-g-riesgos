-- Create storage bucket for risk evidence attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('evidencias', 'evidencias', false);

-- Allow authenticated users to upload to evidencias bucket
CREATE POLICY "Authenticated users can upload evidencias"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'evidencias');

-- Allow authenticated users to read evidencias
CREATE POLICY "Authenticated users can read evidencias"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'evidencias');

-- Allow admin to delete evidencias
CREATE POLICY "Admin can delete evidencias"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'evidencias' AND public.has_role(auth.uid(), 'admin'));

-- Add anexos column to riesgos to store file paths
ALTER TABLE public.riesgos ADD COLUMN IF NOT EXISTS anexos jsonb DEFAULT '[]'::jsonb;
