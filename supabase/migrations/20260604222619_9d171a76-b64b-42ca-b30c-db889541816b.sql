ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS consultas_ia_extras INTEGER NOT NULL DEFAULT 0;