ALTER TABLE public.brain_knowledge_items
  ADD COLUMN IF NOT EXISTS turn_id uuid NULL REFERENCES public.brain_interview_turns(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_brain_knowledge_items_turn
  ON public.brain_knowledge_items(turn_id) WHERE turn_id IS NOT NULL;