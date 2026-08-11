ALTER TABLE public.brain_interview_sessions
  DROP CONSTRAINT IF EXISTS brain_interview_sessions_estado_check;

ALTER TABLE public.brain_interview_sessions
  ALTER COLUMN estado SET DEFAULT 'pendiente';

ALTER TABLE public.brain_interview_sessions
  ADD CONSTRAINT brain_interview_sessions_estado_check
  CHECK (estado IN ('pendiente','en_proceso','pausada','completada','cancelada'));