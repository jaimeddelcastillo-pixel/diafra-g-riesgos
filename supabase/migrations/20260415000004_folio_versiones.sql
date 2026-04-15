-- ============================================================
-- NOM-241-SSA1-2025 §4.2.3 — Control de versiones de documentos
--
-- Cada vez que un folio aprobado es reabierto para corrección,
-- se archiva una snapshot de la versión anterior completa.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.folio_versiones (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id        UUID        NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
  version         TEXT        NOT NULL,            -- ej. "1.0", "1.1"
  motivo_revision TEXT        NOT NULL DEFAULT '', -- Por qué se revisó
  snapshot_folio  JSONB       NOT NULL,            -- Estado completo del folio
  snapshot_riesgos JSONB      NOT NULL DEFAULT '[]'::jsonb, -- Riesgos en esa versión
  creado_por      UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folio_versiones ENABLE ROW LEVEL SECURITY;

-- Solo admin y comite_tecnico pueden leer el historial de versiones
CREATE POLICY "Authenticated read folio_versiones"
  ON public.folio_versiones FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "System insert folio_versiones"
  ON public.folio_versiones FOR INSERT TO authenticated
  WITH CHECK (true);

-- Índice para consultas por folio
CREATE INDEX IF NOT EXISTS idx_folio_versiones_folio_id
  ON public.folio_versiones(folio_id);

-- Trigger de auditoría
CREATE TRIGGER audit_folio_versiones
  AFTER INSERT OR UPDATE OR DELETE ON public.folio_versiones
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

COMMENT ON TABLE public.folio_versiones
  IS 'NOM-241 §4.2.3 — Historial de versiones archivadas de cada folio de gestión de riesgos';

-- ============================================================
-- Función para archivar versión actual antes de reabrir folio
-- Se llama desde folio-workflow cuando el RS rechaza y el
-- operador solicita nueva revisión.
-- ============================================================

CREATE OR REPLACE FUNCTION public.archivar_version_folio(
  p_folio_id UUID,
  p_motivo   TEXT DEFAULT ''
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folio    RECORD;
  v_riesgos  JSONB;
  v_version  TEXT;
BEGIN
  -- Obtener datos actuales del folio
  SELECT * INTO v_folio FROM public.folios WHERE id = p_folio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Folio no encontrado: %', p_folio_id;
  END IF;

  -- Obtener riesgos actuales
  SELECT jsonb_agg(r) INTO v_riesgos
    FROM public.riesgos r
   WHERE r.folio_id = p_folio_id;

  v_version := v_folio.numero_version;

  -- Insertar snapshot
  INSERT INTO public.folio_versiones
    (folio_id, version, motivo_revision, snapshot_folio, snapshot_riesgos, creado_por)
  VALUES
    (p_folio_id, v_version, p_motivo, to_jsonb(v_folio), COALESCE(v_riesgos, '[]'::jsonb), auth.uid());

  -- Incrementar versión menor en el folio activo (ej. "1.0" → "1.1")
  UPDATE public.folios
     SET numero_version = (
       SPLIT_PART(v_version, '.', 1)::INT ||
       '.' ||
       (SPLIT_PART(v_version, '.', 2)::INT + 1)::TEXT
     )
   WHERE id = p_folio_id;

  RETURN v_version;
END;
$$;
