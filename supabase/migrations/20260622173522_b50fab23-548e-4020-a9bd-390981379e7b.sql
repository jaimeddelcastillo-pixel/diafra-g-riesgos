ALTER TABLE public.curso_examen_intentos
  ADD COLUMN IF NOT EXISTS duracion_seg integer,
  ADD COLUMN IF NOT EXISTS tab_blur_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiempo_limite_seg integer NOT NULL DEFAULT 2700;