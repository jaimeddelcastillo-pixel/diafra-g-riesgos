ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS clasificacion_tipo TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS clasificacion_condicion_venta TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS clasificacion_riesgo_sanitario TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS clasificacion_categoria TEXT NOT NULL DEFAULT '';