# Fase B — Actualizar `brain-interview` (un solo commit)

Se modifica la edge function existente. No se crea otra función ni se tocan la UI ni otros módulos.

## 1. Contrato de entrada

`POST` con `{ action, session_id, turn_id, content, messages? }`

- `action`: `iniciar | mensaje | pausar | reanudar | cerrar`
- `turn_id`: UUID generado por el frontend (obligatorio en `iniciar`, `mensaje`, `reanudar`, `cerrar`; no requerido en `pausar`)
- `content`: texto del entrevistado (solo en `mensaje`)
- Compatibilidad: si no llega `action`, se asume `mensaje`

`GET /brain-interview/turn/{turn_id}` devuelve el resultado de un turno ya completado (JWT + org validados server-side).

## 2. Validación server-side (todas las acciones)

Orden fijo antes de cualquier trabajo:
1. JWT válido → `user`
2. `org_id` resuelto desde `org_members` (nunca del frontend ni del modelo)
3. Feature `institutional_brain` activa: plan `professional`/`enterprise`, o fila activa y no expirada en `organization_features`, o super admin
3b. Restricción de trial: plan trial → una sola sesión por organización
4. `session_id` debe pertenecer a la org resuelta; si no, 403

## 3. Idempotencia por turno

Al recibir un turno con `turn_id`:
- Turno existente `completado` → se devuelve el resultado guardado (SSE `turn_complete` reconstruido desde `brain_interview_turns`), sin re-ejecutar herramientas
- Turno existente `procesando` → HTTP 409
- No existe → `INSERT` con `estado = procesando` y continúa
- Al finalizar → `UPDATE estado = completado` con métricas (`knowledge_created`, `gaps_created`, `contradictions_created`, `interviewees_suggested`, `current_objective`, `completed_at`)
- Error → `UPDATE estado = error` con el texto del fallo

**Idempotencia por herramienta:** las herramientas que persisten (`guardar_conocimiento`, `registrar_brecha`, `registrar_contradiccion`, `sugerir_entrevistado`) se envuelven en un helper que calcula `clave = tool_name + ":" + sha256(canonical(payload))`, con canonicalización = `JSON.stringify` con claves ordenadas alfabéticamente de forma recursiva. Si la clave ya está en `brain_interview_turns.operations`, se devuelve el resultado previamente guardado sin insertar; si no, se ejecuta y se persiste `{ clave: resultado }` en `operations`.

## 4. Eventos SSE tipados

Se emiten con `event:` + `data:` según lo especificado:
- `message_delta` → `{ turn_id, delta }`
- `tool_status` → `{ status: "procesando" }` (sin revelar nombre de herramienta ni internals)
- `turn_complete` → `{ session_id, turn_id, knowledge_created, gaps_created, contradictions_created, interviewees_suggested, current_objective, session_status }`
- `error` → `{ turn_id, code: "pre_persist" | "post_persist" | "connection", message, retryable }`
  - fallo antes de escribir en BD → `pre_persist` (retryable: true)
  - fallo después de persistir conocimiento → `post_persist` (retryable: false; el frontend recupera vía GET del turno)
  - fallo de red/API del modelo → `connection` (retryable: true)

## 5. Acciones

- **iniciar**: valida, `UPDATE sesión estado = en_proceso` (+ `iniciada_en`), llama `obtener_contexto_cerebro`, el Prompt Maestro genera el mensaje inicial (no hardcodeado), se inserta en `brain_interview_messages` (`role: assistant`) y se transmite por SSE.
- **mensaje**: inserta el mensaje del usuario en `brain_interview_messages`, corre el bucle agéntico actual (hasta 6 herramientas/turno) y persiste la respuesta del asistente.
- **pausar**: `UPDATE estado = pausada` y confirmación por SSE (`turn_complete` con `session_status: pausada`).
- **reanudar**: lee las últimas `SESSION_TRANSCRIPT_WINDOW = 5` interacciones de `brain_interview_messages`, llama `obtener_contexto_cerebro`, pone `estado = en_proceso` e inyecta al Prompt Maestro el bloque `[SESIÓN REANUDADA]` + `[CONOCIMIENTO PREVIO]` + `[GAPS ACTIVOS PARA ESTE ENTREVISTADO]` + `[ÚLTIMA INTERACCIÓN]`. El modelo decide cómo retomar.
- **cerrar**: calcula métricas finales de la sesión (conteos por tipo de conocimiento, brechas, contradicciones, sugerencias), `UPDATE estado = completada` y `metadata = { cierre: {...} }`, el agente redacta el mensaje de cierre, se guarda en `brain_interview_messages` y se devuelve el resumen estructurado en `turn_complete`.

## 6. Detalles técnicos

- Constante `SESSION_TRANSCRIPT_WINDOW = 5` en el encabezado de la función, junto a `MAX_HISTORY` y `MAX_TOOL_CALLS_PER_TURN`.
- El historial del modelo se reconstruye desde `brain_interview_messages` (server-side), no desde lo que envíe el frontend.
- `org_id` y `session_id` siempre se pasan a las herramientas desde el servidor.
- Se conservan las 6 herramientas y su lógica actual; solo se añade la capa de idempotencia y el conteo de métricas por turno.
- Archivo tocado: `supabase/functions/brain-interview/index.ts` (+ despliegue).
