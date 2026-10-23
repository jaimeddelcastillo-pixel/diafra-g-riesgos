-- Expired issuance reservations can be released back to «autorización» with an audited reason. No document is registered; an orphan upload (if any) stays unreachable because downloads require a documentos_generados row.
CREATE OR REPLACE FUNCTION public.cancelar_reserva_emision_kpi_word(_id uuid, _motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; r kpi_reportes; u uuid:=auth.uid(); BEGIN
  IF length(trim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
  org:=public.kpi_reporte_preparar('Cancelación de reserva de emisión: '||trim(_motivo));
  SELECT * INTO r FROM kpi_reportes WHERE id=_id AND org_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reporte no encontrado'; END IF;
  IF r.estado<>'borrador' OR r.emision_preparada IS NULL THEN RAISE EXCEPTION 'El reporte no tiene una reserva de emisión'; END IF;
  IF NOT (public.kpi_reporte_autoriza(org,u) IS NOT NULL OR public.rol_efectivo(u,'admin')) THEN RAISE EXCEPTION 'Solo quien puede autorizar o un admin cancela la reserva'; END IF;
  IF coalesce((r.emision_preparada->>'lease_hasta')::timestamptz, r.updated_at + interval '2 minutes') > now() THEN RAISE EXCEPTION 'La reserva sigue vigente; espera a que venza'; END IF;
  PERFORM set_config('tracea.kpi_reportes_rpc','1',true);
  PERFORM set_config('tracea.kpi_reportes_transicion','1',true);
  PERFORM set_config('tracea.motivo','Cancelación de reserva de emisión: '||trim(_motivo),true);
  UPDATE kpi_reportes SET emision_preparada=NULL, etapa='autorizacion' WHERE id=_id AND org_id=org;
  PERFORM set_config('tracea.kpi_reportes_transicion','',true);
END $$;
REVOKE ALL ON FUNCTION public.cancelar_reserva_emision_kpi_word(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_reserva_emision_kpi_word(uuid,text) TO authenticated;