## Objetivo
Reemplazar el campo libre "Secuencia de Eventos" del diálogo de Riesgo por un editor de **pasos numerados** (1, 2, 3…) generado por la app, no por el usuario. Así toda la organización captura la secuencia con el mismo formato y se elimina el problema de espacios/saltos manuales que rompían el wrap del PDF.

## Alcance
- Solo cambia el **input** y la forma en que se renderiza la secuencia.
- **No** se modifica la base de datos: seguimos guardando un único `text` en `riesgos.secuencia_eventos`, pero con un formato canónico `"1. paso\n2. paso\n3. paso"`. Esto garantiza retro-compatibilidad con folios existentes y con el PDF/visualización actual.

## UX en RiesgoFormDialog
Donde hoy hay un Textarea, mostrar una lista editable:

```text
Secuencia de Eventos
┌──────────────────────────────────────────────┐
│ 1. [ Error en la pesada de materias primas ] [×] │
│ 2. [ Almacenamiento fuera de rango        ] [×] │
│ 3. [ Producto liberado al mercado         ] [×] │
└──────────────────────────────────────────────┘
[ + Agregar paso ]
```

Comportamiento:
- Numeración automática 1..N, recalculada al agregar/eliminar.
- Botón "Agregar paso" añade una fila vacía al final.
- Cada fila tiene Input + botón eliminar (deshabilitado si solo queda 1 paso vacío).
- Enter dentro de un paso crea el siguiente paso.
- Botones opcionales ↑ ↓ para reordenar (mejora rápida, baja prioridad).
- Al guardar el riesgo se serializa a `"1. ...\n2. ...\n3. ..."` (pasos vacíos se descartan).
- Al editar un riesgo existente, se parsea el texto buscando líneas que empiecen con `\d+\.` o `\d+\)`; si no hay coincidencia, cada salto de línea se trata como un paso.

## Visualización (sin cambios funcionales)
- `FolioDetail.tsx` ya muestra `secuencia_eventos` con `whitespace-pre-line`: se verá como lista numerada porque el texto ya viene con `1.\n2.\n…`.
- `generateFolioPDF.ts` ya normaliza espacios → seguirá renderizando bien y sin caracteres extraños.

## Archivos a tocar
1. `src/components/RiesgoFormDialog.tsx`
   - Helpers `parseSteps(text)` y `serializeSteps(steps)`.
   - Nuevo bloque JSX que reemplaza el Textarea de Secuencia de Eventos.
   - Estado local `steps: string[]` sincronizado con `form.secuencia_eventos` al abrir/guardar.

## Lo que NO hacemos
- No migración de BD, no nuevas columnas.
- No tocar PDF ni FolioDetail.
- No backfill de folios viejos (su texto se sigue mostrando tal cual).

## Pregunta abierta
¿Quieres también los botones de **reordenar (↑ ↓)**, o solo agregar/eliminar en esta primera versión?