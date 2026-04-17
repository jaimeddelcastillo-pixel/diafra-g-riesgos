-- ============================================================
-- Fase 1 — Parche: auto-asignar org_id en folios
-- El frontend actual no envía org_id al insertar un folio.
-- Este trigger lo rellena automáticamente desde la sesión del
-- usuario, evitando cambios en frontend hasta Fase 3.
-- ============================================================

-- DEFAULT funcional: usa get_user_org_id() en cada INSERT
ALTER TABLE public.folios
  ALTER COLUMN org_id SET DEFAULT public.get_user_org_id();

-- Trigger de seguridad: si org_id llega NULL (ej. llamada directa)
-- lo rellena antes de insertar
CREATE OR REPLACE FUNCTION public.set_folio_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.get_user_org_id();
  END IF;
  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'No se puede crear un folio sin organización asignada. El usuario no pertenece a ninguna organización.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_folio_org_before_insert
  BEFORE INSERT ON public.folios
  FOR EACH ROW EXECUTE FUNCTION public.set_folio_org_id();
