# Asegurar coherencia Agente IA ↔ Norma de la empresa

## Cambios

### 1. `supabase/functions/chat-asistente/index.ts`

**a) Selección estricta del agente** (sustituye líneas 490-497):
- `NOM-241` → fuerza `dm`. Si llega `agente_override` distinto, `console.warn` y se descarta.
- `NOM-059` → fuerza `farma`. Mismo manejo de override.
- `MULTI` → respeta `agente_override`; default `dm`.

**b) Conversación nueva ante mismatch de norma** (en el bloque de reanudación, líneas 520-544):
- Si `conv.agente !== agente` calculado, `console.warn` y `conversacion_id = null` para que se cree una conversación fresca. El histórico se conserva en el sidebar pero no se reusa.

**c) Bloque "NORMA APLICABLE FIJA" AL INICIO del system prompt** (línea 587):
```
## NORMA APLICABLE FIJA
Esta organización opera exclusivamente bajo [NOM-241-SSA1-2025 | NOM-059-SSA1-2015] y FEUM.
NUNCA cites, sugieras ni mezcles [la otra norma] salvo que el usuario pregunte
explícitamente por comparación regulatoria.
```
Se calcula según `org.norma_aplicable`. Para `MULTI` el bloque queda vacío (libre).
Orden final: `normaAncla + system_prompt + orgCtx + folioCtx + resumeNote + TOOL_RULES_ADDENDUM`.

### 2. `src/components/AssistantPanel.tsx`

**a)** Confirmar que `agente` solo se envía cuando `org.norma_aplicable === "MULTI"` (línea 241, ya está correcto — añadir comentario).

**b)** Header (línea 426): derivar la etiqueta del agente directamente desde `org.norma_aplicable` para orgs no-MULTI, en lugar de leer del estado local que puede quedar obsoleto.

**c)** Al cambiar `org.norma_aplicable`, resetear `conversacionId` a `null` para forzar conversación nueva (extender el `useEffect` de líneas 74-78).

### 3. Verificación
- Build pasa.
- Deploy de `chat-asistente`.
- Validación con org NOM-059: el saludo del wizard y el chat flotante deben citar NOM-059/FEUM.
- Validación con org NOM-241: no aparece NOM-059.
- Validación con org MULTI: el selector funciona como hoy.

## Fuera de alcance
- No se modifican los prompts DM/Farma en BD (ya están limpios: 0 referencias cruzadas).
- No se borran conversaciones históricas.
- No se altera el cálculo de límites, tools ni persistencia de mensajes.
