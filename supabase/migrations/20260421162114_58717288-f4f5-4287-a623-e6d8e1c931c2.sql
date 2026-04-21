-- 1. Agregar columna ticket_id a impersonation_logs (opcional, vincula sesión con ticket)
ALTER TABLE public.impersonation_logs
ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_ticket_id 
ON public.impersonation_logs(ticket_id) WHERE ticket_id IS NOT NULL;

-- 2. Trigger: cuando ticket pasa a Cerrado, registrar cerrado_at
CREATE OR REPLACE FUNCTION public.set_ticket_cerrado_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'Cerrado' AND (OLD.estado IS DISTINCT FROM 'Cerrado') THEN
    NEW.cerrado_at := COALESCE(NEW.cerrado_at, now());
  END IF;
  IF NEW.estado = 'Resuelto' AND (OLD.estado IS DISTINCT FROM 'Resuelto') THEN
    NEW.resuelto_at := COALESCE(NEW.resuelto_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ticket_cerrado_at ON public.tickets;
CREATE TRIGGER trg_set_ticket_cerrado_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_ticket_cerrado_at();

-- 3. Política para que super_admin pueda actualizar cualquier ticket explícitamente
DROP POLICY IF EXISTS "Super admin update any ticket" ON public.tickets;
CREATE POLICY "Super admin update any ticket"
ON public.tickets
FOR UPDATE
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());