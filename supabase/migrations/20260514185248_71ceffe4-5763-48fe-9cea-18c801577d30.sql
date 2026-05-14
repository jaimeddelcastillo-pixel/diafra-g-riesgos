
-- agent_prompts
CREATE TABLE public.agent_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL CHECK (nombre IN ('dm','farma')),
  system_prompt TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '2.1',
  activo BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_agent_prompts_activo ON public.agent_prompts(nombre) WHERE activo = true;

ALTER TABLE public.agent_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin read agent_prompts"
ON public.agent_prompts FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admin insert agent_prompts"
ON public.agent_prompts FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin update agent_prompts"
ON public.agent_prompts FOR UPDATE TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_agent_prompts_updated_at
BEFORE UPDATE ON public.agent_prompts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- chat_uso_mensual
CREATE TABLE public.chat_uso_mensual (
  org_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  mensajes_consumidos INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, year, month)
);

ALTER TABLE public.chat_uso_mensual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read chat_uso_mensual"
ON public.chat_uso_mensual FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "Service role manages chat_uso_mensual"
ON public.chat_uso_mensual FOR ALL TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-documentos', 'chat-documentos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members read chat-documentos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-documentos'
  AND (storage.foldername(name))[1] = public.get_user_org_id()::text
);

CREATE POLICY "Org members upload chat-documentos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-documentos'
  AND (storage.foldername(name))[1] = public.get_user_org_id()::text
);

CREATE POLICY "Org members delete chat-documentos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-documentos'
  AND (storage.foldername(name))[1] = public.get_user_org_id()::text
);

-- Seed prompts placeholder
INSERT INTO public.agent_prompts (nombre, system_prompt, version, activo) VALUES
('dm',
'Eres Agent DM, un experto en gestión de riesgos para dispositivos médicos según ISO 14971 y NOM-241-SSA1-2025. Ayudas a equipos de calidad a identificar, analizar, evaluar y controlar riesgos usando metodología AMEF. Sé preciso, técnico y siempre cita la norma aplicable.

[PLACEHOLDER — reemplazar con el contenido completo del documento TRACEA_Risk_Manager_Prompts_v2.1.docx desde el panel de Admin > Agentes IA.]',
'2.1', true),
('farma',
'Eres Agent Farma, un experto en gestión de riesgos para medicamentos según NOM-059-SSA1-2015 e ICH Q9. Ayudas a equipos de calidad farmacéutica a identificar, analizar, evaluar y controlar riesgos en procesos productivos y de calidad. Sé preciso, técnico y siempre cita la norma aplicable.

[PLACEHOLDER — reemplazar con el contenido completo del documento TRACEA_Risk_Manager_Prompts_v2.1.docx desde el panel de Admin > Agentes IA.]',
'2.1', true);
