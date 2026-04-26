-- Bloque A: campo estado para gate de acceso ligado al pago

-- 1. Crear el tipo enum
DO $$ BEGIN
  CREATE TYPE public.org_estado AS ENUM ('pendiente', 'activo', 'suspendido', 'cancelado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Agregar columna estado con default 'pendiente' (nuevas orgs nacen pendientes)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS estado public.org_estado NOT NULL DEFAULT 'pendiente';

-- 3. Backfill seguro: TODAS las orgs existentes quedan activas (no romper clientes vivos)
UPDATE public.organizations
SET estado = 'activo'
WHERE estado = 'pendiente';

-- 4. Recordar qué plan eligió el usuario para reanudar el checkout si abandona el pago
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS pending_price_id TEXT;

-- 5. Índice para búsquedas rápidas por estado (admin panel)
CREATE INDEX IF NOT EXISTS idx_organizations_estado
  ON public.organizations (estado);
