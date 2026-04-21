-- Fijar search_path en funciones nuevas
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.set_ticket_defaults() SET search_path = public;
ALTER FUNCTION public.update_ticket_on_message() SET search_path = public;
ALTER FUNCTION public.next_ticket_code(uuid) SET search_path = public;

-- Asegurar RLS habilitado (defensivo)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_sequence ENABLE ROW LEVEL SECURITY;