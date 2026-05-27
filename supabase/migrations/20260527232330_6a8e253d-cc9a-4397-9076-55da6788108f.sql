
-- ============ TABLAS ============
CREATE TABLE public.cursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  norma TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(norma)
);

CREATE TABLE public.curso_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_curso_modulos_curso ON public.curso_modulos(curso_id, orden);

CREATE TABLE public.curso_lecciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id UUID NOT NULL REFERENCES public.curso_modulos(id) ON DELETE CASCADE,
  leccion_id TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'video',
  url_video TEXT,
  archivo_storage TEXT,
  proximamente BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_curso_lecciones_modulo ON public.curso_lecciones(modulo_id, orden);

CREATE TABLE public.curso_evaluacion_preguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  pregunta TEXT NOT NULL,
  opcion_a TEXT NOT NULL,
  opcion_b TEXT NOT NULL,
  opcion_c TEXT NOT NULL,
  opcion_d TEXT NOT NULL,
  respuesta_correcta TEXT NOT NULL,
  justificacion TEXT NOT NULL DEFAULT '',
  bloque TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_curso_eval_curso ON public.curso_evaluacion_preguntas(curso_id, orden);

-- ============ GRANTS ============
GRANT SELECT ON public.cursos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cursos TO authenticated;
GRANT ALL ON public.cursos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curso_modulos TO authenticated;
GRANT ALL ON public.curso_modulos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curso_lecciones TO authenticated;
GRANT ALL ON public.curso_lecciones TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curso_evaluacion_preguntas TO authenticated;
GRANT ALL ON public.curso_evaluacion_preguntas TO service_role;

-- ============ RLS ============
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curso_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curso_lecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curso_evaluacion_preguntas ENABLE ROW LEVEL SECURITY;

-- cursos
CREATE POLICY "Authenticated read cursos" ON public.cursos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage cursos" ON public.cursos FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- modulos
CREATE POLICY "Authenticated read curso_modulos" ON public.curso_modulos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage curso_modulos" ON public.curso_modulos FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- lecciones
CREATE POLICY "Authenticated read curso_lecciones" ON public.curso_lecciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage curso_lecciones" ON public.curso_lecciones FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- preguntas
CREATE POLICY "Authenticated read curso_evaluacion_preguntas" ON public.curso_evaluacion_preguntas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage curso_evaluacion_preguntas" ON public.curso_evaluacion_preguntas FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ============ VALIDACIÓN (triggers, no CHECK) ============
CREATE OR REPLACE FUNCTION public.validate_curso_norma()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.norma NOT IN ('NOM-241','NOM-059') THEN
    RAISE EXCEPTION 'norma inválida: %. Permitidos: NOM-241, NOM-059', NEW.norma;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_validate_curso_norma BEFORE INSERT OR UPDATE ON public.cursos
  FOR EACH ROW EXECUTE FUNCTION public.validate_curso_norma();

CREATE OR REPLACE FUNCTION public.validate_leccion_tipo()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tipo NOT IN ('video','descarga','practica','evaluacion') THEN
    RAISE EXCEPTION 'tipo inválido: %. Permitidos: video, descarga, practica, evaluacion', NEW.tipo;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_validate_leccion_tipo BEFORE INSERT OR UPDATE ON public.curso_lecciones
  FOR EACH ROW EXECUTE FUNCTION public.validate_leccion_tipo();

CREATE OR REPLACE FUNCTION public.validate_pregunta()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.respuesta_correcta NOT IN ('A','B','C','D') THEN
    RAISE EXCEPTION 'respuesta_correcta inválida: %. Permitidos: A, B, C, D', NEW.respuesta_correcta;
  END IF;
  IF NEW.bloque NOT IN ('marco_regulatorio','metodologia','casos_practicos','flujo_aprobacion') THEN
    RAISE EXCEPTION 'bloque inválido: %', NEW.bloque;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_validate_pregunta BEFORE INSERT OR UPDATE ON public.curso_evaluacion_preguntas
  FOR EACH ROW EXECUTE FUNCTION public.validate_pregunta();

-- updated_at triggers
CREATE TRIGGER trg_cursos_updated BEFORE UPDATE ON public.cursos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_curso_modulos_updated BEFORE UPDATE ON public.curso_modulos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_curso_lecciones_updated BEFORE UPDATE ON public.curso_lecciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_curso_eval_preguntas_updated BEFORE UPDATE ON public.curso_evaluacion_preguntas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SEED ============
DO $seed$
DECLARE
  v_curso_241 UUID;
  v_curso_059 UUID;
  v_m1 UUID; v_m2 UUID; v_m3 UUID; v_m4 UUID;
BEGIN
  -- ===== NOM-241 =====
  INSERT INTO public.cursos (norma, titulo, descripcion, orden)
  VALUES ('NOM-241', 'Gestión de Riesgos NOM-241 para Dispositivos Médicos', '4 módulos · Constancia DC-3 al finalizar', 1)
  RETURNING id INTO v_curso_241;

  INSERT INTO public.curso_modulos (curso_id, titulo, orden)
  VALUES (v_curso_241, 'Módulo 1: Introducción a la Gestión de Riesgos', 1) RETURNING id INTO v_m1;
  INSERT INTO public.curso_lecciones (modulo_id, leccion_id, titulo, tipo, proximamente, orden) VALUES
    (v_m1, '1.1', '¿Qué es la Gestión de Riesgos en dispositivos médicos?', 'video', true, 1),
    (v_m1, '1.2', 'NOM-241 y COFEPRIS: lo que necesitas saber', 'video', true, 2),
    (v_m1, '1.3', 'Descargar Guía S≥9 DM', 'descarga', false, 3);

  INSERT INTO public.curso_modulos (curso_id, titulo, orden)
  VALUES (v_curso_241, 'Módulo 2: El Archivo Maestro de Gestión de Riesgos', 2) RETURNING id INTO v_m2;
  INSERT INTO public.curso_lecciones (modulo_id, leccion_id, titulo, tipo, proximamente, orden) VALUES
    (v_m2, '2.1', 'Los 6 datos que necesita tu análisis de riesgo', 'video', true, 1),
    (v_m2, '2.2', 'Cómo evaluar el nivel de prioridad de cada riesgo', 'video', true, 2),
    (v_m2, '2.3', 'Descargar PNO-AMGR-01', 'descarga', false, 3);

  INSERT INTO public.curso_modulos (curso_id, titulo, orden)
  VALUES (v_curso_241, 'Módulo 3: Casos Prácticos', 3) RETURNING id INTO v_m3;
  INSERT INTO public.curso_lecciones (modulo_id, leccion_id, titulo, tipo, proximamente, orden) VALUES
    (v_m3, '3.1', 'Análisis completo de proceso', 'video', true, 1),
    (v_m3, '3.2', 'Ejercicio con el Asistente IA', 'practica', false, 2);

  INSERT INTO public.curso_modulos (curso_id, titulo, orden)
  VALUES (v_curso_241, 'Módulo 4: Evaluación y Certificación', 4) RETURNING id INTO v_m4;
  INSERT INTO public.curso_lecciones (modulo_id, leccion_id, titulo, tipo, proximamente, orden) VALUES
    (v_m4, '4.1', 'Evaluación final', 'evaluacion', true, 1),
    (v_m4, '4.2', 'Constancia DC-3', 'video', true, 2);

  -- ===== NOM-059 =====
  INSERT INTO public.cursos (norma, titulo, descripcion, orden)
  VALUES ('NOM-059', 'Gestión de Riesgos NOM-059 para Medicamentos', '4 módulos · Gestión de Riesgos NOM-059 y FEUM', 2)
  RETURNING id INTO v_curso_059;

  INSERT INTO public.curso_modulos (curso_id, titulo, orden)
  VALUES (v_curso_059, 'Módulo 1: Introducción al QRM Farmacéutico', 1) RETURNING id INTO v_m1;
  INSERT INTO public.curso_lecciones (modulo_id, leccion_id, titulo, tipo, proximamente, orden) VALUES
    (v_m1, 'nom059-1-1', '¿Qué es la Gestión de Riesgos de Calidad en medicamentos?', 'video', true, 1),
    (v_m1, 'nom059-1-2', 'NOM-059 y COFEPRIS: lo que necesitas saber', 'video', true, 2),
    (v_m1, 'nom059-1-3', 'Descargar Guía S≥9 — Medicamentos', 'descarga', false, 3);

  INSERT INTO public.curso_modulos (curso_id, titulo, orden)
  VALUES (v_curso_059, 'Módulo 2: El Archivo Maestro de QRM', 2) RETURNING id INTO v_m2;
  INSERT INTO public.curso_lecciones (modulo_id, leccion_id, titulo, tipo, proximamente, orden) VALUES
    (v_m2, 'nom059-2-1', 'Los 6 datos que necesita tu análisis de riesgo NOM-059', 'video', true, 1),
    (v_m2, 'nom059-2-2', 'Parámetros críticos y cómo evaluar el nivel de riesgo', 'video', true, 2),
    (v_m2, 'nom059-2-3', 'Descargar PNO-AMGR-02 — Gestión de Riesgos Medicamentos', 'descarga', false, 3);

  INSERT INTO public.curso_modulos (curso_id, titulo, orden)
  VALUES (v_curso_059, 'Módulo 3: Casos Prácticos', 3) RETURNING id INTO v_m3;
  INSERT INTO public.curso_lecciones (modulo_id, leccion_id, titulo, tipo, proximamente, orden) VALUES
    (v_m3, 'nom059-3-1', 'Análisis de riesgo: proceso de llenado aséptico', 'video', true, 1),
    (v_m3, 'nom059-3-2', 'Practicar con el Asistente IA — Medicamentos', 'practica', false, 2);

  INSERT INTO public.curso_modulos (curso_id, titulo, orden)
  VALUES (v_curso_059, 'Módulo 4: Evaluación y Certificación', 4) RETURNING id INTO v_m4;
  INSERT INTO public.curso_lecciones (modulo_id, leccion_id, titulo, tipo, proximamente, orden) VALUES
    (v_m4, 'nom059-4-1', 'Evaluación final NOM-059', 'evaluacion', true, 1),
    (v_m4, 'nom059-4-2', 'Constancia DC-3', 'video', true, 2);
END;
$seed$;
