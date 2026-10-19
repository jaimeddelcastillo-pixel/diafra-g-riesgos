-- T4c: catálogo normativo de Tendencias + atribución de cambios de sistema en auditoría (IM-20).
CREATE TABLE public.tend_norma_especificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norma text NOT NULL,
  apartado text,
  clase_iso text NOT NULL,
  variable text NOT NULL CHECK (variable IN ('presion','temperatura','hr')),
  texto text NOT NULL,
  lie numeric,
  lse numeric,
  lie_estricto boolean NOT NULL DEFAULT false,
  lse_estricto boolean NOT NULL DEFAULT false,
  unidad text,
  sin_valor boolean NOT NULL DEFAULT false,
  nota text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (norma, clase_iso, variable)
);
GRANT SELECT ON public.tend_norma_especificaciones TO authenticated;
GRANT INSERT, UPDATE ON public.tend_norma_especificaciones TO authenticated;
GRANT ALL ON public.tend_norma_especificaciones TO service_role;
ALTER TABLE public.tend_norma_especificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY tend_norma_select ON public.tend_norma_especificaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY tend_norma_insert ON public.tend_norma_especificaciones FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY tend_norma_update ON public.tend_norma_especificaciones FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.tend_norma_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Catálogo normativo: desactivar, nunca borrar'; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN RAISE EXCEPTION 'Solo super_admin edita el catálogo normativo'; END IF;
  NEW.updated_at := now(); NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER tend_norma_guard BEFORE INSERT OR UPDATE OR DELETE ON public.tend_norma_especificaciones FOR EACH ROW EXECUTE FUNCTION public.tend_norma_guard();
CREATE TRIGGER tend_norma_audit AFTER INSERT OR UPDATE ON public.tend_norma_especificaciones FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- IM-20: motivo, origen y autorización en la auditoría.
ALTER TABLE public.audit_trail
  ADD COLUMN motivo text,
  ADD COLUMN origen text NOT NULL DEFAULT 'usuario',
  ADD COLUMN autorizado_por text;

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID; v_record_id TEXT; v_solicitado UUID;
  v_motivo TEXT := coalesce(nullif(current_setting('tracea.motivo', true), ''), nullif(current_setting('tracea.retiro_motivo', true), ''), nullif(current_setting('tracea.semana_motivo', true), ''));
  v_autorizado TEXT := nullif(current_setting('tracea.autorizado_por', true), '');
  v_origen TEXT := CASE WHEN auth.uid() IS NULL OR nullif(current_setting('tracea.origen', true), '') = 'sistema' THEN 'sistema' ELSE 'usuario' END;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org_id := (to_jsonb(OLD) ->> 'org_id')::UUID; v_record_id := (to_jsonb(OLD) ->> 'id');
  ELSE
    v_org_id := (to_jsonb(NEW) ->> 'org_id')::UUID; v_record_id := (to_jsonb(NEW) ->> 'id');
    IF auth.uid() IS NULL THEN
      BEGIN v_solicitado := (to_jsonb(NEW) ->> 'actualizado_por')::UUID; EXCEPTION WHEN others THEN v_solicitado := NULL; END;
    END IF;
  END IF;
  IF v_org_id IS NULL THEN v_org_id := public.get_user_org_id(); END IF;
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_anterior, valor_nuevo, solicitado_por, motivo, origen, autorizado_por)
    VALUES (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_solicitado, v_motivo, v_origen, v_autorizado);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo, solicitado_por, motivo, origen, autorizado_por)
    VALUES (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'INSERT', to_jsonb(NEW), v_solicitado, v_motivo, v_origen, v_autorizado);
    RETURN NEW;
  ELSE
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_anterior, motivo, origen, autorizado_por)
    VALUES (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'DELETE', to_jsonb(OLD), v_motivo, v_origen, v_autorizado);
    RETURN OLD;
  END IF;
END;
$function$;

-- tend_guard: un proceso de sistema (sin usuario) solo escribe si declara motivo y quién lo autorizó.
CREATE OR REPLACE FUNCTION public.tend_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r text[]; sistema boolean; BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Tendencias: retirar o anular, nunca borrar'; END IF;
 sistema := auth.uid() IS NULL AND coalesce(current_setting('tracea.origen',true),'')='sistema'
   AND coalesce(current_setting('tracea.motivo',true),'')<>'' AND coalesce(current_setting('tracea.autorizado_por',true),'')<>'';
 r:=CASE WHEN TG_TABLE_NAME IN ('tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion','tend_formato','tend_config') THEN ARRAY['admin','responsable_sanitario'] ELSE ARRAY['operador','comite_tecnico','admin','responsable_sanitario'] END;
 IF NOT sistema AND NOT public.tend_acceso(NEW.org_id,true,r) THEN RAISE EXCEPTION 'Sin permiso de escritura en Tendencias'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN RAISE EXCEPTION 'Identidad y autor originales inmutables'; END IF;
 IF TG_OP='INSERT' THEN NEW.created_by:=auth.uid(); NEW.created_at:=now(); END IF;
 NEW.updated_by:=auth.uid(); NEW.updated_at:=now();
 IF TG_TABLE_NAME='tend_semanas' AND coalesce(to_jsonb(NEW)->>'foto_path','')<>'' AND (split_part(to_jsonb(NEW)->>'foto_path','/',1)<>NEW.org_id::text OR (to_jsonb(NEW)->>'foto_path') ~ '(^|/)\.\.(/|$)') THEN RAISE EXCEPTION 'Foto fuera de empresa'; END IF;
 RETURN NEW;
END $function$;

-- Instrumento: escala, clase de instrumento y criterio interno.
ALTER TABLE public.tend_instrumentos
  ADD COLUMN clase_instrumento text CHECK (clase_instrumento IN ('diferencial_sala','filtro_ducto','aire_proceso','equipo')),
  ADD COLUMN escala_min numeric,
  ADD COLUMN escala_max numeric,
  ADD COLUMN escala_unidad text,
  ADD COLUMN spec_criterio_interno boolean NOT NULL DEFAULT false,
  ADD COLUMN spec_nota text;
SELECT set_config('tracea.origen','sistema',true), set_config('tracea.motivo','T4c: clase de instrumento derivada del tipo existente',true), set_config('tracea.autorizado_por','Jaime Del Castillo (solicitud T4c)',true);
UPDATE public.tend_instrumentos SET clase_instrumento = CASE tipo WHEN 'manometro_diferencial' THEN 'diferencial_sala' WHEN 'manometro_filtro' THEN 'filtro_ducto' WHEN 'termohigrometro' THEN 'equipo' ELSE NULL END WHERE clase_instrumento IS NULL;
SELECT set_config('tracea.origen','',true), set_config('tracea.motivo','',true), set_config('tracea.autorizado_por','',true);

-- Edición individual de un instrumento desde Revisión del catálogo: motivo obligatorio, sin cambios en bloque.
CREATE OR REPLACE FUNCTION public.tend_editar_instrumento(_id uuid, _cambios jsonb, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE r public.tend_instrumentos; org uuid;
BEGIN
  SELECT c.org_id INTO org FROM public.contexto_org_actual() c;
  IF length(trim(coalesce(_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Editar requiere motivo'; END IF;
  IF NOT public.tend_acceso(org, true, ARRAY['admin','responsable_sanitario']) THEN RAISE EXCEPTION 'Sin permiso de escritura en Tendencias'; END IF;
  SELECT * INTO r FROM public.tend_instrumentos WHERE id = _id AND org_id = org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Instrumento no encontrado en la empresa activa'; END IF;
  r := jsonb_populate_record(r, _cambios - ARRAY['id','org_id','created_at','created_by','updated_at','updated_by','migrado_desde','activo']);
  PERFORM set_config('tracea.motivo', trim(_motivo), true);
  UPDATE public.tend_instrumentos SET
    codigo = r.codigo, tipo = r.tipo, clase_instrumento = r.clase_instrumento, area_id = r.area_id, area_libre = r.area_libre,
    parametro = r.parametro, codigo_bitacora = r.codigo_bitacora, especificacion = r.especificacion,
    spec_estado = r.spec_estado, spec_texto = r.spec_texto, spec_lie = r.spec_lie, spec_lse = r.spec_lse,
    spec_lie_estricto = r.spec_lie_estricto, spec_lse_estricto = r.spec_lse_estricto,
    spec_texto_hr = r.spec_texto_hr, spec_lie_hr = r.spec_lie_hr, spec_lse_hr = r.spec_lse_hr,
    spec_referencia = r.spec_referencia, spec_fecha_validacion = r.spec_fecha_validacion,
    spec_criterio_interno = r.spec_criterio_interno, spec_nota = r.spec_nota,
    escala_min = r.escala_min, escala_max = r.escala_max, escala_unidad = r.escala_unidad,
    op_min_pa = r.op_min_pa, op_max_pa = r.op_max_pa
  WHERE id = _id AND org_id = org;
  PERFORM set_config('tracea.motivo', '', true);
END $$;
REVOKE ALL ON FUNCTION public.tend_editar_instrumento(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tend_editar_instrumento(uuid, jsonb, text) TO authenticated;

-- Media real del último trimestre por instrumento (empresa activa; respeta RLS).
CREATE OR REPLACE FUNCTION public.tend_media_trimestre()
RETURNS TABLE (instrumento_id uuid, media numeric, n integer) LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT r.instrumento_id, avg((l->>'valor')::numeric), count(*)::int
  FROM public.tend_registros r
  JOIN public.tend_semanas s ON s.registro_id = r.id AND s.activo AND s.semana_inicio >= (current_date - 91)
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(s.lecturas, '[]'::jsonb)) l
  WHERE r.org_id = (SELECT c.org_id FROM public.contexto_org_actual() c) AND r.activo AND r.instrumento_id IS NOT NULL
    AND jsonb_typeof(l->'valor') = 'number' AND coalesce((l->>'_na')::boolean, false) = false
  GROUP BY r.instrumento_id
$$;
REVOKE ALL ON FUNCTION public.tend_media_trimestre() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tend_media_trimestre() TO authenticated;