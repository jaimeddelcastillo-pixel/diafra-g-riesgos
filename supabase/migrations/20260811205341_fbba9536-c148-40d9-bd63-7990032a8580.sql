-- brain_interview_messages: transcript visual de sesión (no memoria institucional).

CREATE TABLE public.brain_interview_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES public.brain_interview_sessions(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CONSTRAINT message_role_check CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  turn_id UUID REFERENCES public.brain_interview_turns(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.brain_interview_messages TO authenticated;
GRANT ALL ON public.brain_interview_messages TO service_role;

ALTER TABLE public.brain_interview_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_org_members"
  ON public.brain_interview_messages FOR SELECT
  TO authenticated
  USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE INDEX idx_brain_messages_session_created
  ON public.brain_interview_messages (session_id, created_at ASC);
CREATE INDEX idx_brain_messages_turn
  ON public.brain_interview_messages (turn_id) WHERE turn_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.verify_message_turn_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.turn_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.brain_interview_turns t
      WHERE t.id = NEW.turn_id AND t.session_id = NEW.session_id AND t.org_id = NEW.org_id
    ) THEN
      RAISE EXCEPTION 'brain_interview_messages: turn_id % no pertenece a session_id % org_id %', NEW.turn_id, NEW.session_id, NEW.org_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verify_message_turn_integrity
  BEFORE INSERT ON public.brain_interview_messages
  FOR EACH ROW EXECUTE FUNCTION public.verify_message_turn_integrity();