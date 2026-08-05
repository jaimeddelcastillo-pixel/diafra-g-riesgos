-- 1. Configuración en organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS folio_prefijo TEXT NOT NULL DEFAULT 'GR',
  ADD COLUMN IF NOT EXISTS folio_formato_periodo TEXT NOT NULL DEFAULT 'anio_completo',
  ADD COLUMN IF NOT EXISTS folio_digitos_consecutivo INTEGER NOT NULL DEFAULT 3;

CREATE OR REPLACE FUNCTION public.validate_org_folio_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.folio_prefijo := UPPER(TRIM(COALESCE(NEW.folio_prefijo, 'GR')));
  IF NEW.folio_prefijo !~ '^[A-Z]{2,4}$' THEN
    RAISE EXCEPTION 'folio_prefijo inválido: %. Debe tener 2 a 4 letras (A-Z).', NEW.folio_prefijo;
  END IF;
  IF NEW.folio_formato_periodo NOT IN ('anio_completo','anio_corto','trimestre','sin_periodo') THEN
    RAISE EXCEPTION 'folio_formato_periodo inválido: %', NEW.folio_formato_periodo;
  END IF;
  IF NEW.folio_digitos_consecutivo NOT IN (3,4) THEN
    RAISE EXCEPTION 'folio_digitos_consecutivo inválido: %. Permitidos: 3 o 4', NEW.folio_digitos_consecutivo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_org_folio_config_trigger ON public.organizations;
CREATE TRIGGER validate_org_folio_config_trigger
BEFORE INSERT OR UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.validate_org_folio_config();

-- 2. Tabla de tipos/grupos de folio por organización
CREATE TABLE IF NOT EXISTS public.org_folio_tipos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  es_personalizado BOOLEAN NOT NULL DEFAULT false,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_folio_tipos TO authenticated;
GRANT ALL ON public.org_folio_tipos TO service_role;

ALTER TABLE public.org_folio_tipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Miembros ven tipos de su organización" ON public.org_folio_tipos;
CREATE POLICY "Miembros ven tipos de su organización"
ON public.org_folio_tipos FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Admins crean tipos de su organización" ON public.org_folio_tipos;
CREATE POLICY "Admins crean tipos de su organización"
ON public.org_folio_tipos FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Admins editan tipos de su organización" ON public.org_folio_tipos;
CREATE POLICY "Admins editan tipos de su organización"
ON public.org_folio_tipos FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  public.is_super_admin()
  OR (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Admins borran solo tipos personalizados" ON public.org_folio_tipos;
CREATE POLICY "Admins borran solo tipos personalizados"
ON public.org_folio_tipos FOR DELETE TO authenticated
USING (
  es_personalizado = true
  AND (
    public.is_super_admin()
    OR (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  )
);

DROP TRIGGER IF EXISTS trg_org_folio_tipos_updated_at ON public.org_folio_tipos;
CREATE TRIGGER trg_org_folio_tipos_updated_at
BEFORE UPDATE ON public.org_folio_tipos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Semilla de tipos base por norma
CREATE OR REPLACE FUNCTION public.seed_org_folio_tipos(_org_id UUID, _norma TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigos TEXT[];
  v_nombres JSONB := jsonb_build_object(
    'SGC','Sistema de Gestión de Calidad',
    'FAB','Procesos de Fabricación',
    'SIS','Sistemas Críticos e Infraestructura',
    'CAL','Eventos de Calidad',
    'PRD','Producto / Diseño',
    'PMS','Post-mercado / Tecnovigilancia',
    'FV','Farmacovigilancia'
  );
  v_cod TEXT;
  v_i INTEGER := 0;
BEGIN
  v_codigos := CASE
    WHEN _norma = 'NOM-059' THEN ARRAY['SGC','FAB','SIS','CAL','PRD','FV']
    WHEN _norma = 'MULTI'   THEN ARRAY['SGC','FAB','SIS','CAL','PRD','PMS','FV']
    ELSE ARRAY['SGC','FAB','SIS','CAL','PRD','PMS']
  END;

  FOREACH v_cod IN ARRAY v_codigos LOOP
    v_i := v_i + 1;
    INSERT INTO public.org_folio_tipos (org_id, codigo, nombre, activo, es_personalizado, orden)
    VALUES (_org_id, v_cod, v_nombres ->> v_cod, true, false, v_i)
    ON CONFLICT (org_id, codigo) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_org_folio_tipos_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_org_folio_tipos(NEW.id, NEW.norma_aplicable);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_org_folio_tipos ON public.organizations;
CREATE TRIGGER trg_seed_org_folio_tipos
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.seed_org_folio_tipos_trigger();

-- Backfill de organizaciones existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, norma_aplicable FROM public.organizations LOOP
    PERFORM public.seed_org_folio_tipos(r.id, r.norma_aplicable);
  END LOOP;
END $$;

-- 4. folio_sequence: clave de período
ALTER TABLE public.folio_sequence
  ADD COLUMN IF NOT EXISTS periodo_key TEXT;

UPDATE public.folio_sequence SET periodo_key = year::text WHERE periodo_key IS NULL;
ALTER TABLE public.folio_sequence ALTER COLUMN periodo_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS folio_sequence_org_tipo_periodo_uidx
  ON public.folio_sequence (org_id, tipo, periodo_key);

-- 5. folios: partes del código
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS codigo_periodo TEXT,
  ADD COLUMN IF NOT EXISTS codigo_consecutivo INTEGER;

CREATE OR REPLACE FUNCTION public.set_folio_codigo_partes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parts TEXT[];
  n INTEGER;
BEGIN
  IF NEW.codigo IS NULL THEN RETURN NEW; END IF;
  parts := string_to_array(NEW.codigo, '-');
  n := array_length(parts, 1);
  IF n IS NULL OR n < 3 THEN RETURN NEW; END IF;

  IF parts[n] ~ '^\d+$' THEN
    NEW.codigo_consecutivo := parts[n]::INTEGER;
  END IF;

  IF n > 3 THEN
    NEW.codigo_periodo := array_to_string(parts[3:n-1], '-');
  ELSE
    NEW.codigo_periodo := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_folio_codigo_partes ON public.folios;
CREATE TRIGGER trg_set_folio_codigo_partes
BEFORE INSERT ON public.folios
FOR EACH ROW EXECUTE FUNCTION public.set_folio_codigo_partes();

-- Backfill de folios existentes (formato GR-TIPO-AAAA-NNN)
UPDATE public.folios f
SET codigo_periodo = (string_to_array(f.codigo, '-'))[3],
    codigo_consecutivo = NULLIF(regexp_replace((string_to_array(f.codigo, '-'))[4], '\D', '', 'g'), '')::INTEGER
WHERE f.codigo_consecutivo IS NULL
  AND array_length(string_to_array(f.codigo, '-'), 1) = 4;

-- 6. Generador de códigos configurable
CREATE OR REPLACE FUNCTION public.next_folio_code(p_tipo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id      UUID := public.get_user_org_id();
  v_tipo        TEXT;
  v_prefijo     TEXT;
  v_formato     TEXT;
  v_digitos     INTEGER;
  v_year        INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_periodo     TEXT;
  v_periodo_key TEXT;
  v_num         INTEGER;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización asignada — no puede crear folios';
  END IF;

  v_tipo := UPPER(TRIM(COALESCE(p_tipo, '')));
  IF v_tipo = '' THEN
    RAISE EXCEPTION 'Tipo de folio requerido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.org_folio_tipos t
    WHERE t.org_id = v_org_id AND t.codigo = v_tipo AND t.activo = true
  ) THEN
    RAISE EXCEPTION 'Tipo de folio inválido o inactivo para esta organización: %', v_tipo;
  END IF;

  SELECT COALESCE(folio_prefijo, 'GR'),
         COALESCE(folio_formato_periodo, 'anio_completo'),
         COALESCE(folio_digitos_consecutivo, 3)
    INTO v_prefijo, v_formato, v_digitos
  FROM public.organizations WHERE id = v_org_id;

  v_periodo := CASE v_formato
    WHEN 'anio_completo' THEN v_year::TEXT
    WHEN 'anio_corto'    THEN RIGHT(v_year::TEXT, 2)
    WHEN 'trimestre'     THEN 'Q' || EXTRACT(QUARTER FROM CURRENT_DATE)::INT || '-' || RIGHT(v_year::TEXT, 2)
    ELSE NULL
  END;

  v_periodo_key := COALESCE(v_periodo, 'ALL');

  LOOP
    UPDATE public.folio_sequence
       SET last_number = last_number + 1
     WHERE org_id = v_org_id AND tipo = v_tipo AND periodo_key = v_periodo_key
     RETURNING last_number INTO v_num;
    EXIT WHEN FOUND;

    BEGIN
      INSERT INTO public.folio_sequence (org_id, year, tipo, periodo_key, last_number)
      VALUES (v_org_id, v_year, v_tipo, v_periodo_key, 1)
      RETURNING last_number INTO v_num;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- otro proceso insertó primero; reintentar el UPDATE
    END;
  END LOOP;

  RETURN v_prefijo || '-' || v_tipo || '-'
         || CASE WHEN v_periodo IS NULL THEN '' ELSE v_periodo || '-' END
         || LPAD(v_num::TEXT, v_digitos, '0');
END;
$$;

-- 7. Reciclaje del consecutivo basado en las partes del código
CREATE OR REPLACE FUNCTION public.reciclar_folio_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo        TEXT;
  v_num         INTEGER;
  v_periodo_key TEXT;
  v_last        INTEGER;
  parts         TEXT[];
  n             INTEGER;
BEGIN
  IF OLD.codigo IS NULL OR OLD.org_id IS NULL THEN
    RETURN OLD;
  END IF;

  parts := string_to_array(OLD.codigo, '-');
  n := array_length(parts, 1);
  IF n IS NULL OR n < 3 THEN
    RETURN OLD;
  END IF;

  v_tipo := parts[2];
  v_num := COALESCE(OLD.codigo_consecutivo, NULLIF(regexp_replace(parts[n], '\D', '', 'g'), '')::INTEGER);
  v_periodo_key := COALESCE(
    OLD.codigo_periodo,
    CASE WHEN n > 3 THEN array_to_string(parts[3:n-1], '-') ELSE NULL END,
    'ALL'
  );

  IF v_num IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT last_number INTO v_last
    FROM public.folio_sequence
   WHERE org_id = OLD.org_id AND tipo = v_tipo AND periodo_key = v_periodo_key;

  IF v_last IS NOT NULL AND v_num = v_last THEN
    UPDATE public.folio_sequence
       SET last_number = GREATEST(last_number - 1, 0)
     WHERE org_id = OLD.org_id AND tipo = v_tipo AND periodo_key = v_periodo_key;
  END IF;

  RETURN OLD;
END;
$$;