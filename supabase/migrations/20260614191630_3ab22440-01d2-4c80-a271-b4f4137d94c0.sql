
-- 1. Add 'Cancelado' to estado_folio enum
ALTER TYPE public.estado_folio ADD VALUE IF NOT EXISTS 'Cancelado';
