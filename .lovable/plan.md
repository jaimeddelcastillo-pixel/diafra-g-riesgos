## Objetivo
Dotar al Asistente IA de historial persistente: el usuario podrá ver, reanudar y continuar conversaciones previas, agrupadas por folio y fecha, con contexto inyectado a Claude al reanudar.

---

## 1. Cambios en base de datos (migración)

### Nueva tabla `chat_conversaciones`
- `id` UUID PK (default gen_random_uuid)
- `org_id` UUID NOT NULL
- `folio_id` UUID NULL
- `agente` TEXT NOT NULL DEFAULT 'dm'  (`dm` | `farma`)
- `titulo` TEXT NOT NULL DEFAULT 'Nueva conversación'
- `ultimo_mensaje_en` TIMESTAMPTZ NOT NULL DEFAULT now()
- `mensajes_count` INT NOT NULL DEFAULT 0
- `tiene_riesgos_insertados` BOOL NOT NULL DEFAULT false
- `created_by` UUID NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- Índices: `(org_id, ultimo_mensaje_en DESC)`, `(folio_id)`

### Modificación a `chat_mensajes`
- Añadir columna `conversacion_id` UUID NULL (FK lógica) + índice.
- Migración suave: las filas viejas quedan con `conversacion_id` null (no se mostrarán en historial).

### RLS
- `chat_conversaciones`:
  - SELECT/UPDATE: `org_id = get_user_org_id() OR is_super_admin()`
  - INSERT: igual + `created_by = auth.uid()`
  - DELETE: admin de la org o super admin
- Service role: ALL (para edge functions).

### Trigger
- `chat_mensajes` AFTER INSERT → si trae `conversacion_id`, actualiza `ultimo_mensaje_en = now()` y `mensajes_count = mensajes_count + 1` en la conversación.
- Marcar `tiene_riesgos_insertados = true` desde el edge `chat-insertar-riesgo` cuando se inserte un riesgo asociado a una conversación (parámetro opcional `conversacion_id`).

---

## 2. Edge functions

### `chat-asistente` (modificar)
- Recibe `conversacion_id` opcional.
- Si no viene: crea una nueva fila en `chat_conversaciones` (org_id, folio_id, agente, created_by) y la devuelve en la respuesta inicial (header SSE `x-conversacion-id` o evento custom previo al stream).
- Persiste cada mensaje (user + assistant) en `chat_mensajes` con el `conversacion_id`.
- Al reanudar (conversación existente): carga últimos **20 mensajes** de `chat_mensajes` y los antepone al array enviado a Claude. Inyecta nota en el system prompt: *"Retomando conversación del {fecha} sobre {titulo}…"*.
- Tras el primer turno completo: si `titulo = 'Nueva conversación'`, auto-genera:
  - con folio: `[FOLIO_CODIGO] — {proceso_equipo}` (lookup a `folios`)
  - sin folio: primeros 50 chars del primer mensaje de usuario
  - update a `chat_conversaciones`.

### `chat-insertar-riesgo` (modificar mínimo)
- Aceptar `conversacion_id` opcional → marca `tiene_riesgos_insertados = true`.

---

## 3. Frontend — `AssistantPanel.tsx`

### Layout interno del Sheet
```text
┌─────────────────────────────────────────┐
│ Header: Asistente IA — Agent DM         │
├──────────────┬──────────────────────────┤
│ Historial    │ Chat activo              │
│ ─────────    │ ──────────               │
│ [+ Nueva]    │ messages…                │
│              │                          │
│ HOY          │                          │
│ • GR-2026-03 │                          │
│   Esterilz.  │                          │
│ • Consulta…  │                          │
│              │                          │
│ AYER         │                          │
│ • …          │                          │
│              │                          │
│ ESTA SEMANA  │                          │
│ • …          │ [input]            [Send]│
└──────────────┴──────────────────────────┘
```
- Sidebar izquierdo (~220px), colapsable con botón hamburguesa para móvil.
- Sheet ampliado a `sm:max-w-3xl`.

### Estado nuevo
- `conversacionId: string | null`
- `conversaciones: ConversacionRow[]` (cargado al abrir panel)
- Función `cargarConversacion(id)` → fetch a `chat_mensajes` ordenados, set `messages`.
- `nuevaConversacion()` → resetea `conversacionId` y `messages`.

### Item del sidebar muestra
- Título (truncado 1 línea)
- Subtexto: hora si es hoy, fecha si no.
- Badges: código de folio (outline), 🟢 si activa hoy, "IDs agregados" si `tiene_riesgos_insertados`.

### Agrupación
- `Hoy`, `Ayer`, `Esta semana`, `Este mes`, `Anteriores` — ordenado por `ultimo_mensaje_en DESC`.

### Integración con stream
- Al iniciar `sendMessage`: incluir `conversacion_id` en el body si existe.
- El backend devuelve `conversacion_id` en el primer evento; frontend lo guarda en estado y refresca lista.
- Al insertar riesgo: pasar `conversacion_id`.

---

## 4. Detalles técnicos

- **Carga de mensajes históricos:** desde el cliente (Supabase JS) usando RLS — no se exponen mensajes de otras orgs.
- **Límite UI:** 50 conversaciones más recientes; "Ver más" pagina si hace falta (fase 2 — fuera de este alcance, no se implementa).
- **Auto-título:** se hace en backend (edge) tras primer turno; el frontend solo refresca la lista al terminar el stream.
- **Migraciones de datos antiguos:** los mensajes con `conversacion_id NULL` simplemente no aparecen en el historial; sin backfill.
- **Performance:** índice compuesto cubre el listado; SELECT pesa pocos KB.

---

## 5. Archivos afectados
- `supabase/migrations/<timestamp>_chat_historial.sql` (nuevo)
- `supabase/functions/chat-asistente/index.ts` (modificar)
- `supabase/functions/chat-insertar-riesgo/index.ts` (modificar mínimo)
- `src/components/AssistantPanel.tsx` (refactor: sidebar + estado)

## 6. Fuera de alcance
- Eliminar/renombrar conversaciones desde la UI (puede añadirse luego).
- Búsqueda dentro del historial.
- Exportar conversación a PDF.
- Compartir conversación entre usuarios.

¿Apruebas el plan para proceder con la migración y el código?
