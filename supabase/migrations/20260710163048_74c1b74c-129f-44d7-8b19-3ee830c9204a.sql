ALTER TABLE public.organizations DROP CONSTRAINT organizations_plan_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_plan_check
  CHECK (plan = ANY (ARRAY['trial'::text, 'trial-demo'::text, 'starter'::text, 'professional'::text, 'enterprise'::text]));