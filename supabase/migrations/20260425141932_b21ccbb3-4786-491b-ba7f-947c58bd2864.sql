-- ─── 1. Extender tabla organizations ──────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Índice para búsquedas rápidas en webhooks
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer
  ON public.organizations(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_subscription
  ON public.organizations(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ─── 2. Tabla payment_history ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  monto_usd NUMERIC(10,2) NOT NULL,
  concepto TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_org ON public.payment_history(org_id, created_at DESC);

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admin read own payment history"
  ON public.payment_history FOR SELECT
  TO authenticated
  USING (
    (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
    OR public.is_super_admin()
  );

-- Solo el webhook (service_role) inserta pagos
CREATE POLICY "Service role inserts payment history"
  ON public.payment_history FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

-- ─── 3. Tabla addon_purchases ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.addon_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  producto TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  monto_usd NUMERIC(10,2) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addon_purchases_org ON public.addon_purchases(org_id, purchased_at DESC);

ALTER TABLE public.addon_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admin read own addons"
  ON public.addon_purchases FOR SELECT
  TO authenticated
  USING (
    (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
    OR public.is_super_admin()
  );

CREATE POLICY "Service role inserts addons"
  ON public.addon_purchases FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

-- ─── 4. Comentarios para documentación ─────────────────────────────────────────
COMMENT ON COLUMN public.organizations.subscription_status IS
  'Valores: trial | curso | active | past_due | canceled | suspendido';

COMMENT ON COLUMN public.organizations.cancelled_at IS
  'Fecha de cancelación. Datos se conservan 30 días después de esta fecha.';
