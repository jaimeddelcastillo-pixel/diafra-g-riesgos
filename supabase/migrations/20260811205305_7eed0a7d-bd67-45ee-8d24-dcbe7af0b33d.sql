-- brain_interview_turns: registro de idempotencia por turno de entrevista.
-- operations es metadata técnica exclusivamente — nunca conocimiento institucional.

CREATE TABLE public.brain_interview_turns (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES public.brain_interview_sessions(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CONSTRAINT turn_estado_check CHECK (estado IN ('pendiente','procesando','completado','fallido')),
  operations JSONB NOT NULL DEFAULT '{}',
  knowledge_created INTEGER NOT NULL DEFAULT 0,
  gaps_created INTEGER NOT NULL DEFAULT 0,
  contradictions_created INTEGER NOT NULL DEFAULT 0,
  interviewees_suggested INTEGER NOT NULL DEFAULT 0,
  current_objective JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

GRANT SELECT ON public.brain_interview_turns TO authenticated;
GRANT ALL ON public.brain_interview_turns TO service_role;

ALTER TABLE public.brain_interview_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "turns_select_org_members"
  ON public.brain_interview_turns FOR SELECT
  TO authenticated
  USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE INDEX idx_brain_turns_session ON public.brain_interview_turns (session_id);
CREATE INDEX idx_brain_turns_org_estado ON public.brain_interview_turns (org_id, estado);

CREATE OR REPLACE FUNCTION public.verify_turn_org_session()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.brain_interview_sessions s
    WHERE s.id = NEW.session_id AND s.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'brain_interview_turns: session_id % no pertenece a org_id %', NEW.session_id, NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verify_turn_org_session
  BEFORE INSERT ON public.brain_interview_turns
  FOR EACH ROW EXECUTE FUNCTION public.verify_turn_org_session();