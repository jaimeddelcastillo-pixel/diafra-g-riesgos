ALTER TABLE public.modulos ADD COLUMN IF NOT EXISTS orden int NOT NULL DEFAULT 100;
ALTER TABLE public.modulos ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'activo';
ALTER TABLE public.modulos ADD CONSTRAINT modulos_estado_check CHECK (estado IN ('activo','proximamente'));
UPDATE public.modulos SET orden = 10, estado = 'activo' WHERE clave = 'riesgos';
UPDATE public.modulos SET orden = 20, estado = 'activo' WHERE clave = 'institutional_brain';