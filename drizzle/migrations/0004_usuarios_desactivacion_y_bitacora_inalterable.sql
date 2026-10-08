-- Parte 1: desactivación de usuarios (conserva autoría)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS desactivado_en timestamptz,
  ADD COLUMN IF NOT EXISTS desactivado_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_desactivacion text;

-- Parte 2: bitácora inalterable
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_trail FROM anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.audit_trail_inalterable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de auditoría no se puede modificar ni borrar';
END $$;

DROP TRIGGER IF EXISTS trg_audit_trail_inalterable_row ON public.audit_trail;
CREATE TRIGGER trg_audit_trail_inalterable_row
  BEFORE UPDATE OR DELETE ON public.audit_trail
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_inalterable();

DROP TRIGGER IF EXISTS trg_audit_trail_inalterable_truncate ON public.audit_trail;
CREATE TRIGGER trg_audit_trail_inalterable_truncate
  BEFORE TRUNCATE ON public.audit_trail
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_trail_inalterable();