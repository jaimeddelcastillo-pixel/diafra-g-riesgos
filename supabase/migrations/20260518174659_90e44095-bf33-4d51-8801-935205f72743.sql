-- Convertir folios.origen de enum origen_riesgo a TEXT para soportar catálogo extendido
ALTER TABLE public.folios
  ALTER COLUMN origen DROP DEFAULT,
  ALTER COLUMN origen TYPE TEXT USING origen::text,
  ALTER COLUMN origen SET DEFAULT 'Diseño y Desarrollo';
