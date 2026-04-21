-- ─── ENUMS ──────────────────────────────────────────────────────────────────
CREATE TYPE public.ticket_prioridad AS ENUM ('Baja', 'Normal', 'Alta', 'Crítica');
CREATE TYPE public.ticket_estado AS ENUM ('Abierto', 'En Atención', 'Esperando Cliente', 'Resuelto', 'Cerrado');
CREATE TYPE public.ticket_categoria AS ENUM ('Bug', 'Consulta', 'Solicitud de Mejora', 'Capacitación', 'Acceso', 'Otro');

-- ─── SECUENCIA POR ORG/AÑO ──────────────────────────────────────────────────
CREATE TABLE public.ticket_sequence (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, year)
);

-- Función generadora de folio: TKT-{SLUG}-YYYY-NNN
CREATE OR REPLACE FUNCTION public.next_ticket_code(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_num INTEGER;
  v_slug TEXT;
BEGIN
  SELECT UPPER(slug) INTO v_slug FROM public.organizations WHERE id = p_org_id;
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;

  INSERT INTO public.ticket_sequence (org_id, year, last_number)
  VALUES (p_org_id, v_year, 1)
  ON CONFLICT (org_id, year) DO UPDATE
    SET last_number = ticket_sequence.last_number + 1
  RETURNING last_number INTO v_num;

  RETURN 'TKT-' || v_slug || '-' || v_year || '-' || LPAD(v_num::TEXT, 3, '0');
END;
$$;

-- ─── TABLA PRINCIPAL: tickets ───────────────────────────────────────────────
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Datos del ticket
  asunto TEXT NOT NULL CHECK (length(trim(asunto)) >= 5),
  descripcion TEXT NOT NULL CHECK (length(trim(descripcion)) >= 10),
  categoria public.ticket_categoria NOT NULL DEFAULT 'Consulta',
  prioridad public.ticket_prioridad NOT NULL DEFAULT 'Normal',
  estado public.ticket_estado NOT NULL DEFAULT 'Abierto',
  
  -- Autoría
  created_by UUID NOT NULL,
  created_by_email TEXT NOT NULL,
  created_by_nombre TEXT NOT NULL,
  
  -- Asignación interna (super admin que atiende)
  asignado_a UUID,
  asignado_a_email TEXT,
  
  -- SLA — calculado al crear según prioridad
  sla_respuesta_at TIMESTAMPTZ NOT NULL,
  sla_resolucion_at TIMESTAMPTZ NOT NULL,
  
  -- Marcas de tiempo del ciclo de vida
  primera_respuesta_at TIMESTAMPTZ,
  resuelto_at TIMESTAMPTZ,
  cerrado_at TIMESTAMPTZ,
  
  -- Vínculo opcional con impersonación
  impersonation_log_id UUID REFERENCES public.impersonation_logs(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_org_estado ON public.tickets(org_id, estado, created_at DESC);
CREATE INDEX idx_tickets_estado_prioridad ON public.tickets(estado, prioridad, sla_respuesta_at);
CREATE INDEX idx_tickets_asignado ON public.tickets(asignado_a) WHERE asignado_a IS NOT NULL;

-- ─── TABLA: ticket_mensajes (conversación) ──────────────────────────────────
CREATE TABLE public.ticket_mensajes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  
  autor_id UUID NOT NULL,
  autor_email TEXT NOT NULL,
  autor_nombre TEXT NOT NULL,
  es_soporte BOOLEAN NOT NULL DEFAULT false, -- true = super admin, false = cliente
  es_interno BOOLEAN NOT NULL DEFAULT false, -- true = nota interna, no visible al cliente
  
  mensaje TEXT NOT NULL CHECK (length(trim(mensaje)) >= 1),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_mensajes_ticket ON public.ticket_mensajes(ticket_id, created_at);

-- ─── TRIGGER: calcula SLA automáticamente al crear ──────────────────────────
CREATE OR REPLACE FUNCTION public.set_ticket_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Generar folio si no viene
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := public.next_ticket_code(NEW.org_id);
  END IF;
  
  -- Calcular SLA según prioridad
  CASE NEW.prioridad
    WHEN 'Crítica' THEN
      NEW.sla_respuesta_at := NEW.created_at + INTERVAL '2 hours';
      NEW.sla_resolucion_at := NEW.created_at + INTERVAL '8 hours';
    WHEN 'Alta' THEN
      NEW.sla_respuesta_at := NEW.created_at + INTERVAL '8 hours';
      NEW.sla_resolucion_at := NEW.created_at + INTERVAL '24 hours';
    WHEN 'Normal' THEN
      NEW.sla_respuesta_at := NEW.created_at + INTERVAL '24 hours';
      NEW.sla_resolucion_at := NEW.created_at + INTERVAL '72 hours';
    WHEN 'Baja' THEN
      NEW.sla_respuesta_at := NEW.created_at + INTERVAL '72 hours';
      NEW.sla_resolucion_at := NEW.created_at + INTERVAL '7 days';
  END CASE;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tickets_defaults
BEFORE INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_ticket_defaults();

-- ─── TRIGGER: actualiza primera_respuesta_at al primer mensaje de soporte ───
CREATE OR REPLACE FUNCTION public.update_ticket_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si es respuesta de soporte (no interna) y aún no hay primera respuesta
  IF NEW.es_soporte = true AND NEW.es_interno = false THEN
    UPDATE public.tickets
    SET primera_respuesta_at = COALESCE(primera_respuesta_at, NEW.created_at),
        estado = CASE WHEN estado = 'Abierto' THEN 'En Atención'::ticket_estado ELSE estado END,
        updated_at = NEW.created_at
    WHERE id = NEW.ticket_id;
  ELSIF NEW.es_soporte = false THEN
    -- Cliente respondió: si estaba "Esperando Cliente", vuelve a "En Atención"
    UPDATE public.tickets
    SET estado = CASE WHEN estado = 'Esperando Cliente' THEN 'En Atención'::ticket_estado ELSE estado END,
        updated_at = NEW.created_at
    WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_mensajes_update_ticket
AFTER INSERT ON public.ticket_mensajes
FOR EACH ROW
EXECUTE FUNCTION public.update_ticket_on_message();

-- ─── TRIGGER: updated_at en tickets ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_sequence ENABLE ROW LEVEL SECURITY;

-- ─ tickets ─
CREATE POLICY "Org members read own tickets"
ON public.tickets FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "Org members create tickets"
ON public.tickets FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.get_user_org_id()
  AND created_by = auth.uid()
);

CREATE POLICY "Org admin close own tickets"
ON public.tickets FOR UPDATE TO authenticated
USING (
  org_id = public.get_user_org_id()
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  org_id = public.get_user_org_id()
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Super admin manage all tickets"
ON public.tickets FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- ─ ticket_mensajes ─
-- Los miembros de la org ven mensajes NO internos de sus tickets
CREATE POLICY "Org members read public messages"
ON public.ticket_mensajes FOR SELECT TO authenticated
USING (
  es_interno = false
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_mensajes.ticket_id
      AND t.org_id = public.get_user_org_id()
  )
);

-- Super admin ve TODOS los mensajes (incluyendo internos)
CREATE POLICY "Super admin read all messages"
ON public.ticket_mensajes FOR SELECT TO authenticated
USING (public.is_super_admin());

-- Cliente puede crear mensajes públicos en sus tickets
CREATE POLICY "Org members create messages"
ON public.ticket_mensajes FOR INSERT TO authenticated
WITH CHECK (
  autor_id = auth.uid()
  AND es_interno = false
  AND es_soporte = false
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_mensajes.ticket_id
      AND t.org_id = public.get_user_org_id()
      AND t.estado NOT IN ('Cerrado'::ticket_estado)
  )
);

-- Super admin puede crear cualquier tipo de mensaje
CREATE POLICY "Super admin create messages"
ON public.ticket_mensajes FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  AND autor_id = auth.uid()
);

-- ─ ticket_sequence ─ (solo lectura para autenticados, escritura por función SECURITY DEFINER)
CREATE POLICY "Read ticket sequence"
ON public.ticket_sequence FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());