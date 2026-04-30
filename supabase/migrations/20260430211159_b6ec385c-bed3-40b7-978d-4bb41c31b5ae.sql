
-- ============================================================
-- BLOQUE A — Soporte multi-norma (NOM-241 / NOM-059 / MULTI)
-- Cambios aditivos: NO rompen lecturas/escrituras existentes
-- ============================================================

-- 1) ORGANIZATIONS: norma + parámetros regulatorios
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS norma_aplicable    TEXT    NOT NULL DEFAULT 'NOM-241',
  ADD COLUMN IF NOT EXISTS metodologia        TEXT    NOT NULL DEFAULT 'AMEF',
  ADD COLUMN IF NOT EXISTS usar_detectabilidad BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS umbral_npr_alto    INTEGER NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS umbral_npr_medio   INTEGER NOT NULL DEFAULT 60;

-- 2) FOLIOS: congelar norma al momento de creación
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS norma_folio        TEXT NOT NULL DEFAULT 'NOM-241',
  ADD COLUMN IF NOT EXISTS metodologia_folio  TEXT NOT NULL DEFAULT 'AMEF';

-- 3) RIESGOS: bandera de detectabilidad por riesgo (futura flexibilidad)
ALTER TABLE public.riesgos
  ADD COLUMN IF NOT EXISTS detectabilidad_aplicable BOOLEAN NOT NULL DEFAULT true;

-- 4) Backfill explícito (auditoría / claridad)
UPDATE public.organizations
   SET norma_aplicable = COALESCE(norma_aplicable, 'NOM-241'),
       metodologia     = COALESCE(metodologia, 'AMEF')
 WHERE norma_aplicable IS NULL OR metodologia IS NULL;

UPDATE public.folios
   SET norma_folio       = COALESCE(norma_folio, 'NOM-241'),
       metodologia_folio = COALESCE(metodologia_folio, 'AMEF')
 WHERE norma_folio IS NULL OR metodologia_folio IS NULL;

-- 5) Validación con TRIGGERS (no CHECK, por inmutabilidad y flexibilidad futura)
CREATE OR REPLACE FUNCTION public.validate_org_norma()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.norma_aplicable NOT IN ('NOM-241','NOM-059','MULTI') THEN
    RAISE EXCEPTION 'norma_aplicable inválida: %. Permitidos: NOM-241, NOM-059, MULTI', NEW.norma_aplicable;
  END IF;
  IF NEW.metodologia NOT IN ('AMEF','ICH-Q9','MULTI') THEN
    RAISE EXCEPTION 'metodologia inválida: %. Permitidos: AMEF, ICH-Q9, MULTI', NEW.metodologia;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_org_norma_trigger ON public.organizations;
CREATE TRIGGER validate_org_norma_trigger
  BEFORE INSERT OR UPDATE OF norma_aplicable, metodologia ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.validate_org_norma();

CREATE OR REPLACE FUNCTION public.validate_folio_norma()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.norma_folio NOT IN ('NOM-241','NOM-059') THEN
    RAISE EXCEPTION 'norma_folio inválida: %. Permitidos: NOM-241, NOM-059', NEW.norma_folio;
  END IF;
  IF NEW.metodologia_folio NOT IN ('AMEF','ICH-Q9') THEN
    RAISE EXCEPTION 'metodologia_folio inválida: %. Permitidos: AMEF, ICH-Q9', NEW.metodologia_folio;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_folio_norma_trigger ON public.folios;
CREATE TRIGGER validate_folio_norma_trigger
  BEFORE INSERT OR UPDATE OF norma_folio, metodologia_folio ON public.folios
  FOR EACH ROW EXECUTE FUNCTION public.validate_folio_norma();

-- 6) Trigger que copia la norma de la org al folio en INSERT
--    (sólo si el cliente NO la especificó explícitamente — congela versión)
CREATE OR REPLACE FUNCTION public.set_folio_norma_from_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norma TEXT;
  v_meto  TEXT;
BEGIN
  -- Si el folio ya trae norma específica distinta del default, respetar
  IF NEW.org_id IS NOT NULL THEN
    SELECT norma_aplicable, metodologia
      INTO v_norma, v_meto
      FROM public.organizations
     WHERE id = NEW.org_id;

    IF v_norma IS NOT NULL THEN
      -- Si la org es MULTI, dejar el default del folio (NOM-241) o lo que mande el cliente
      IF v_norma <> 'MULTI' THEN
        NEW.norma_folio := v_norma;
      END IF;
      IF v_meto IS NOT NULL AND v_meto <> 'MULTI' THEN
        NEW.metodologia_folio := v_meto;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_folio_norma_from_org_trigger ON public.folios;
CREATE TRIGGER set_folio_norma_from_org_trigger
  BEFORE INSERT ON public.folios
  FOR EACH ROW EXECUTE FUNCTION public.set_folio_norma_from_org();

-- 7) Índices ligeros para filtros del panel admin
CREATE INDEX IF NOT EXISTS idx_organizations_norma ON public.organizations(norma_aplicable);
CREATE INDEX IF NOT EXISTS idx_folios_norma        ON public.folios(norma_folio);
