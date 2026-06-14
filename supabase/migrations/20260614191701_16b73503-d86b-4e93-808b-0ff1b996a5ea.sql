
-- 2. Add cancellation columns to folios
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS cancelado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion_codigo TEXT,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT;

-- 3. RPC to cancel a folio with audit trail (trigger handles the audit row)
CREATE OR REPLACE FUNCTION public.cancelar_folio(
  p_folio_id UUID,
  p_motivo_codigo TEXT,
  p_motivo_texto TEXT
) RETURNS public.folios
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folio public.folios;
  v_uid   UUID := auth.uid();
  v_is_priv BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_folio FROM public.folios WHERE id = p_folio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Folio no encontrado';
  END IF;

  IF v_folio.estado = 'Cancelado' THEN
    RAISE EXCEPTION 'El folio ya está cancelado';
  END IF;

  -- Validar motivo
  IF p_motivo_codigo IS NULL OR p_motivo_codigo NOT IN (
    'error_creacion','proceso_duplicado','proceso_modificado','proceso_no_aplica','otro'
  ) THEN
    RAISE EXCEPTION 'Motivo de cancelación inválido';
  END IF;

  IF p_motivo_codigo = 'otro' AND (p_motivo_texto IS NULL OR length(btrim(p_motivo_texto)) < 5) THEN
    RAISE EXCEPTION 'Debes describir el motivo (mínimo 5 caracteres)';
  END IF;

  v_is_priv := public.is_super_admin()
            OR public.has_role(v_uid, 'admin'::app_role)
            OR public.has_role(v_uid, 'responsable_sanitario'::app_role);

  -- Reglas de permisos
  IF v_folio.estado IN ('En Firma','Aprobado','Cerrado') THEN
    IF NOT v_is_priv THEN
      RAISE EXCEPTION 'Solo Administrador o Responsable Sanitario pueden cancelar un folio en estado %', v_folio.estado;
    END IF;
  ELSE
    -- Borrador
    IF NOT (v_is_priv OR v_folio.created_by = v_uid) THEN
      RAISE EXCEPTION 'No tienes permiso para cancelar este folio';
    END IF;
  END IF;

  UPDATE public.folios
     SET estado = 'Cancelado'::public.estado_folio,
         cancelado_por = v_uid,
         cancelado_en = now(),
         motivo_cancelacion_codigo = p_motivo_codigo,
         motivo_cancelacion = NULLIF(btrim(COALESCE(p_motivo_texto,'')), ''),
         updated_at = now()
   WHERE id = p_folio_id
   RETURNING * INTO v_folio;

  RETURN v_folio;
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_folio(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_folio(UUID, TEXT, TEXT) TO authenticated;
