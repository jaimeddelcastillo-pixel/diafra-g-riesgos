## Fix

En `src/components/AssistantPanel.tsx` (línea 254) el mensaje de bienvenida está hardcoded:

> "Pregúntame sobre AMEF, ICH-Q9, normativas o adjunta un documento."

ICH-Q9 solo aplica a Farma (NOM-059). Para DM (NOM-241) la norma correcta es ISO 14971.

## Cambio

Hacerlo dependiente de la variable `agente` que ya existe en el componente:

- **Agent DM** → "Pregúntame sobre AMEF, ISO 14971, normativas o adjunta un documento."
- **Agent Farma** → "Pregúntame sobre ICH-Q9, normativas o adjunta un documento."

Único archivo tocado: `src/components/AssistantPanel.tsx` (1 línea). Sin cambios de BD, edge functions ni system prompts.