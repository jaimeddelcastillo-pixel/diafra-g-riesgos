-- brain_session_processes: procesos efectivos de una sesión concreta.

CREATE TABLE public.brain_session_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES public.brain_interview_sessions(id) ON DELETE RESTRICT,
  process_id UUID NOT NULL REFERENCES public.brain_processes(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_session_process UNIQUE (session_id, process_id)
);

GRANT SELECT ON public.brain_session_processes TO authenticated;
GRANT ALL ON public.brain_session_processes TO service_role;

ALTER TABLE public.brain_session_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_processes_select_org"
  ON public.brain_session_processes FOR SELECT
  TO authenticated
  USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE INDEX idx_session_processes_session ON public.brain_session_processes (session_id);
CREATE INDEX idx_session_processes_process ON public.brain_session_processes (process_id);

CREATE OR REPLACE FUNCTION public.verify_session_process_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.brain_interview_sessions s
    WHERE s.id = NEW.session_id AND s.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'brain_session_processes: session_id % no pertenece a org_id %', NEW.session_id, NEW.org_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.brain_processes p
    WHERE p.id = NEW.process_id AND p.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'brain_session_processes: process_id % no pertenece a org_id %', NEW.process_id, NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verify_session_process_integrity
  BEFORE INSERT OR UPDATE ON public.brain_session_processes
  FOR EACH ROW EXECUTE FUNCTION public.verify_session_process_integrity();

-- ALTER brain_interview_sessions (assignment_id ya existe con la definición correcta)
ALTER TABLE public.brain_interview_sessions
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.brain_interview_sessions
  DROP CONSTRAINT IF EXISTS brain_interview_sessions_estado_check;
ALTER TABLE public.brain_interview_sessions
  ADD CONSTRAINT brain_interview_sessions_estado_check
  CHECK (estado IN ('pendiente','en_curso','pausada','finalizada','cancelada'));

CREATE OR REPLACE FUNCTION public.verify_session_assignment_org()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.assignment_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.brain_interview_assignments a
      WHERE a.id = NEW.assignment_id AND a.org_id = NEW.org_id
    ) THEN
      RAISE EXCEPTION 'brain_interview_sessions: assignment_id % no pertenece a org_id %', NEW.assignment_id, NEW.org_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verify_session_assignment_org
  BEFORE INSERT OR UPDATE ON public.brain_interview_sessions
  FOR EACH ROW EXECUTE FUNCTION public.verify_session_assignment_org();