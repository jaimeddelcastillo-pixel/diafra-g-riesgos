# Reordenar Id's de riesgos en folios en Borrador

## El problema real

Durante un análisis es normal detectar un peligro tarde: hoy queda con el último Id y rompe el orden lógico/cronológico de la matriz. Hoy el número (`numero_id`) se asigna por trigger como "máximo + 1" dentro del folio y no se puede mover; al borrar un riesgo además quedan huecos en la numeración.

## Qué se va a construir

1. **Arrastrar y soltar** las filas de la matriz de riesgos (Sección III) para cambiar su orden. Al soltar, los Id se renumeran 01..N de inmediato.
2. **Sin huecos en Borrador**: al eliminar un riesgo de un folio en Borrador, los siguientes se recorren automáticamente (01, 02, 03…).
3. **Congelado fuera de Borrador**: en En Firma, Aprobado, Cerrado o Cancelado los Id quedan fijos; no hay arrastre ni recompactación. La matriz se ve exactamente igual que hoy.
4. **Permisos**: cualquier usuario que ya puede editar riesgos del folio (operador/editor, admin, responsable sanitario) puede reordenar mientras esté en Borrador.
5. **Auditoría**: cada reordenamiento y cada recompactación queda registrado en el Audit Trail con el mapa "Id anterior → Id nuevo", usuario y fecha.
6. **Aviso claro en la interfaz**: nota breve junto a la tabla indicando que los Id se reasignan por posición mientras el folio esté en Borrador y que quedarán fijos al enviarlo a firma.

## Detalles técnicos

- **Base de datos**: nueva función `reordenar_riesgos(p_folio_id uuid, p_orden uuid[])` (security definer) que:
  - valida que el folio pertenece a la organización del usuario y está en `Borrador`;
  - valida que el arreglo contiene exactamente los mismos riesgos del folio (sin faltantes ni ajenos);
  - renumera en dos pasadas (primero a negativos, luego a 1..N) para evitar colisiones;
  - inserta un registro en `audit_trail` con el mapeo completo.
- Segunda función `recompactar_riesgos(p_folio_id uuid)` invocada tras eliminar en Borrador (o trigger `AFTER DELETE` equivalente), con la misma validación de estado.
- Índice único parcial `(folio_id, numero_id)` para garantizar que no existan Id duplicados; se crea después de verificar/limpiar duplicados históricos.
- El trigger actual `set_riesgo_numero_local` se conserva para altas (máximo + 1).
- **Frontend** (`src/pages/FolioDetail.tsx`): manillas de arrastre en la tabla de riesgos usando `@dnd-kit/core` + `@dnd-kit/sortable` (nueva dependencia), sólo cuando `estado === "Borrador"` y el usuario tiene permiso de edición. Actualización optimista de la lista y `invalidateQueries` de `["folio", folioId]` y `["all-riesgos"]` al confirmar.
- La barra "Ir a ID", el detalle, el PDF y el asistente ya leen `numero_id` ordenado, por lo que reflejan el nuevo orden sin cambios adicionales.

## Fuera de alcance

- No se agrega inserción "después del Id X" al crear (el nuevo riesgo entra al final y se arrastra).
- No se cambian firmas, dictámenes ni el formato del código de folio.
