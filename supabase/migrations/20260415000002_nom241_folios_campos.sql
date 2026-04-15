-- ============================================================
-- NOM-241-SSA1-2025 / ISO 14971
-- Campos faltantes en tabla folios:
--   §4   Control documental (versión)
--   §7.5 Trazabilidad del dispositivo
--   §8   Evaluación del riesgo residual global
--   §7   Beneficio clínico / balance riesgo-beneficio
-- ============================================================

-- Control documental (NOM-241 §4.2 / ISO 13485 §4.2.3)
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS numero_version       TEXT    NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS normas_aplicables    TEXT[]  NOT NULL DEFAULT ARRAY['ISO 14971:2019','NOM-241-SSA1-2025'];

-- Trazabilidad del dispositivo médico (NOM-241 §7.5.3)
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS numero_modelo        TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS numero_lote          TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS clase_dispositivo    TEXT    NOT NULL DEFAULT '';
  -- Clase I = bajo riesgo, Clase II = riesgo moderado, Clase III = alto riesgo

-- ISO 14971 §8 — Evaluación del riesgo residual global
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS riesgo_residual_global TEXT  NOT NULL DEFAULT '';
  -- Declaración formal: ej. "El riesgo residual global es aceptable. Los beneficios superan los riesgos."

-- ISO 14971 §7 — Beneficio clínico y balance riesgo-beneficio
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS beneficio_clinico    TEXT    NOT NULL DEFAULT '';
  -- Descripción del beneficio clínico del dispositivo

-- Comentarios descriptivos
COMMENT ON COLUMN public.folios.numero_version
  IS 'NOM-241 §4.2 — Versión del documento de gestión de riesgos (ej. 1.0, 1.1, 2.0)';
COMMENT ON COLUMN public.folios.normas_aplicables
  IS 'Normas de referencia aplicadas en este análisis';
COMMENT ON COLUMN public.folios.numero_modelo
  IS 'NOM-241 §7.5.3 — Número de modelo del dispositivo médico analizado';
COMMENT ON COLUMN public.folios.numero_lote
  IS 'NOM-241 §7.5.3 — Número de lote o versión de diseño analizada';
COMMENT ON COLUMN public.folios.clase_dispositivo
  IS 'Clase regulatoria del dispositivo: Clase I, Clase II, Clase III';
COMMENT ON COLUMN public.folios.riesgo_residual_global
  IS 'ISO 14971 §8 — Evaluación del riesgo residual global del análisis completo';
COMMENT ON COLUMN public.folios.beneficio_clinico
  IS 'ISO 14971 §7 — Descripción del beneficio clínico que justifica el dispositivo';
