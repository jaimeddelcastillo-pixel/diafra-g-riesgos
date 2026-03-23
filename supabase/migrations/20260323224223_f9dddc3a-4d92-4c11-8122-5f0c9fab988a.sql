ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS justificacion_tecnica text;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS conclusion text DEFAULT 'Aprobado';