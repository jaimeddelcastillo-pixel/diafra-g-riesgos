-- brain_knowledge_items: turno de ORIGEN (verificación turn + org)
ALTER TABLE public.brain_knowledge_items
  ADD COLUMN IF NOT EXISTS created_from_turn_id UUID
  REFERENCES public.brain_interview_turns(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.verify_knowledge_turn_org()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.created_from_turn_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.brain_interview_turns t
      WHERE t.id = NEW.created_from_turn_id AND t.org_id = NEW.org_id
    ) THEN
      RAISE EXCEPTION 'brain_knowledge_items: created_from_turn_id % no pertenece a org_id %', NEW.created_from_turn_id, NEW.org_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verify_knowledge_turn_org
  BEFORE INSERT OR UPDATE ON public.brain_knowledge_items
  FOR EACH ROW EXECUTE FUNCTION public.verify_knowledge_turn_org();

CREATE INDEX idx_knowledge_items_turn
  ON public.brain_knowledge_items (created_from_turn_id) WHERE created_from_turn_id IS NOT NULL;

-- brain_gaps: verificación de tres dimensiones
ALTER TABLE public.brain_gaps
  ADD COLUMN IF NOT EXISTS turn_id UUID
  REFERENCES public.brain_interview_turns(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.verify_gap_turn_org()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.turn_id IS NOT NULL THEN
    IF NEW.session_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.brain_interview_turns t
        WHERE t.id = NEW.turn_id AND t.session_id = NEW.session_id AND t.org_id = NEW.org_id
      ) THEN
        RAISE EXCEPTION 'brain_gaps: turn_id % no pertenece a session_id % org_id %', NEW.turn_id, NEW.session_id, NEW.org_id;
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.brain_interview_turns t
        WHERE t.id = NEW.turn_id AND t.org_id = NEW.org_id
      ) THEN
        RAISE EXCEPTION 'brain_gaps: turn_id % no pertenece a org_id %', NEW.turn_id, NEW.org_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verify_gap_turn_org
  BEFORE INSERT OR UPDATE ON public.brain_gaps
  FOR EACH ROW EXECUTE FUNCTION public.verify_gap_turn_org();

CREATE INDEX idx_brain_gaps_turn
  ON public.brain_gaps (turn_id) WHERE turn_id IS NOT NULL;

-- brain_contradictions: verificación de tres dimensiones
ALTER TABLE public.brain_contradictions
  ADD COLUMN IF NOT EXISTS turn_id UUID
  REFERENCES public.brain_interview_turns(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.verify_contradiction_turn_org()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.turn_id IS NOT NULL THEN
    IF NEW.session_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.brain_interview_turns t
        WHERE t.id = NEW.turn_id AND t.session_id = NEW.session_id AND t.org_id = NEW.org_id
      ) THEN
        RAISE EXCEPTION 'brain_contradictions: turn_id % no pertenece a session_id % org_id %', NEW.turn_id, NEW.session_id, NEW.org_id;
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.brain_interview_turns t
        WHERE t.id = NEW.turn_id AND t.org_id = NEW.org_id
      ) THEN
        RAISE EXCEPTION 'brain_contradictions: turn_id % no pertenece a org_id %', NEW.turn_id, NEW.org_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verify_contradiction_turn_org
  BEFORE INSERT OR UPDATE ON public.brain_contradictions
  FOR EACH ROW EXECUTE FUNCTION public.verify_contradiction_turn_org();

CREATE INDEX idx_brain_contradictions_turn
  ON public.brain_contradictions (turn_id) WHERE turn_id IS NOT NULL;