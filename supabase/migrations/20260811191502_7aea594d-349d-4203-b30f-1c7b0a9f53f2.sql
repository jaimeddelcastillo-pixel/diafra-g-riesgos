ALTER TABLE public.brain_gaps
  ADD COLUMN IF NOT EXISTS tipo_brecha text NOT NULL DEFAULT 'pendiente_entrevista';

ALTER TABLE public.brain_gaps
  DROP CONSTRAINT IF EXISTS brain_gaps_tipo_brecha_check;

ALTER TABLE public.brain_gaps
  ADD CONSTRAINT brain_gaps_tipo_brecha_check
  CHECK (tipo_brecha = ANY (ARRAY['pendiente_entrevista'::text,'pendiente_otro_rol'::text,'por_validar'::text,'brecha_institucional'::text]));

CREATE INDEX IF NOT EXISTS brain_gaps_tipo_brecha_idx ON public.brain_gaps (org_id, tipo_brecha);