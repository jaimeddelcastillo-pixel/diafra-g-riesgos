-- Reversión C6c.1 (aplicar ANTES de c6c_down.sql si se revierte todo)
DROP FUNCTION IF EXISTS public.duplicar_auditoria(uuid,text,text,text,text,timestamptz,timestamptz,boolean);
DROP FUNCTION IF EXISTS public.auditor_registrar_folio_pdf(uuid, boolean);
CREATE OR REPLACE FUNCTION public.auditorias_externas_governance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_es_rs boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un expediente de auditoría no se borra: ciérralo o revócalo con motivo' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'borrador' THEN RAISE EXCEPTION 'El expediente se crea en borrador' USING ERRCODE = '42501'; END IF;
    NEW.auditor_user_id := NULL; NEW.activado_por := NULL; NEW.activado_en := NULL;
    NEW.cerrado_por := NULL; NEW.cerrado_en := NULL; NEW.motivo_cierre := NULL;
    IF v_uid IS NOT NULL THEN NEW.creado_por := v_uid; END IF;
    NEW.auditor_email := lower(trim(NEW.auditor_email));
    RETURN NEW;
  END IF;
  -- UPDATE
  IF NEW.org_id <> OLD.org_id OR NEW.creado_por IS DISTINCT FROM OLD.creado_por OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Dato no modificable' USING ERRCODE = '42501';
  END IF;
  IF OLD.estado IN ('cerrado','revocado') THEN
    RAISE EXCEPTION 'El expediente está %; ya no se puede modificar', OLD.estado USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN RETURN NEW; END IF; -- funciones del servidor (invitación)
  IF NEW.estado = 'activo' AND OLD.estado = 'borrador' THEN
    RAISE EXCEPTION 'El expediente se activa con la invitación al auditor' USING ERRCODE = '42501';
  END IF;
  IF NEW.estado = 'borrador' AND OLD.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Un expediente activo no regresa a borrador' USING ERRCODE = '42501';
  END IF;
  IF NEW.auditor_user_id IS DISTINCT FROM OLD.auditor_user_id OR NEW.activado_por IS DISTINCT FROM OLD.activado_por
     OR NEW.activado_en IS DISTINCT FROM OLD.activado_en THEN
    RAISE EXCEPTION 'Dato no modificable' USING ERRCODE = '42501';
  END IF;
  IF NEW.estado IN ('cerrado','revocado') THEN
    v_es_rs := public.has_role(v_uid, 'responsable_sanitario') OR public.is_super_admin();
    IF NOT v_es_rs THEN
      RAISE EXCEPTION 'Solo el Responsable Sanitario cierra o revoca el expediente' USING ERRCODE = '42501';
    END IF;
    NEW.cerrado_por := v_uid; NEW.cerrado_en := now();
    IF (to_jsonb(NEW) - ARRAY['estado','cerrado_por','cerrado_en','motivo_cierre'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['estado','cerrado_por','cerrado_en','motivo_cierre']) THEN
      RAISE EXCEPTION 'Al cerrar o revocar solo cambia el estado y el motivo' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.cerrado_por IS DISTINCT FROM OLD.cerrado_por OR NEW.cerrado_en IS DISTINCT FROM OLD.cerrado_en
     OR NEW.motivo_cierre IS DISTINCT FROM OLD.motivo_cierre THEN
    RAISE EXCEPTION 'Dato no modificable' USING ERRCODE = '42501';
  END IF;
  IF OLD.estado = 'activo' AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'Un expediente activo solo se cierra o se revoca' USING ERRCODE = '42501';
  END IF;
  NEW.auditor_email := lower(trim(NEW.auditor_email));
  RETURN NEW;
END $$;
DROP FUNCTION IF EXISTS public.normalizar_email_auditor(text);
ALTER TABLE public.auditorias_externas DROP COLUMN IF EXISTS duplicado_de;
-- auditoria_actividad: quitar 'AUDITORIA_DUPLICADA' del filtro reaplicando la definición de 0037_c6c_auditoria_externa.sql.
