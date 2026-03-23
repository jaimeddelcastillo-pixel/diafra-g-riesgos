
-- 1. Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'comite_tecnico', 'operador', 'lectura');

-- 2. Enum para estados de folio
CREATE TYPE public.estado_folio AS ENUM ('Borrador', 'En Firma', 'Aprobado', 'Cerrado');

-- 3. Enum para origen de riesgo
CREATE TYPE public.origen_riesgo AS ENUM ('Diseño', 'Proceso', 'Queja / Devolución', 'Desviación', 'Control de Cambios');

-- 4. Enum para dictamen
CREATE TYPE public.dictamen_tipo AS ENUM ('Aceptable', 'No Aceptable', 'Pendiente');

-- 5. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  cargo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 7. Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 8. Folios table
CREATE TABLE public.folios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  estado estado_folio NOT NULL DEFAULT 'Borrador',
  proceso_equipo TEXT NOT NULL,
  origen origen_riesgo NOT NULL,
  desviacion_id TEXT DEFAULT '',
  control_cambios_id TEXT DEFAULT '',
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_cierre DATE,
  alcance TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folios ENABLE ROW LEVEL SECURITY;

-- 9. Folio committee members
CREATE TABLE public.folio_comite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id UUID REFERENCES public.folios(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  nombre TEXT NOT NULL,
  cargo TEXT NOT NULL,
  responsabilidad TEXT NOT NULL,
  firmado BOOLEAN NOT NULL DEFAULT false,
  fecha_firma TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folio_comite ENABLE ROW LEVEL SECURITY;

-- 10. Risks table
CREATE TABLE public.riesgos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id UUID REFERENCES public.folios(id) ON DELETE CASCADE NOT NULL,
  numero_id SERIAL,
  etapa_proceso TEXT NOT NULL DEFAULT '',
  peligro_modo_falla TEXT NOT NULL DEFAULT '',
  causa_potencial TEXT NOT NULL DEFAULT '',
  efecto_dano TEXT NOT NULL DEFAULT '',
  severidad INTEGER NOT NULL DEFAULT 1 CHECK (severidad BETWEEN 1 AND 10),
  ocurrencia INTEGER NOT NULL DEFAULT 1 CHECK (ocurrencia BETWEEN 1 AND 10),
  deteccion INTEGER NOT NULL DEFAULT 1 CHECK (deteccion BETWEEN 1 AND 10),
  npr INTEGER GENERATED ALWAYS AS (severidad * ocurrencia * deteccion) STORED,
  controles_actuales TEXT DEFAULT '',
  requiere_accion BOOLEAN NOT NULL DEFAULT false,
  accion_propuesta TEXT DEFAULT '',
  responsable TEXT DEFAULT '',
  fecha_compromiso DATE,
  accion_implementada TEXT DEFAULT '',
  fecha_evidencia TEXT DEFAULT '',
  sev_residual INTEGER NOT NULL DEFAULT 1 CHECK (sev_residual BETWEEN 1 AND 10),
  ocu_residual INTEGER NOT NULL DEFAULT 1 CHECK (ocu_residual BETWEEN 1 AND 10),
  det_residual INTEGER NOT NULL DEFAULT 1 CHECK (det_residual BETWEEN 1 AND 10),
  npr_residual INTEGER GENERATED ALWAYS AS (sev_residual * ocu_residual * det_residual) STORED,
  dictamen dictamen_tipo NOT NULL DEFAULT 'Pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.riesgos ENABLE ROW LEVEL SECURITY;

-- 11. Audit trail table
CREATE TABLE public.audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tabla TEXT NOT NULL,
  registro_id TEXT NOT NULL,
  accion TEXT NOT NULL,
  valor_anterior JSONB,
  valor_nuevo JSONB,
  ip TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- 12. Folio code sequence table (for GR-YYYY-NNN reset annually)
CREATE TABLE public.folio_sequence (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- Function to generate next folio code
CREATE OR REPLACE FUNCTION public.next_folio_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  next_num INTEGER;
BEGIN
  INSERT INTO public.folio_sequence (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_number = folio_sequence.last_number + 1
  RETURNING last_number INTO next_num;
  
  RETURN 'GR-' || current_year || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$;

-- 13. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    NEW.email
  );
  -- Default role: operador
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'operador');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 14. RLS Policies

-- Profiles: users read own, admins read all
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- User roles: admins manage, users read own
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Folios: authenticated users can read, operador+ can insert, admin can do all
CREATE POLICY "Authenticated read folios" ON public.folios
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Operador insert folios" ON public.folios
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Operador update own folios" ON public.folios
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'comite_tecnico')
  );

CREATE POLICY "Admin delete folios" ON public.folios
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Folio comite: authenticated read, operador+ write
CREATE POLICY "Authenticated read comite" ON public.folio_comite
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert comite" ON public.folio_comite
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Update comite" ON public.folio_comite
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'comite_tecnico')
  );

-- Riesgos: authenticated read, operador+ write
CREATE POLICY "Authenticated read riesgos" ON public.riesgos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert riesgos" ON public.riesgos
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Update riesgos" ON public.riesgos
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'comite_tecnico')
  );

CREATE POLICY "Admin delete riesgos" ON public.riesgos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Audit trail: admins and comite can read, system inserts
CREATE POLICY "Admin read audit" ON public.audit_trail
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'comite_tecnico')
  );

CREATE POLICY "Authenticated insert audit" ON public.audit_trail
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 15. Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_trail (user_id, tabla, registro_id, accion, valor_anterior, valor_nuevo)
    VALUES (auth.uid(), TG_TABLE_NAME, NEW.id::TEXT, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_trail (user_id, tabla, registro_id, accion, valor_nuevo)
    VALUES (auth.uid(), TG_TABLE_NAME, NEW.id::TEXT, 'INSERT', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_trail (user_id, tabla, registro_id, accion, valor_anterior)
    VALUES (auth.uid(), TG_TABLE_NAME, OLD.id::TEXT, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

-- Attach audit triggers
CREATE TRIGGER audit_folios AFTER INSERT OR UPDATE OR DELETE ON public.folios
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_riesgos AFTER INSERT OR UPDATE OR DELETE ON public.riesgos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_folio_comite AFTER INSERT OR UPDATE OR DELETE ON public.folio_comite
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
