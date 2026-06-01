
-- Eliminar el folio vacío 001 y renombrar 002 -> 001
DELETE FROM public.folios WHERE id = '8efeee41-1936-4e35-b518-ef36c47078e7';
UPDATE public.folios SET codigo = 'GR-SGC-2026-001' WHERE id = 'fa03f1d2-32da-4291-9873-eb5ff80b5d24';
-- Resetear secuencia para que el próximo sea 002
UPDATE public.folio_sequence
   SET last_number = 1
 WHERE org_id = '2d2b48ee-1910-469d-ac2b-5ad20f53a84b'
   AND year = 2026
   AND tipo = 'SGC';
