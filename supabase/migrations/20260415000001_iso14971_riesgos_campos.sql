-- ============================================================
-- ISO 14971 §5.4 / §6.2 / §6.5 / §7
-- Campos faltantes en tabla riesgos para cumplimiento NOM-241
-- ============================================================

-- §5.4 Identificación completa del peligro
ALTER TABLE public.riesgos
  ADD COLUMN IF NOT EXISTS peligro               TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS situacion_peligrosa   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS secuencia_eventos     TEXT NOT NULL DEFAULT '';

-- §6.2 Separación de controles de prevención y detección
ALTER TABLE public.riesgos
  ADD COLUMN IF NOT EXISTS controles_prevencion  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS controles_deteccion   TEXT NOT NULL DEFAULT '';

-- §6.5 Verificación de implementación del control
ALTER TABLE public.riesgos
  ADD COLUMN IF NOT EXISTS verificado_por          TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fecha_verificacion      DATE,
  ADD COLUMN IF NOT EXISTS resultado_verificacion  TEXT NOT NULL DEFAULT '';

-- §7 Justificación ALARP para riesgos tolerables (NPR medio con beneficio clínico)
ALTER TABLE public.riesgos
  ADD COLUMN IF NOT EXISTS justificacion_aceptabilidad TEXT NOT NULL DEFAULT '';

-- Comentarios descriptivos
COMMENT ON COLUMN public.riesgos.peligro
  IS 'ISO 14971 §5.4 — Fuente de energía o condición que puede causar daño';
COMMENT ON COLUMN public.riesgos.situacion_peligrosa
  IS 'ISO 14971 §5.4 — Circunstancia en que el peligro puede causar daño';
COMMENT ON COLUMN public.riesgos.secuencia_eventos
  IS 'ISO 14971 §5.4 — Cadena de eventos que lleva del peligro al daño';
COMMENT ON COLUMN public.riesgos.controles_prevencion
  IS 'ISO 14971 §6.2 — Controles que reducen probabilidad de ocurrencia';
COMMENT ON COLUMN public.riesgos.controles_deteccion
  IS 'ISO 14971 §6.2 — Controles que mejoran capacidad de detección';
COMMENT ON COLUMN public.riesgos.verificado_por
  IS 'ISO 14971 §6.5 — Persona que verificó la implementación del control';
COMMENT ON COLUMN public.riesgos.fecha_verificacion
  IS 'ISO 14971 §6.5 — Fecha de verificación de efectividad del control';
COMMENT ON COLUMN public.riesgos.resultado_verificacion
  IS 'ISO 14971 §6.5 — Evidencia/resultado de la verificación del control';
COMMENT ON COLUMN public.riesgos.justificacion_aceptabilidad
  IS 'ISO 14971 §7 — Justificación ALARP cuando riesgo residual es tolerable';
