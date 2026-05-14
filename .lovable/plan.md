## Objetivo

Hacer que el campo "Clasificación" del folio se adapte a la norma de la organización (NOM-241, NOM-059 o MULTI), agregando los subcampos de medicamentos sin romper los folios existentes de dispositivos médicos.

## 1. Base de datos (migración)

Agregar a `public.folios`:

- `clasificacion_tipo TEXT NOT NULL DEFAULT ''` — tipo de medicamento (Alopático, Biológico, Genérico, OTC, Homeopático, Herbolario) **o** vacío en DM (en DM se sigue usando `clase_dispositivo`).
- `clasificacion_condicion_venta TEXT NOT NULL DEFAULT ''` — solo medicamentos.
- `clasificacion_riesgo_sanitario TEXT NOT NULL DEFAULT ''` — solo medicamentos (Alto / Moderado / Bajo).
- `clasificacion_categoria TEXT NOT NULL DEFAULT ''` — solo MULTI: `dispositivo` | `medicamento` (define qué bloque mostrar).

`clase_dispositivo` se conserva intacto. No se borra nada. Sin nuevos triggers; el `audit_trigger_func` ya cubre los cambios.

No se requieren cambios en RLS (heredan de `folios`).

## 2. Configuración (frontend)

En `src/config/normas.ts` agregar catálogos centralizados para reusar en form, PDF y AI:

```text
CLASIFICACION_DM = [Clase I, Clase II, Clase III]
CLASIFICACION_MED_TIPO = [Alopático, Biológico/biotecnológico, Genérico intercambiable, OTC, Homeopático, Herbolario]
CLASIFICACION_MED_VENTA = [Prescripción obligatoria, Sin receta (OTC), Sin receta con leyenda preventiva]
CLASIFICACION_MED_RIESGO = [Alto, Moderado, Bajo]
```

Helper `getClasificacionMode(norma, categoriaMulti)` → `"dm" | "med"`.

## 3. UI — formulario de folio

Archivo: `src/components/RiesgoFormDialog.tsx` y/o el form de folio (Sección I en `FolioDetail.tsx`).

Lógica condicional según `folio.norma_folio`:

- **NOM-241** → render actual: select `clase_dispositivo` + tooltip NOM-241/COFEPRIS.
- **NOM-059** → 3 selects: Tipo, Condición de venta, Nivel de riesgo + tooltip NOM-059.
- **MULTI** → primer radio "¿Dispositivo médico o medicamento?" persistido en `clasificacion_categoria`; según valor renderiza el bloque DM o MED.

Validación: campos requeridos solo para el bloque visible. PDF (`generateFolioPDF.ts`) imprime los que correspondan.

## 4. Agente IA

`supabase/functions/chat-asistente/index.ts`:

- Tool `consultar_config_org` ya devuelve la norma; añadir flag `clasificacion_categoria` del folio cuando exista.
- Tool `actualizar_folio` permite además: `clasificacion_tipo`, `clasificacion_condicion_venta`, `clasificacion_riesgo_sanitario`, `clasificacion_categoria`.
- En el contexto inicial del system prompt (TOOL_RULES_ADDENDUM) inyectar la clasificación del folio activo.
- Regla nueva: si `clasificacion_tipo ∈ {Biológico, Alopático+inyectable}` o `clasificacion_riesgo_sanitario = "Alto"` y la propuesta tiene `severidad ≥ 9`, el agente debe (a) advertir riesgo en población vulnerable y (b) sugerir `severidad + 1` (tope 10) en `proponer_riesgo`, dejando justificación.

`chat-insertar-riesgo` no cambia (los campos viven en `folios`, no en `riesgos`).

## 5. AssistantPanel

Mostrar badge de clasificación (Clase II / Biológico-Rx-Alto, etc.) en el header del chat cuando hay folio vinculado, leyendo los nuevos campos.

## 6. Compatibilidad

- Folios existentes: `clase_dispositivo` sigue funcionando. Los nuevos campos arrancan en `''`.
- Orgs NOM-241 ya creadas: cero impacto visual.
- Orgs NOM-059: el form viejo seguía pidiendo `clase_dispositivo` (ignorable); ahora pide los 3 subcampos correctos.

## Archivos a tocar

- Migración SQL nueva (4 columnas en `folios`).
- `src/config/normas.ts` — catálogos + helper.
- `src/components/RiesgoFormDialog.tsx` (si aplica) y el form de Sección I del folio.
- `src/pages/FolioDetail.tsx` — render de los campos en lectura.
- `src/lib/generateFolioPDF.ts` — imprimir clasificación correcta.
- `supabase/functions/chat-asistente/index.ts` — tools + reglas.
- `src/components/AssistantPanel.tsx` — badge de clasificación.

## Orden sugerido

1. Migración (apruebas).
2. `normas.ts` + form + PDF.
3. Edge function + AssistantPanel.

¿Apruebo y arranco con la migración?
