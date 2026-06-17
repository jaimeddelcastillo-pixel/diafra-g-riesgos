
## Objetivo

1. En el **PDF**, cuando un integrante del comité no haya firmado digitalmente, dejar las celdas de **Firma** y **Fecha Firma** completamente vacías (en lugar de "Pendiente" / "—") para permitir firma autógrafa al imprimir.
2. En la **Sección I — Descripción** del folio, añadir un checkbox **N/A** en los campos no obligatorios para marcarlos explícitamente como no aplicables (mostrar "N/A" en la UI y PDF). Los obligatorios no tendrán esa opción.

## Cambios

### 1. PDF — `src/lib/generateFolioPDF.ts` (Sección II, ~líneas 506-518)
- Reemplazar `m.firmado ? "✓ Firmado" : "Pendiente"` → `m.firmado ? "✓ Firmado" : ""`
- Reemplazar `m.fecha_firma ? fmtDate(m.fecha_firma) : "—"` → `m.fecha_firma ? fmtDate(m.fecha_firma) : ""`
- Aumentar `minCellHeight` de la tabla de comité (de 11 → ~16) para dar espacio físico suficiente a la firma autógrafa al imprimir.
- Mantener "—" únicamente cuando no hay comité asignado (fila placeholder).

### 2. Sección I — Descripción (`src/pages/FolioDetail.tsx`, `SeccionDescripcion`)

**Campos obligatorios (sin opción N/A):**
- Proceso / Producto / Equipo / Sistema Analizado
- Origen
- Fecha Inicio y Fecha Cierre
- Alcance
- Versión Doc.

**Campos con checkbox N/A (texto libre):**
- ID Desviación
- Control de Cambios
- Identificación del proceso / dispositivo (`numero_modelo`)
- Lote / Revisión (`numero_lote`)
- Clase del dispositivo / Clasificación (categoría, tipo, condición venta, riesgo sanitario)

**Comportamiento:**
- En modo edición: junto al label aparece un checkbox "N/A". Al marcarlo, el input se deshabilita y el valor guardado es la cadena `"N/A"`. Al desmarcarlo, el campo se vacía y se rehabilita.
- Al cargar el formulario, si el valor existente es `"N/A"` el checkbox aparece marcado automáticamente.
- En modo lectura (UI) y en el **PDF**: si el valor es `"N/A"` se muestra literalmente `N/A` (en lugar del guion `—` que indica vacío).
- Almacenamiento: se guarda en las mismas columnas de texto existentes; no se requiere migración de base de datos.

### 3. PDF — `src/lib/generateFolioPDF.ts` (Sección I)
- Helper local `fmtNA(v)` que devuelve `"N/A"` si el valor es exactamente `"N/A"`, el valor si tiene contenido, o `"—"` si está vacío.
- Aplicar a las celdas de los campos opcionales listados arriba para que el PDF refleje el estado N/A.

## Notas

- No hay cambios de base de datos.
- No se modifica la lógica de validación de obligatorios existente (`alcance`, etc. siguen siendo críticos).
- No se afectan otras secciones del PDF ni el flujo de firma electrónica.
