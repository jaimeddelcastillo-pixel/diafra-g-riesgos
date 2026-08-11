CREATE TABLE public.brain_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  tipo text NOT NULL DEFAULT 'listado_maestro',
  nombre_archivo text NOT NULL,
  storage_path text,
  formato text NOT NULL CHECK (formato IN ('xlsx','csv','txt','md','docx','pdf')),
  total_filas integer NOT NULL DEFAULT 0,
  filas_importadas integer NOT NULL DEFAULT 0,
  mapeo jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','procesando','completado','parcial','revertido')),
  imported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.brain_import_batches TO authenticated;
GRANT ALL ON public.brain_import_batches TO service_role;
ALTER TABLE public.brain_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brain_import_batches_select" ON public.brain_import_batches
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE TABLE public.brain_import_propuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES public.brain_import_batches(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('area','proceso')),
  nombre text NOT NULL,
  evidencia text,
  nivel_confianza text CHECK (nivel_confianza IN ('explicito','inferido')),
  estado text NOT NULL DEFAULT 'propuesta' CHECK (estado IN ('propuesta','aceptada','descartada')),
  area_id uuid REFERENCES public.brain_areas(id) ON DELETE SET NULL,
  proceso_id uuid REFERENCES public.brain_processes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.brain_import_propuestas TO authenticated;
GRANT ALL ON public.brain_import_propuestas TO service_role;
ALTER TABLE public.brain_import_propuestas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brain_import_propuestas_select" ON public.brain_import_propuestas
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "brain_import_propuestas_update" ON public.brain_import_propuestas
  FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() OR public.is_super_admin())
  WITH CHECK (org_id = public.get_user_org_id() OR public.is_super_admin());

ALTER TABLE public.brain_documents
  ADD COLUMN import_batch_id uuid REFERENCES public.brain_import_batches(id) ON DELETE SET NULL,
  ADD COLUMN import_row_reference integer,
  ADD COLUMN import_status text CHECK (import_status IN ('nuevo','actualizado','revisar')),
  ADD COLUMN origen text NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual','listado_maestro'));

CREATE OR REPLACE FUNCTION public.verify_document_batch_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.import_batch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.brain_import_batches b
      WHERE b.id = NEW.import_batch_id AND b.org_id = NEW.org_id
    ) THEN
      RAISE EXCEPTION 'fuera_de_org: import_batch_id no pertenece a la organización del documento';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER verify_document_batch_org
  BEFORE INSERT OR UPDATE ON public.brain_documents
  FOR EACH ROW EXECUTE FUNCTION public.verify_document_batch_org();

CREATE TRIGGER set_brain_import_batches_updated_at
  BEFORE UPDATE ON public.brain_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_import_batches_org ON public.brain_import_batches (org_id);
CREATE INDEX idx_import_propuestas_batch ON public.brain_import_propuestas (batch_id);
CREATE INDEX idx_brain_documents_batch ON public.brain_documents (import_batch_id) WHERE import_batch_id IS NOT NULL;

CREATE POLICY "brain_imports_org_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'brain-imports'
    AND (
      public.is_super_admin()
      OR (storage.foldername(name))[1] = public.get_user_org_id()::text
    )
  );