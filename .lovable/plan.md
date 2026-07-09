## Objetivo
Renombrar labels de controles y AFAP únicamente cuando el folio es **NOM-059-SSA1-2015**. NOM-241 no se toca.

## Mapeo de cambios (solo NOM-059)

| Ubicación | Actual | Nuevo |
|---|---|---|
| Encabezado bloque azul (Wizard Paso 7) | Reducen la Ocurrencia (O) | Controles que mantienen el CPP en el Design Space |
| Nivel A | Nivel A — Diseño / Ingeniería | Control del Design Space |
| Nivel B | Nivel B — Barreras y validación | Control de Proceso Validado |
| Nivel C | Nivel C — Administrativos | Control Documental y de Capacitación |
| Encabezado bloque naranja | Mejoran la Detectabilidad (D) | Controles analíticos de detección del desvío |
| Sección Detección | (Detección) | Control Analítico de Detección |
| Label AFAP (Wizard + Detail Sheet) | Justificación AFAP / Justificación de aceptabilidad / AFAP | Justificación de proporcionalidad al riesgo — ICH Q9(R1) |

## Cambios de código

### 1. `src/config/wizard-content.ts`
Agregar helper `getEtiquetasControles(norma)` que devuelva `{ tituloAzul, tituloNaranja, nivelA, nivelB, nivelC, deteccion, afapLabel, afapHint }` con dos variantes (NOM-241 mantiene textos actuales, NOM-059 usa los nuevos).

### 2. `src/components/RiesgoWizardDialog.tsx` (Paso 7 — `PanelControles`)
- Línea 1923: encabezado bloque azul → usar `etiquetas.tituloAzul`.
- Líneas 1937, 1966, 1993: títulos de Nivel A/B/C → `etiquetas.nivelA/B/C`.
- Línea 2022: encabezado bloque naranja → `etiquetas.tituloNaranja`.
- Sección detección (~línea 2028): título del bloque de detección → `etiquetas.deteccion`.
- Líneas 1585 y 1588 (paso residual): reemplazar "AFAP" por `etiquetas.afapLabel` cuando la norma sea NOM-059.
- Línea 1494–1495 (ayuda de controles actuales): mantener referencia genérica pero adaptar si aplica al copy nuevo (mención Nivel A/B/C solo para NOM-241).

Propagar `normaKey` a `PanelControles` (ya existe `chips` con norma; añadir prop `etiquetas`).

### 3. `src/components/RiesgoDetailSheet.tsx`
- Línea 164: `label="Justificación de aceptabilidad / AFAP"` → condicional por norma del folio/riesgo (nuevo texto para NOM-059).
Requiere leer la norma; el componente ya recibe `r`. Si no está disponible la norma allí, pasarla como prop desde el padre (`FolioDetail.tsx`).

### 4. `src/lib/generateFolioPDF.ts`
- Línea 820: `"Justificación de Aceptabilidad:"` → usar `etiquetas.afapLabel` (folio.norma_folio disponible).
- Líneas 684/696 (Controles Prevención / Detección en tabla PDF): para NOM-059 renombrar a "Controles que mantienen el CPP en el Design Space:" y "Control Analítico de Detección:".

### 5. Dashboard del folio (listado por nivel)
Confirmar en `FolioDetail.tsx` / `NPRControlTable.tsx` si aparece "Nivel A/B/C" visualmente. Si aparece, sustituir por labels NOM-059 vía helper.

## Fuera de alcance
- Cambios de esquema o migraciones.
- Modificar textos NOM-241.
- Modificar la lógica de cálculo NPR o el flujo de estados.
