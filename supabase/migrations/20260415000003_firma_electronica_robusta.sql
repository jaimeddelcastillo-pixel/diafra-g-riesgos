-- ============================================================
-- NOM-241-SSA1-2025 §4.2 / Equivalente 21 CFR Part 11
-- Firma electrónica con valor probatorio en auditoría COFEPRIS
--
-- Para que una firma digital sea válida debe demostrar:
--   1. Quién firmó (user_id — ya existe)
--   2. Cuándo firmó (fecha_firma — ya existe)
--   3. Desde dónde firmó (ip_firma — NUEVO)
--   4. Qué aceptó exactamente (texto_compromiso — NUEVO)
--   5. Qué documento firmó (hash_documento — NUEVO)
-- ============================================================

ALTER TABLE public.folio_comite
  ADD COLUMN IF NOT EXISTS ip_firma          TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_agent        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS texto_compromiso  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hash_documento    TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.folio_comite.ip_firma
  IS '21 CFR §11 — Dirección IP del dispositivo desde donde se registró la firma';
COMMENT ON COLUMN public.folio_comite.user_agent
  IS '21 CFR §11 — Navegador y sistema operativo del firmante';
COMMENT ON COLUMN public.folio_comite.texto_compromiso
  IS '21 CFR §11 — Texto exacto que el usuario aceptó al momento de firmar (non-repudiation)';
COMMENT ON COLUMN public.folio_comite.hash_documento
  IS '21 CFR §11 — Hash SHA-256 del contenido del folio al momento de la firma (integridad del documento)';
