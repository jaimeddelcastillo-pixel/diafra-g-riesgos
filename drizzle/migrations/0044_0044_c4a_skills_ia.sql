-- ══════════════════════════════════════════════════════════════════════
-- C4a · Skills de IA: control y trazabilidad
-- 1. Catálogo ia_skills (7 altas) + FK agent_prompts → ia_skills.
-- 2. agent_prompts: estado (borrador/vigente/retirada), motivo_cambio,
--    aprobado_por, aprobado_en, sha256; versiones publicadas inmutables;
--    activo sincronizado con 'vigente'; todo en la bitácora.
-- 3. skills_usadas jsonb en chat_mensajes, brain_interview_turns y
--    brain_extracciones.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Catálogo de skills ───────────────────────────────────────────
CREATE TABLE public.ia_skills (
  clave text PRIMARY KEY,
  nombre text NOT NULL,
  ambito text NOT NULL CHECK (ambito IN ('plataforma','norma','modulo','tarea')),
  modulo text,
  norma text,
  descripcion text,
  activo boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.ia_skills TO authenticated;
GRANT ALL ON public.ia_skills TO service_role;
ALTER TABLE public.ia_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_skills lectura super_admin"
  ON public.ia_skills FOR SELECT TO authenticated
  USING (public.is_super_admin());
CREATE POLICY "ia_skills escritura super_admin"
  ON public.ia_skills FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

INSERT INTO public.ia_skills (clave, nombre, ambito, modulo, norma, descripcion, activo) VALUES
  ('dm', 'Dispositivos Médicos', 'norma', NULL, 'NOM-241', 'Prompt del asistente para empresas de dispositivos médicos (NOM-241).', true),
  ('farma', 'Medicamentos', 'norma', NULL, 'NOM-059', 'Prompt del asistente para empresas de medicamentos (NOM-059).', true),
  ('cerebro_institucional', 'Cerebro Institucional', 'modulo', 'cerebro', NULL, 'Prompt maestro de las entrevistas del Cerebro.', true),
  ('extraccion_documento', 'Extracción de documentos', 'tarea', NULL, NULL, 'Instrucción de extracción de conocimiento de archivos (C6a).', true),
  ('analisis_documento', 'Análisis de documentos', 'tarea', NULL, NULL, 'Clasificación y análisis de documentos para el chat.', true),
  ('causa_raiz_ishikawa', 'Causa raíz · Ishikawa 6M', 'tarea', NULL, NULL, 'Causas potenciales por 6M para análisis de riesgo.', true),
  ('causa_raiz_5porques', 'Causa raíz · 5 Porqués', 'tarea', NULL, NULL, 'Validación de la cadena de 5 Porqués.', true);

-- ── 2. agent_prompts: FK y control ─────────────────────────────────
ALTER TABLE public.agent_prompts DROP CONSTRAINT IF EXISTS agent_prompts_nombre_check;
ALTER TABLE public.agent_prompts
  ADD CONSTRAINT agent_prompts_nombre_fkey
  FOREIGN KEY (nombre) REFERENCES public.ia_skills(clave);

ALTER TABLE public.agent_prompts
  ADD COLUMN estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','vigente','retirada')),
  ADD COLUMN motivo_cambio text,
  ADD COLUMN aprobado_por uuid,
  ADD COLUMN aprobado_en timestamptz,
  ADD COLUMN sha256 text;

COMMENT ON COLUMN public.agent_prompts.estado IS 'C4a: borrador | vigente | retirada. Las publicadas son inmutables.';
COMMENT ON COLUMN public.agent_prompts.motivo_cambio IS 'C4a: motivo obligatorio al publicar o retirar.';
COMMENT ON COLUMN public.agent_prompts.aprobado_por IS 'C4a: quién publicó esta versión.';
COMMENT ON COLUMN public.agent_prompts.aprobado_en IS 'C4a: cuándo se publicó esta versión.';
COMMENT ON COLUMN public.agent_prompts.sha256 IS 'C4a: huella del texto (system_prompt).';

-- Migración de filas existentes: activo=true → vigente, resto retirada.
UPDATE public.agent_prompts
SET estado = CASE WHEN activo THEN 'vigente' ELSE 'retirada' END,
    sha256 = encode(sha256(convert_to(system_prompt, 'UTF8')), 'hex'),
    motivo_cambio = CASE WHEN activo
      THEN 'Migración C4a: versión vigente'
      ELSE 'Migración C4a: versión histórica' END,
    aprobado_por = CASE WHEN activo THEN updated_by END,
    aprobado_en = CASE WHEN activo THEN created_at END;

-- Gobernanza: versiones publicadas inmutables, transiciones acotadas,
-- activo sincronizado con 'vigente'.
CREATE OR REPLACE FUNCTION public.agent_prompts_governance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $g$
BEGIN
  IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
    RAISE EXCEPTION 'La clave de la skill no se puede cambiar';
  END IF;
  IF OLD.estado IN ('vigente','retirada')
     AND (NEW.system_prompt IS DISTINCT FROM OLD.system_prompt
       OR NEW.version IS DISTINCT FROM OLD.version) THEN
    RAISE EXCEPTION 'Una versión publicada no se puede editar; publica una versión nueva.';
  END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF NOT (
      (OLD.estado = 'borrador' AND NEW.estado IN ('vigente','retirada')) OR
      (OLD.estado = 'vigente' AND NEW.estado = 'retirada')
    ) THEN
      RAISE EXCEPTION 'Transición de estado no permitida: % -> %', OLD.estado, NEW.estado;
    END IF;
    IF NEW.estado = 'vigente' THEN
      NEW.aprobado_por := COALESCE(auth.uid(), NEW.aprobado_por);
      NEW.aprobado_en := now();
    END IF;
  END IF;
  IF NEW.estado = 'vigente'
     AND NEW.sha256 IS DISTINCT FROM encode(sha256(convert_to(NEW.system_prompt, 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'La huella sha256 no coincide con el texto de la skill';
  END IF;
  IF NEW.sha256 IS NULL THEN
    NEW.sha256 := encode(sha256(convert_to(NEW.system_prompt, 'UTF8')), 'hex');
  END IF;
  NEW.activo := (NEW.estado = 'vigente');
  RETURN NEW;
END $g$;

-- Ingreso: calcula huella y, si nace vigente, sella aprobación.
CREATE OR REPLACE FUNCTION public.agent_prompts_ingreso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $i$
BEGIN
  IF NEW.sha256 IS NULL THEN
    NEW.sha256 := encode(sha256(convert_to(NEW.system_prompt, 'UTF8')), 'hex');
  END IF;
  IF NEW.estado = 'vigente' THEN
    NEW.aprobado_por := COALESCE(auth.uid(), NEW.aprobado_por);
    NEW.aprobado_en := now();
  END IF;
  NEW.activo := (NEW.estado = 'vigente');
  RETURN NEW;
END $i$;

-- Bitácora: alta, publicación y retiro de versiones.
CREATE OR REPLACE FUNCTION public.agent_prompts_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $a$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo)
    VALUES (auth.uid(), NULL, 'agent_prompts', NEW.id::text, 'SKILL_VERSION_CREADA',
      jsonb_build_object('clave', NEW.nombre, 'version', NEW.version, 'estado', NEW.estado,
                         'motivo', NEW.motivo_cambio, 'sha256', NEW.sha256));
    RETURN NULL;
  END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_anterior, valor_nuevo)
    VALUES (auth.uid(), NULL, 'agent_prompts', NEW.id::text,
      CASE NEW.estado WHEN 'vigente' THEN 'SKILL_PUBLICADA' ELSE 'SKILL_RETIRADA' END,
      jsonb_build_object('clave', OLD.nombre, 'version', OLD.version, 'estado', OLD.estado),
      jsonb_build_object('clave', NEW.nombre, 'version', NEW.version, 'estado', NEW.estado,
                         'motivo', NEW.motivo_cambio, 'aprobado_por', NEW.aprobado_por, 'sha256', NEW.sha256));
  END IF;
  RETURN NULL;
END $a$;

CREATE TRIGGER trg_agent_prompts_ingreso
  BEFORE INSERT ON public.agent_prompts
  FOR EACH ROW EXECUTE FUNCTION public.agent_prompts_ingreso();
CREATE TRIGGER trg_agent_prompts_governance
  BEFORE UPDATE ON public.agent_prompts
  FOR EACH ROW EXECUTE FUNCTION public.agent_prompts_governance();
CREATE TRIGGER trg_agent_prompts_audit
  AFTER INSERT OR UPDATE ON public.agent_prompts
  FOR EACH ROW EXECUTE FUNCTION public.agent_prompts_audit();

-- ── 2b. Prompts fijos trasladados a la base (texto literal, v1.0) ──
INSERT INTO public.agent_prompts (nombre, system_prompt, version, estado, motivo_cambio) VALUES
('extraccion_documento', $sk$Extrae conocimiento institucional del documento {{documento}}. Devuelve EXCLUSIVAMENTE un JSON válido:
{
  "conocimientos": [
    {
      "tipo": uno de identidad_organizacional, producto_proceso, rol_responsabilidad, requisito_regulatorio, arquitectura_sgc, criterio_documental, conocimiento_operativo, riesgo_control, validacion_calificacion, desviacion_capa, auditoria_aprendizaje, regla_pno,
      "contenido": "...",
      "titulo": "título corto opcional",
      "marco": "marco de referencia o norma si es aplicable (opcional)",
      "afecta_cumplimiento": true|false
    }
  ],
  "proceso": {"nombre": "..."},
  "area": {"nombre": "..."},
  "fuentes": [{"tipo_fuente": "pagina|parrafo|seccion|cita|metodo", "pagina": 1, "parrafo": 3, "seccion": "...", "cita_textual": "...", "metodo": "vision|texto"}]
}
Reglas:
- Solo conocimiento que aplique a TODA la organización y sea verificable en el documento; nunca información de una persona o caso particular.
- Un conocimiento puede tener varias fuentes.
- Si una fuente no se puede referenciar, omite ese conocimiento.
- No uses conocimiento externo: solo lo leído del documento.$sk$, '1.0', 'vigente', 'Migración C4a: prompt fijo trasladado a la base'),
('analisis_documento', $sk$Analiza el documento {{documento}} y devuelve EXCLUSIVAMENTE un JSON válido con esta estructura:
{
  "tipo": "amef" | "procedimiento" | "estudio" | "evidencia" | "otro",
  "confianza": 1-10,
  "razon": "...",
  "hallazgos": ["..."],
  "riesgos_deteccion": ["..."],
  "preguntas": ["pregunta para el comité"]
}
No agregues explicaciones fuera del JSON.$sk$, '1.0', 'vigente', 'Migración C4a: prompt fijo trasladado a la base'),
('causa_raiz_ishikawa', $sk$Eres un experto en gestión de riesgos según {{norma}} (ISO 14971 / ICH Q9). Devuelve EXCLUSIVAMENTE un JSON válido sin texto adicional, sin markdown, sin ```. Estructura exacta: {"mano_obra":[],"maquina":[],"metodo":[],"material":[],"medio_ambiente":[],"medicion":[]}. Cada lista debe tener entre 2 y 4 causas potenciales concretas, específicas al peligro y proceso. Evita causas genéricas tipo "error humano" o "falta de capacitación" sin contexto. Cada causa: máximo 12 palabras.$sk$, '1.0', 'vigente', 'Migración C4a: prompt fijo trasladado a la base'),
('causa_raiz_5porques', $sk$Eres un experto en análisis de causa raíz bajo {{norma}}. Evalúa si la cadena de 5 Porqués llega a una verdadera causa raíz (sistémica, controlable por la organización, no atribuible a culpa individual, no puede seguir preguntándose "por qué" de forma significativa). Devuelve EXCLUSIVAMENTE JSON sin markdown: {"esCausaRaiz":boolean,"justificacion":"...","sugerencia":"... o null"}. "sugerencia" debe contener el siguiente porqué propuesto si aún no es raíz, o null.$sk$, '1.0', 'vigente', 'Migración C4a: prompt fijo trasladado a la base');

-- ── 3. Trazabilidad de skills usadas ──────────────────────────────
ALTER TABLE public.chat_mensajes ADD COLUMN IF NOT EXISTS skills_usadas jsonb;
ALTER TABLE public.brain_interview_turns ADD COLUMN IF NOT EXISTS skills_usadas jsonb;
ALTER TABLE public.brain_extracciones ADD COLUMN IF NOT EXISTS skills_usadas jsonb;
