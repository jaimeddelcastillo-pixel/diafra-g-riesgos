
-- ── Examen final del estudiante ───────────────────────────────────────────────
CREATE TABLE public.curso_examen_intentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  num_intento INTEGER NOT NULL DEFAULT 1,
  preguntas_ids UUID[] NOT NULL DEFAULT '{}',
  respuestas JSONB NOT NULL DEFAULT '{}'::jsonb,
  correctas INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  calificacion NUMERIC(5,2) NOT NULL DEFAULT 0,
  bloque_resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  aprobado BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.curso_examen_intentos TO authenticated;
GRANT ALL ON public.curso_examen_intentos TO service_role;

ALTER TABLE public.curso_examen_intentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own intentos"
  ON public.curso_examen_intentos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Users create own intentos"
  ON public.curso_examen_intentos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own intentos"
  ON public.curso_examen_intentos FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_examen_intentos_updated_at
BEFORE UPDATE ON public.curso_examen_intentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_examen_intentos_user_curso ON public.curso_examen_intentos(user_id, curso_id);

-- ── Diplomas ─────────────────────────────────────────────────────────────────
CREATE TABLE public.curso_diplomas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  intento_id UUID REFERENCES public.curso_examen_intentos(id) ON DELETE SET NULL,
  fecha_emision TIMESTAMPTZ NOT NULL DEFAULT now(),
  calificacion NUMERIC(5,2) NOT NULL,
  hash_verificacion TEXT NOT NULL UNIQUE,
  pdf_path TEXT,
  alumno_nombre TEXT NOT NULL,
  alumno_email TEXT NOT NULL,
  curso_titulo TEXT NOT NULL,
  curso_norma TEXT NOT NULL,
  duracion_horas NUMERIC(5,1),
  modulos_aprobados JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.curso_diplomas TO authenticated;
GRANT SELECT ON public.curso_diplomas TO anon; -- pública para verificación por hash
GRANT ALL ON public.curso_diplomas TO service_role;

ALTER TABLE public.curso_diplomas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verificación pública por hash"
  ON public.curso_diplomas FOR SELECT TO anon, authenticated
  USING (true);

CREATE TRIGGER trg_diplomas_updated_at
BEFORE UPDATE ON public.curso_diplomas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_diplomas_hash ON public.curso_diplomas(hash_verificacion);
CREATE INDEX idx_diplomas_user ON public.curso_diplomas(user_id);

-- ── Secuencia anual DIP-YYYY-NNN ─────────────────────────────────────────────
CREATE TABLE public.diploma_sequence (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT ON public.diploma_sequence TO authenticated;
GRANT ALL ON public.diploma_sequence TO service_role;
ALTER TABLE public.diploma_sequence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public.diploma_sequence FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.next_diploma_folio()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_num INTEGER;
BEGIN
  INSERT INTO public.diploma_sequence (year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_number = diploma_sequence.last_number + 1
  RETURNING last_number INTO v_num;
  RETURN 'DIP-' || v_year || '-' || LPAD(v_num::TEXT, 3, '0');
END;
$$;
