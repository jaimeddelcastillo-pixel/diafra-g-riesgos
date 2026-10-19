CREATE OR REPLACE FUNCTION public.tend_retirar_registro_completo(_id uuid, _motivo text, _confirmacion text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; reg record; codigo_ins text; at_codigo text; s record; n integer:=0; BEGIN
 org:=public.get_user_org_id();
 IF NOT public.tend_acceso(org,true,ARRAY['admin','responsable_sanitario']) THEN RAISE EXCEPTION 'Solo admin o responsable sanitario pueden retirar un registro completo'; END IF;
 IF coalesce(btrim(_motivo),'')='' THEN RAISE EXCEPTION 'Retirar requiere motivo'; END IF;
 SELECT r.id,r.activo,r.nombre,i.codigo INTO reg FROM public.tend_registros r LEFT JOIN public.tend_instrumentos i ON i.id=r.instrumento_id AND i.org_id=r.org_id WHERE r.org_id=org AND r.id=_id FOR UPDATE OF r;
 IF reg.id IS NULL OR NOT reg.activo THEN RAISE EXCEPTION 'Registro no disponible para retirar'; END IF;
 codigo_ins:=upper(btrim(coalesce(reg.codigo,'RETIRAR')));
 IF upper(btrim(coalesce(_confirmacion,'')))<>codigo_ins THEN RAISE EXCEPTION 'Confirmación incorrecta: escribe %',codigo_ins; END IF;
 SELECT a.codigo INTO at_codigo FROM public.tend_registros_at a WHERE a.org_id=org AND a.estado='emitido' AND (
  EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(a.datos_snapshot->'registros','[]')) r WHERE r->>'id'=_id::text)
  OR EXISTS(SELECT 1 FROM public.tend_semanas sm WHERE sm.org_id=org AND sm.registro_id=_id AND public.tend_semana_en_emitido(org,sm.id))) ORDER BY a.codigo LIMIT 1;
 IF at_codigo IS NOT NULL THEN RAISE EXCEPTION 'No se puede retirar: hay semanas incluidas en el AT emitido %',at_codigo; END IF;
 PERFORM set_config('tracea.retiro_motivo',btrim(_motivo),true); PERFORM set_config('tracea.semana_motivo',btrim(_motivo),true);
 FOR s IN SELECT id FROM public.tend_semanas WHERE org_id=org AND registro_id=_id AND activo FOR UPDATE LOOP
  UPDATE public.tend_semanas SET activo=false WHERE org_id=org AND id=s.id; n:=n+1;
 END LOOP;
 UPDATE public.tend_registros SET activo=false WHERE org_id=org AND id=_id;
 PERFORM set_config('tracea.retiro_motivo','',true); PERFORM set_config('tracea.semana_motivo','',true);
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.tend_retirar_registro_completo(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tend_retirar_registro_completo(uuid,text,text) TO authenticated;
COMMENT ON FUNCTION public.tend_retirar_registro_completo(uuid,text,text) IS 'Zona de peligro: retira (no borra) registro y semanas con motivo y auditoría; bloquea si alguna semana está en AT emitido.';