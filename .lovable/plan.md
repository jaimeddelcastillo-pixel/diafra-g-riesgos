# Que el asistente IA llene los campos multi-paso separados

## Problema (confirmado en el código)

La plataforma guarda los campos multi-elemento como **líneas numeradas** en una sola columna de texto:

```text
1. Primer paso
2. Segundo paso
3. Tercer paso
```

El Wizard los vuelve a separar con `parseListaNumerada()` (divide por salto de línea). Aplica a:

- `secuencia_eventos` → "Pasos de la secuencia" (Paso 3 del wizard, 2–8 renglones)
- `causa_potencial` → lista de causas
- `controles_prevencion` → líneas con prefijo `[A]` / `[B]` / `[C]`
- `controles_deteccion` → lista de controles

El asistente IA (`proponer_riesgo` → `chat-insertar-riesgo`) envía estos campos como **un solo párrafo** (por ejemplo "El operador toma la pala, luego la introduce…, después…"). Como no hay saltos de línea, `parseListaNumerada` devuelve **un solo elemento** y todo el contenido queda dentro del **Paso 1**, aunque el texto describa 5 pasos.

## Solución

### 1. El asistente entrega listas, no párrafos

En `chat-asistente` (definición de la herramienta `proponer_riesgo`):

- Cambiar `secuencia_eventos`, `causa_potencial`, `controles_deteccion` a **arreglos de strings** (`type: "array"`, items string), con descripción explícita: "un elemento por paso, sin numerar el texto".
- `controles_prevencion` pasa a arreglo de objetos `{ nivel: "A"|"B"|"C", texto }` para respetar el formato `[A] …`.
- Reglas en el prompt: la secuencia debe tener **mínimo 3 y máximo 8** pasos, cada uno una acción concreta; nunca concatenar pasos en un solo texto ni usar "1.", "-", ";" dentro de un elemento.
- Compatibilidad: si el modelo aun así manda un string, se acepta y se normaliza (ver punto 2).

### 2. Normalización robusta en el servidor

Nuevo helper compartido usado por `chat-insertar-riesgo` (y por el render de la tarjeta):

- Si el valor es arreglo → se numera `1. … 2. …`.
- Si es string → se intenta dividir en este orden: saltos de línea existentes, viñetas/numeración inline (`1)`, `1.`, `-`, `•`), separadores de secuencia (` → `, ` -> `, `;`), y como último recurso se deja como un solo elemento.
- Se limpian numeraciones duplicadas y elementos vacíos, y se re-numera de forma consecutiva antes de guardar.
- Para `controles_prevencion` se conserva/infiere el prefijo `[A]/[B]/[C]`.

Con esto, cualquier propuesta del asistente entra al folio ya separada y el Wizard la muestra en sus pasos reales (Paso 1, 2, 3…).

### 3. Vista previa en el chat

En la tarjeta "Riesgo sugerido" del panel del asistente, mostrar la secuencia, causas y controles como **lista numerada** (igual que quedarán guardados), para que el usuario vea antes de insertar cuántos pasos se van a crear.

### 4. Mismo criterio en el asesor del Wizard

`WizardAsistente` (`::APLICAR ...::`) aplica hoy el valor tal cual al campo. Para `secuencia`/causas/controles se aplicará la misma normalización, de modo que un valor sugerido con varios pasos llene varios renglones en lugar de uno.

## Alcance

- Sin migraciones de base de datos (el formato de almacenamiento no cambia).
- Riesgos ya guardados en un solo bloque no se tocan automáticamente; se pueden corregir editando el riesgo en el Wizard.

## Archivos afectados

- `supabase/functions/chat-asistente/index.ts` (esquema de `proponer_riesgo` + reglas del prompt)
- `supabase/functions/chat-insertar-riesgo/index.ts` (normalización antes de insertar)
- `src/components/AssistantPanel.tsx` (vista previa numerada)
- `src/components/wizard/WizardAsistente.tsx` (aplicar valores multi-paso)
