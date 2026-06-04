ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS alerta_80_enviada BOOLEAN NOT NULL DEFAULT false;