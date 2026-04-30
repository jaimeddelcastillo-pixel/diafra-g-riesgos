-- E2E NOM-059: completar campos faltantes del folio GR-2026-003 (org NOM-059) para validar checklist
UPDATE public.folios
SET numero_modelo = 'PCT-500-CMP',
    numero_lote = 'L26-001',
    clase_dispositivo = 'Medicamento OTC - Forma sólida'
WHERE id = '60535ff3-c342-45e7-9b5f-b7178d390c22';

UPDATE public.riesgos
SET responsable = 'Director Técnico de Producción',
    fecha_compromiso = '2026-06-30',
    accion_implementada = 'Validación de tiempo de mezcla a 15 min ± 1 min con muestreo PAT en 3 puntos del mezclador.',
    verificado_por = 'QA Manager',
    fecha_verificacion = '2026-05-15',
    resultado_verificacion = 'CV de uniformidad < 5% en 3 lotes consecutivos. Conforme.'
WHERE folio_id = '60535ff3-c342-45e7-9b5f-b7178d390c22'
  AND numero_id = 1;