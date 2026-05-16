# Plan — Análisis de Causa Raíz (Ishikawa 6M + 5 Porqués)

## Objetivo
Agregar dos herramientas opcionales de análisis de causa raíz, disponibles desde cualquier ID de riesgo en folio Borrador, con asistencia del agente IA y que escriben de vuelta a `causa_potencial` y `justificacion_aceptabilidad` del riesgo.

## Alcance
- **Sí:** UI del Sheet con pestañas, lógica de chips/cadena, llamadas al agente IA para proponer y validar, integración con campos existentes de `riesgos`, audit trail.
- **No (fuera de scope):** cambios de esquema (todo entra en columnas ya existentes), comité, firmas, PDF, sugerencia automática desde el chat libre del agente (eso vive en el system prompt del backend — fuera de este sprint).

## Activación
Botón secundario **🔍 Analizar causa raíz** visible solo cuando el folio padre está en estado `Borrador`:
1. En **RiesgoWizardDialog** dentro del Paso 1 (al lado del campo "Causas") y Paso 4 (cuando NPR residual ≥ umbral medio, como sugerencia destacada).
2. En **RiesgoFormDialog** (edición de IDs existentes) en la sección de causas.

Abre `CausaRaizSheet` (Sheet lateral, `max-w-2xl`) sin cerrar el dialog padre.

## Archivos

### Nuevos
1. `src/components/causa-raiz/CausaRaizSheet.tsx` — contenedor con shadcn `Tabs` (Ishikawa | 5 Porqués), estado compartido, callback `onApply(payload)`.
2. `src/components/causa-raiz/IshikawaPanel.tsx` — 6 cards (Accordion), inputs por categoría, chips con badge "IA" para sugerencias, selector de "causa principal", botón Continuar.
3. `src/components/causa-raiz/IshikawaDiagram.tsx` — SVG inline (sin librería): espina horizontal con peligro a la derecha, 6 ramas etiquetadas, sub-ramas dinámicas por causa. Color `--primary` cuando llena, `muted` cuando vacía.
4. `src/components/causa-raiz/CincoPorquesPanel.tsx` — timeline vertical de 1 a 5 niveles, input por nivel, botón "✨ ¿Es suficientemente profundo?", indicador ✅/⚠️ por nivel, resumen final y botón "Aplicar al ID".
5. `src/components/causa-raiz/useCausaRaizAI.ts` — hook que envuelve `fetch` a `chat-asistente` (no-streaming wrapper) para 2 prompts: `proponerIshikawa(peligro, proceso, norma)` y `evaluarPorque(cadena, norma)`. Devuelve JSON parseado con manejo de errores y toasts.

### Modificar
- `src/components/RiesgoWizardDialog.tsx` — botón en Paso 1 (junto a "Causas") y banner en Paso 4 (cuando `nprRes ≥ umbralNPRMedio`). Al aplicar, mergear resultado al estado del wizard antes de guardar.
- `src/components/RiesgoFormDialog.tsx` — botón en sección de causas. Al aplicar, hacer `UPDATE` directo sobre `riesgos` + audit trail.
- `src/config/wizard-content.ts` — agregar `getEjemplos6M(norma)` con 6 listas (Mano de obra, Máquina, Método, Material, Medio ambiente, Medición) indexadas por NOM-241/NOM-059.
- `supabase/functions/chat-asistente/index.ts` — agregar 2 herramientas internas opcionales (`proponer_ishikawa`, `evaluar_porque`) o, más simple, manejar los prompts vía system prompt extendido. **Decisión: manejar como prompts especiales sin tools nuevas** — el hook pasa un mensaje estructurado y el modelo responde JSON.

### Sin cambios
- Tabla `riesgos`: usa `causa_potencial` (texto multilinea) y `justificacion_aceptabilidad` (texto). Sin migración.
- Tabla `audit_trail`: insert con `accion='causa_raiz_ishikawa'` o `'causa_raiz_5porques'`, `valor_nuevo` = snapshot del análisis.

## Lógica por componente

### IshikawaPanel
- Estado: `Record<Categoria6M, Array<{ texto: string; origenIA: boolean; principal: boolean }>>`.
- Por card: input + botón "+ Agregar", chips con X para eliminar y checkbox circular para marcar principal.
- "✨ Proponer causas con IA": llama `proponerIshikawa({ peligro, proceso, norma })`, recibe `{ mano_obra: string[], maquina: string[], ... }`, prefilla chips con `origenIA: true` que el usuario acepta (X) o conserva.
- Validación: ≥1 causa principal seleccionada habilita "Continuar a 5 Porqués →".
- Debajo: `<IshikawaDiagram peligro={...} causas={...} />`.

### IshikawaDiagram (SVG)
- Viewbox 800x300, espina centrada, 6 ramas (3 arriba / 3 abajo) en ángulos fijos.
- Por cada causa, una sub-rama corta con texto truncado a 20 chars + tooltip nativo `<title>`.
- Sin librerías externas.

### CincoPorquesPanel
- Estado: `{ causaInicial: string, niveles: Array<{ respuesta: string, evaluacion?: 'raiz'|'superficial'|null }> }`.
- Nivel 1 pregunta "¿Por qué {causaInicial}?", siguientes "¿Por qué {respuestaNivelAnterior}?".
- Mínimo 3, máximo 5. Botón "+ Agregar porqué" hasta nivel 5.
- "✨ ¿Es suficientemente profundo?" por nivel: llama `evaluarPorque({ cadena, norma })` → marca ✅/⚠️ y muestra texto del modelo.
- Resumen final tipo flecha: `Causa → Por qué 1 → ... → CAUSA RAÍZ` (último nivel con respuesta).
- Botón "✅ Aplicar al ID" — dispara `onApply`.

### Payload de aplicación (`onApply`)
```ts
{
  causaRaiz: string,                    // del último porqué o causa principal Ishikawa
  causasSecundarias: string[],          // todas las causas Ishikawa (no principales)
  resumen6M: Record<Categoria, string[]>, // para justificacion_aceptabilidad
  origen: 'ishikawa' | '5porques' | 'ambos',
  cadenaPorques?: string[],
}
```

### Mapeo a campos del riesgo
- `causa_potencial`:  
  ```
  {causas_existentes}
  
  [CAUSA RAÍZ — {origen}] {causaRaiz}
  {causasSecundarias numeradas}
  ```
- `justificacion_aceptabilidad`: append `\n\n[Análisis 6M]\n• Mano de obra: ...\n• Máquina: ...\n...` solo categorías con contenido.
- Wizard: mergea al estado en memoria, persiste con el INSERT final.
- FormDialog: `UPDATE` directo + audit insert.
- Badge verde "✅ Análisis de causa raíz completado" en la tarjeta del ID, con tooltip mostrando resumen.

## Llamadas al agente IA

Reutiliza endpoint `chat-asistente` con mensajes estructurados (sin tools nuevas):

**Prompt Ishikawa:**
> "Como experto en {norma}, analiza el peligro '{peligro}' en el proceso '{proceso}'. Devuelve SOLO JSON válido con 6 listas de 2-4 causas potenciales: `{mano_obra, maquina, metodo, material, medio_ambiente, medicion}`."

**Prompt 5 Porqués:**
> "Evalúa si esta cadena de porqués llega a causa raíz según {norma}. Cadena: {causa} → {p1} → {p2} → ... Devuelve JSON: `{esCausaRaiz: boolean, justificacion: string, sugerencia: string|null}`."

El hook hace `JSON.parse` con fallback a texto si falla. Stream se consume completo antes de parsear (no streaming UI para estas llamadas — toasts de "Pensando…").

## Adaptación por norma
- `getEjemplos6M(folio.norma_folio)` desde `wizard-content.ts`.
- Para `MULTI`: heredar el `modoWizard` ya seleccionado en el wizard; en `RiesgoFormDialog`, usar el `clasificacion_categoria` del folio o un mini-selector al abrir el Sheet.

## Diseño
- Tokens existentes: `primary` (Navy), `accent` (Cobalt/Teal), `muted` para estados vacíos. Badge IA usa `bg-accent/15 text-accent`.
- shadcn: `Sheet`, `Tabs`, `Accordion`, `Badge`, `Button`, `Input`, `Textarea`, `Checkbox`.
- Sheet `side="right"` con `className="max-w-2xl w-full sm:w-[90vw]"`.
- Responsive: cards apiladas en móvil, diagrama SVG con `width="100%"` y `preserveAspectRatio`.

## Trazabilidad
- Audit insert con `tabla='riesgos'`, `registro_id={riesgo.id || 'pendiente:wizard'}`, `accion` específica, `valor_nuevo` = payload completo del análisis.

## Orden de implementación
1. `wizard-content.ts` — `getEjemplos6M` + tipos de categorías.
2. `useCausaRaizAI.ts` — wrapper de llamadas al edge function + parseo JSON.
3. `IshikawaDiagram.tsx` — SVG con props.
4. `IshikawaPanel.tsx` — 6M + chips + IA + selector principal.
5. `CincoPorquesPanel.tsx` — timeline + evaluación IA.
6. `CausaRaizSheet.tsx` — Tabs + onApply.
7. Integración en `RiesgoWizardDialog.tsx` (Paso 1 + banner Paso 4).
8. Integración en `RiesgoFormDialog.tsx` con UPDATE + audit + badge.
9. QA móvil/tablet/desktop.

## Riesgos / consideraciones
- Los archivos `src/components/wizard/steps/Step1Peligro.tsx` y `Step4Controles.tsx` **no existen** (el wizard vive en un único `RiesgoWizardDialog.tsx`). El plan integra ahí en lugar de crear esos archivos.
- El campo `causa_potencial` es texto plano: el formato propuesto preserva legibilidad pero no es estructurado. Migrar a JSONB queda fuera de scope.
- La sugerencia automática del agente en el chat libre requiere editar el system prompt del edge function — se incluye una línea breve, pero el flujo de "abrir el Sheet desde el chat" se entrega como evento custom (`tracea:abrir-causa-raiz`) que el dialog escucha, sin reabrir el wizard.

¿Apruebo y arranco con el paso 1?
