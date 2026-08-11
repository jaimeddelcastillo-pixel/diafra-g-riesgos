ALTER TABLE public.brain_contradictions
  ADD COLUMN IF NOT EXISTS tema text,
  ADD COLUMN IF NOT EXISTS riesgo_potencial text,
  ADD COLUMN IF NOT EXISTS autoridad_requerida text,
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.brain_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.brain_interview_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS brain_contradictions_tema_idx ON public.brain_contradictions (org_id, estado);