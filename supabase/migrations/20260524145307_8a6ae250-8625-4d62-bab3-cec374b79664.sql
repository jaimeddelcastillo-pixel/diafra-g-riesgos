
-- ============ comite_votos ============
CREATE TABLE public.comite_votos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id UUID NOT NULL,
  user_id UUID NOT NULL,
  org_id UUID NOT NULL,
  voto TEXT NOT NULL CHECK (voto IN ('aprueba','rechaza','aprueba_con_observaciones')),
  comentario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (folio_id, user_id)
);

ALTER TABLE public.comite_votos ENABLE ROW LEVEL SECURITY;

-- Validación: comentario obligatorio si voto != aprueba
CREATE OR REPLACE FUNCTION public.validate_comite_voto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.voto <> 'aprueba' AND (NEW.comentario IS NULL OR length(btrim(NEW.comentario)) = 0) THEN
    RAISE EXCEPTION 'El comentario es obligatorio cuando el voto no es aprobación simple';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_comite_voto
BEFORE INSERT OR UPDATE ON public.comite_votos
FOR EACH ROW EXECUTE FUNCTION public.validate_comite_voto();

CREATE TRIGGER trg_comite_votos_updated_at
BEFORE UPDATE ON public.comite_votos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_comite_votos_audit
AFTER INSERT OR UPDATE OR DELETE ON public.comite_votos
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- RLS comite_votos
CREATE POLICY "Org members read comite_votos"
ON public.comite_votos FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "Members insert own vote (Borrador)"
ON public.comite_votos FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND org_id = public.get_user_org_id()
  AND EXISTS (SELECT 1 FROM public.folios f WHERE f.id = folio_id AND f.org_id = public.get_user_org_id() AND f.estado = 'Borrador')
);

CREATE POLICY "Members update own vote (Borrador)"
ON public.comite_votos FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.folios f WHERE f.id = folio_id AND f.estado = 'Borrador')
)
WITH CHECK (
  user_id = auth.uid()
  AND org_id = public.get_user_org_id()
  AND EXISTS (SELECT 1 FROM public.folios f WHERE f.id = folio_id AND f.estado = 'Borrador')
);

CREATE POLICY "Admin delete comite_votos"
ON public.comite_votos FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  OR public.is_super_admin()
);

-- ============ comite_comentarios ============
CREATE TABLE public.comite_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id UUID NOT NULL,
  user_id UUID NOT NULL,
  org_id UUID NOT NULL,
  contenido TEXT NOT NULL CHECK (length(btrim(contenido)) > 0),
  tipo TEXT NOT NULL DEFAULT 'comentario' CHECK (tipo IN ('comentario','observacion','resolucion')),
  resuelto BOOLEAN NOT NULL DEFAULT false,
  resuelto_por UUID,
  resuelto_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comite_comentarios ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_comite_comentarios_audit
AFTER INSERT OR UPDATE OR DELETE ON public.comite_comentarios
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE POLICY "Org members read comite_comentarios"
ON public.comite_comentarios FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "Members insert own comentario"
ON public.comite_comentarios FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND org_id = public.get_user_org_id()
  AND EXISTS (SELECT 1 FROM public.folios f WHERE f.id = folio_id AND f.org_id = public.get_user_org_id())
);

CREATE POLICY "Author/Admin/RS update comentario"
ON public.comite_comentarios FOR UPDATE TO authenticated
USING (
  org_id = public.get_user_org_id()
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
  )
)
WITH CHECK (
  org_id = public.get_user_org_id()
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
  )
);

CREATE POLICY "Admin delete comentarios"
ON public.comite_comentarios FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  OR public.is_super_admin()
);

-- Índices
CREATE INDEX idx_comite_votos_folio ON public.comite_votos(folio_id);
CREATE INDEX idx_comite_comentarios_folio ON public.comite_comentarios(folio_id, created_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.comite_votos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comite_comentarios;
