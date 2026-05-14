
-- chat_conversaciones
CREATE TABLE public.chat_conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  folio_id UUID NULL,
  agente TEXT NOT NULL DEFAULT 'dm' CHECK (agente IN ('dm','farma')),
  titulo TEXT NOT NULL DEFAULT 'Nueva conversación',
  ultimo_mensaje_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  mensajes_count INTEGER NOT NULL DEFAULT 0,
  tiene_riesgos_insertados BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_conv_org_recent ON public.chat_conversaciones(org_id, ultimo_mensaje_en DESC);
CREATE INDEX idx_chat_conv_folio ON public.chat_conversaciones(folio_id);

ALTER TABLE public.chat_conversaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read chat_conversaciones"
ON public.chat_conversaciones FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "Org members insert chat_conversaciones"
ON public.chat_conversaciones FOR INSERT TO authenticated
WITH CHECK (org_id = public.get_user_org_id() AND created_by = auth.uid());

CREATE POLICY "Org members update chat_conversaciones"
ON public.chat_conversaciones FOR UPDATE TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin())
WITH CHECK (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "Org admin delete chat_conversaciones"
ON public.chat_conversaciones FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  OR public.is_super_admin()
);

CREATE POLICY "Service role manages chat_conversaciones"
ON public.chat_conversaciones FOR ALL TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- chat_mensajes
CREATE TABLE public.chat_mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NULL,
  org_id UUID NOT NULL,
  folio_id UUID NULL,
  user_id UUID NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  contenido TEXT NOT NULL DEFAULT '',
  agente TEXT NULL,
  tokens_usados INTEGER NULL,
  documentos_adjuntos JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_msg_conv ON public.chat_mensajes(conversacion_id, created_at);
CREATE INDEX idx_chat_msg_org ON public.chat_mensajes(org_id, created_at DESC);

ALTER TABLE public.chat_mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read chat_mensajes"
ON public.chat_mensajes FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "Org admin delete chat_mensajes"
ON public.chat_mensajes FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  OR public.is_super_admin()
);

CREATE POLICY "Service role manages chat_mensajes"
ON public.chat_mensajes FOR ALL TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Trigger: actualizar conversación cuando se inserta un mensaje
CREATE OR REPLACE FUNCTION public.bump_chat_conversacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.conversacion_id IS NOT NULL THEN
    UPDATE public.chat_conversaciones
       SET ultimo_mensaje_en = NEW.created_at,
           mensajes_count = mensajes_count + 1
     WHERE id = NEW.conversacion_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_msg_bump_conv
AFTER INSERT ON public.chat_mensajes
FOR EACH ROW EXECUTE FUNCTION public.bump_chat_conversacion();
