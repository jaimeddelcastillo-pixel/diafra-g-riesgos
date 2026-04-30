-- Drop old global unique constraint on folios.codigo
ALTER TABLE public.folios DROP CONSTRAINT IF EXISTS folios_codigo_key;

-- In case it exists as a plain unique index instead of a constraint
DROP INDEX IF EXISTS public.folios_codigo_key;

-- Create composite unique index per organization
CREATE UNIQUE INDEX IF NOT EXISTS folios_org_codigo_unique
  ON public.folios (org_id, codigo);