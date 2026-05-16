# Plan — Wizard de creación de IDs de Riesgo

## Objetivo
Reemplazar el formulario técnico vacío que abre el botón "Agregar ID" dentro de un Folio en estado **Borrador** por un wizard guiado de 5 pasos en lenguaje accesible, optimizado para tablet/móvil de planta, que llena los mismos campos de `riesgos` ya existentes — adaptándose automáticamente a la norma del folio (NOM-241, NOM-059, MULTI).

## Alcance
- **Sí:** UI del wizard, validaciones, lógica de adaptación por norma, NPR en tiempo real, persistencia en `riesgos` con `origen='wizard'`, integración con AssistantPanel.
- **No (fuera de scope):** cambios de esquema, comité, firmas, dictamen, PDF, agente IA backend.

## Activación
- En `FolioDetail.tsx`, cuando `folio.estado === 'Borrador'`, el botón **Agregar ID** abre `<RiesgoWizardDialog>` en lugar de `<RiesgoFormDialog>`.
- Se mantiene `RiesgoFormDialog` para **editar** IDs existentes (modo avanzado / técnico). El wizard es solo para crear.
- Layout: `Dialog` shadcn a pantalla completa en móvil (`h-[100dvh]`), `max-w-4xl` en desktop.

## Archivos a crear / tocar

### Nuevos
1. `src/components/wizard/RiesgoWizardDialog.tsx` — contenedor del wizard (estado global, navegación, persistencia).
2. `src/components/wizard/WizardProgress.tsx` — barra de progreso "Paso X de 5" + indicadores clickeables (solo retroceso).
3. `src/components/wizard/steps/Step1Peligro.tsx`
4. `src/components/wizard/steps/Step2Secuencia.tsx`
5. `src/components/wizard/steps/Step3Evaluacion.tsx` — sliders + panel NPR.
6. `src/components/wizard/steps/Step4Controles.tsx` — controles + recálculo residual + acción correctiva condicional.
7. `src/components/wizard/steps/Step5Revision.tsx` — preview tabla regulatoria + 3 botones acción.
8. `src/components/wizard/NPRPanel.tsx` — semáforo grande reutilizable con animación.
9. `src/components/wizard/CausaList.tsx` — input + botón "+ Agregar" reutilizable (causas, pasos, controles).
10. `src/config/wizard-content.ts` — **catálogos adaptativos por norma**: ejemplos de peligros (chips), descripciones de S/O/D en tiempo real, ayudas de secuencia, placeholders, fundamento normativo. Una sola fuente de verdad consumida por todos los pasos.

### Modificar
- `src/pages/FolioDetail.tsx` — montar `<RiesgoWizardDialog>` para "Agregar"; mantener `<RiesgoFormDialog>` para "Editar".
- `src/config/normas.ts` — agregar helper `getEjemplosPeligros(norma)`, `getDescripcionSeveridad(norma, valor)`, `getDescripcionOcurrencia(valor)`, `getDescripcionDetectabilidad(valor)`, `getEjemplosPasosSecuencia(norma)`, `getFundamentoNormativo(norma)`. Reutiliza catálogos ya existentes donde aplica.

### Sin cambios
- Tabla `riesgos`: ya tiene todos los campos (`peligro`, `etapa_proceso`, `peligro_modo_falla`, `causa_potencial`, `secuencia_eventos`, `situacion_peligrosa`, `efecto_dano`, `severidad/ocurrencia/deteccion`, `controles_prevencion`, `controles_deteccion`, `sev_residual/ocu_residual/det_residual`, `accion_propuesta`, `responsable`, `fecha_compromiso`). Multi-valor (causas, pasos, controles) se serializa como lista numerada en el texto: `"1. ...\n2. ..."`.
- No se agrega columna `origen` a riesgos (no existe). Para trazabilidad: registrar en `audit_trail` con `accion='wizard_create'`.

## Lógica por paso

### Paso 1 — Peligro
- Campos: `peligro` (string), `etapa_proceso` (select desde `folio.proceso_equipo` parseado por líneas + "Otra etapa" → input libre), `peligro_modo_falla`, `causa_potencial` (array → join "; ").
- Chips de ejemplos clickeables que rellenan `peligro` según norma del folio.
- Validación: los 4 obligatorios, mínimo 1 causa.

### Paso 2 — Secuencia
- `secuencia_eventos` (array 2–8 pasos), `situacion_peligrosa`, `efecto_dano`.
- Chips sugeridos para pasos según norma.
- Ayudas y placeholders adaptados (NOM-241 vs NOM-059).

### Paso 3 — Evaluación
- 3 sliders shadcn `<Slider>` con `thumb` agrandado (custom CSS `[&_[role=slider]]:h-7 [&_[role=slider]]:w-7`) para tablet.
- Si `folio.detectabilidad_aplicable === false` → ocultar slider D, NPR = S×O.
- Panel NPR central: número grande + semáforo con color token (`bg-npr-critical/high/low`) + transición `transition-colors duration-300`.
- Badge ⚠️ "Severidad Crítica" cuando S ≥ `umbralSeveridadCritica` de la norma.
- **NOM-059 únicamente:** si S ∈ {8,9,10}, mostrar `<RadioGroup>` población vulnerable. Si elige vulnerable y S<10, sugerencia visual "S+1 recomendado" con botón "Aplicar sugerencia" (no autoaplica). Justificación se guarda en `justificacion_aceptabilidad`.

### Paso 4 — Controles
- `controles_prevencion` y `controles_deteccion` (arrays → join "; ").
- Tras llenar, aparecen mini-sliders residuales con valores iniciales = sliders del paso 3.
- NPR residual en vivo.
- **Si NPR residual ≥ `umbralNPRMedio`:** `requiere_accion=true` y se exigen `accion_propuesta`, `responsable`, `fecha_compromiso`.

### Paso 5 — Revisión
- Tabla regulatoria con todos los campos + NPR inicial/residual + % reducción + fundamento normativo según norma.
- Botones:
  - **Guardar ID** → `supabase.from('riesgos').insert(...)` + audit + cerrar.
  - **Guardar y agregar otro** → mismo insert + reset estado a Paso 1.
  - **Guardar y continuar con Asistente IA** → insert + cerrar wizard + abrir `AssistantPanel` con `folio_id` precargado (usar evento custom o prop callback).

## Adaptación por norma
- Detección: `getNormaConfig(folio.norma_folio)`.
- Para folios con `norma_folio='MULTI'`: al abrir el wizard, **modal previo de 1 pregunta** "¿Dispositivo médico o medicamento?" que setea un estado interno `modoWizard` y selecciona los catálogos correspondientes.
- Todo el contenido textual vive en `wizard-content.ts` indexado por `'NOM-241' | 'NOM-059'`.

## Diseño
- Tokens: `primary` (Navy/Cobalt ya en design system). Nada de colores hardcoded.
- Header: `<WizardProgress>` sticky.
- Footer: botones **Anterior** / **Siguiente** (`Guardar` en paso 5). Disabled hasta validación.
- Sliders: thumb 28×28 px, track gruesa, descripción dinámica debajo en `text-sm text-muted-foreground`.
- Tooltips ❓ vía `<Tooltip>` shadcn en labels técnicos.
- Responsive: `grid-cols-1 md:grid-cols-2` donde aplica; sliders full-width siempre.
- Animaciones: `transition-all duration-300` en cambios de semáforo y avance de paso.

## Validación
- Hook `useWizardState` interno con `errors` por paso, función `canAdvance(step)`.
- No permitir click en "Siguiente" sin validar; mostrar errores inline con `text-destructive`.

## Persistencia
- Un solo INSERT al final (paso 5). Mientras tanto, estado en memoria.
- Opcional v2: borrador local en `sessionStorage` por folio (no en este plan).

## Trazabilidad
- `audit_trail` insert con `tabla='riesgos'`, `accion='wizard_create'`, `valor_nuevo` = snapshot completo.

## Orden de implementación
1. `wizard-content.ts` + helpers en `normas.ts`.
2. `RiesgoWizardDialog` + `WizardProgress` + esqueleto de pasos.
3. Paso 1 y Paso 2 (formularios sencillos + chips).
4. Paso 3 (sliders + NPR panel + lógica S≥9 + población vulnerable).
5. Paso 4 (controles + residual + acción correctiva).
6. Paso 5 (preview + 3 acciones + insert + audit).
7. Wire-up en `FolioDetail.tsx` + selector MULTI inicial.
8. QA responsive (móvil 375, tablet 768, desktop).

## Riesgos / consideraciones
- Multi-valor serializado como texto unido con "; " — compatible con `RiesgoFormDialog` y PDF existentes (que ya tratan los campos como string).
- Si más adelante se quiere estructura `jsonb`, requeriría migración separada — fuera de scope.
- El selector MULTI no persiste en BD (sólo controla UI del wizard); la categoría real del folio ya vive en `clasificacion_categoria`.

¿Apruebo y arranco con el paso 1 del orden de implementación?