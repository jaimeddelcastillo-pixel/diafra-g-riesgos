-- ============================================================
-- Fase 1 — Multi-tenant: Nuevas estructuras de datos
-- Agrega organizations, org_members y columnas org_id.
-- Sin cambios en comportamiento existente (seguro de correr solo).
-- ============================================================

-- 1. Nuevo valor en enum para dueño de plataforma SaaS
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Tabla de organizaciones (tenants del SaaS)
CREATE TABLE public.organizations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT        NOT NULL,
  slug             TEXT        NOT NULL UNIQUE,
  descripcion      TEXT        NOT NULL DEFAULT '',
  logo_url         TEXT        NOT NULL DEFAULT '',
  plan             TEXT        NOT NULL DEFAULT 'trial'
                               CHECK (plan IN ('trial','starter','professional','enterprise')),
  max_users        INTEGER     NOT NULL DEFAULT 5,
  trial_expires_at TIMESTAMPTZ,
  activo           BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.organizations
  IS 'Tenants del SaaS — cada empresa cliente es una organización independiente';

-- 3. Tabla de miembros por organización
--    MVP: UNIQUE(user_id) = un usuario pertenece a una sola organización
CREATE TABLE public.org_members (
  id         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID            NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'operador',
  created_at TIMESTAMPTZ     NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.org_members
  IS 'Membresía de usuarios en organizaciones. MVP: 1 usuario = 1 organización (UNIQUE user_id)';

-- 4. org_id en folios (nullable hasta que migración 2 lo rellene)
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_folios_org_id ON public.folios(org_id);

-- 5. org_id en audit_trail (nullable)
ALTER TABLE public.audit_trail
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_audit_trail_org_id ON public.audit_trail(org_id);

-- 6. Backup de folio_sequence antes de reestructurar con clave compuesta
CREATE TABLE public._folio_seq_backup AS SELECT * FROM public.folio_sequence;

DROP TABLE public.folio_sequence;

CREATE TABLE public.folio_sequence (
  org_id      UUID    NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, year)
);

COMMENT ON TABLE public.folio_sequence
  IS 'Secuencias GR-YYYY-NNN independientes por organización y año';

-- 7. Función: org_id del usuario en sesión
--    SECURITY DEFINER evita recursión en RLS (lee org_members sin pasar por RLS)
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1
$$;

COMMENT ON FUNCTION public.get_user_org_id()
  IS 'Retorna el org_id del usuario autenticado. SECURITY DEFINER para evitar recursión RLS.';

-- 8. Función: ¿es super_admin de la plataforma?
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
$$;

COMMENT ON FUNCTION public.is_super_admin()
  IS 'True si el usuario tiene rol super_admin (acceso a todas las organizaciones).';
