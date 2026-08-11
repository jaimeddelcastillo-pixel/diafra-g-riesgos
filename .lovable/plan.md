# Cerebro Institucional — Plan de arquitectura

Módulo nuevo dentro de TRACEA. Reutiliza auth, `organizations`, `profiles`, `user_roles`, Storage, RLS por `org_id` y el sistema de diseño existente. No se toca ningún módulo actual (Riesgos, Capacitación, firmas/dictamen, `chat-asistente`, `chat-insertar-riesgo`, prompts `dm`/`farma`).

## Entrega por fases (cada fase = commits independientes)

### Fase 1 — Base de datos (un commit por tabla)
Orden de creación por dependencias:
1. `brain_areas`
2. `brain_processes`
3. `brain_process_areas`
4. `brain_documents`
5. `brain_interview_assignments`
6. `brain_assignment_processes`
7. `brain_interview_sessions`
8. `brain_knowledge_items`
9. `brain_knowledge_sources`
10. `brain_contradictions`
11. `brain_gaps`
12. `brain_memoria_viva`
13. `brain_exports`

Campos exactamente como los especificaste. Cada tabla incluye, en la misma migración y en este orden: CREATE TABLE → GRANT (`authenticated`, `service_role`) → ENABLE RLS → políticas.

RLS con separación captura / gobernanza (siempre `org_id = get_user_org_id()` o super_admin):
- SELECT: cualquier miembro de la org.
- CAPTURA (`operador`, `admin`, `responsable_sanitario`): INSERT en todas las tablas brain_*; UPDATE de campos descriptivos en `brain_areas`, `brain_processes`, `brain_documents`, `brain_interview_sessions` (estado de sesión), `brain_gaps` (estado) y `brain_memoria_viva`; INSERT/DELETE en `brain_process_areas`.
- GOBERNANZA (solo `admin` y `responsable_sanitario`): UPDATE de `brain_knowledge_items` hacia `validado` / `por_validar` / `contradictorio` y de los campos `validado_por`, `validado_en`, `motivo_invalidacion`, `afecta_cumplimiento`, `marco_validado`; UPDATE de `brain_contradictions` (estado, decisión final, fundamento, resuelto_por/en); UPDATE de `brain_interview_assignments` (aprobar o descartar sugerencias automáticas, prioridad); INSERT en `brain_exports`.
- DELETE en cualquier tabla brain_*: solo `admin`.
- Como RLS no distingue columnas, las restricciones por campo/estado se refuerzan con triggers de validación que comparan OLD/NEW y exigen rol de gobernanza.
- `validado_por` / `resuelto_por` se fijan con `auth.uid()`.

Nota: las validaciones con `now()` (p. ej. expiración de memoria viva) se resuelven en consulta, no como CHECK.

### Fase 2 — Navegación y esqueleto
- Sección "Cerebro Institucional" en `AppSidebar` con las 8 rutas.
- Rutas registradas en `App.tsx` dentro de `AppLayout`.
- Hooks de datos por tabla (patrón `useOrgTiposFolio`: react-query + `orgId` de `useAuth`).

### Fase 3 — Pantallas (un commit por pantalla)
1. `/cerebro` — Dashboard. Estado vacío con datos de la org pre-llenados y botón "Iniciar Cerebro Institucional"; con sesiones: indicador de cobertura, distribución de estados, contadores y accesos directos.
2. `/cerebro/entrevistas` — asignaciones pendientes + sesiones completadas, "Nueva sesión".
3. Panel de entrevista — 70/30: chat de consultor (sin burbujas de chatbot) + panel contextual en vivo (tema, proceso, conocimiento capturado, brechas, pendientes).
4. `/cerebro/conocimiento` — tabla filtrable (tipo/proceso/área/estado), filas expandibles con fuentes y acciones.
5. `/cerebro/validacion` — ítems `por_validar` / `contradictorio`, con Validar / Rechazar / Modificar / Pedir info.
6. `/cerebro/documentos`, `/cerebro/contradicciones`, `/cerebro/brechas` — listados con alta y cambio de estado.
7. `/cerebro/exportar` — genera y descarga `CEREBRO_INSTITUCIONAL_COMPLETO.txt`.

Indicador: **"Índice de madurez del conocimiento identificado"** = `validados / (capturados + gaps abiertos) × 100`, en una función `calcularCobertura` aislada, sustituible después por un catálogo de dominios esperados sin cambiar la UI. Nota visible obligatoria: "Índice preliminar — mide la madurez del conocimiento identificado hasta ahora. No representa el universo total de conocimiento institucional de la empresa."

Visibilidad del módulo (misma lógica que el curso): `tieneCerebro = plan ∈ (professional, enterprise) OR org.tiene_cerebro_pagado`. Starter queda fuera del MVP (mensaje de upgrade). Trial: solo la primera sesión de entrevista y sin exportación. Se agrega `organizations.tiene_cerebro_pagado` (boolean, default false) para habilitar el futuro addon.

### Fase 4 — Edge function `brain-interview` (un commit por herramienta)
Función nueva, misma base que `chat-asistente` (Anthropic + service role + CORS POST/OPTIONS), archivo separado; `chat-asistente` no se modifica.

Herramientas, en este orden de commits:
1. `obtener_contexto_cerebro`
2. `guardar_conocimiento`
3. `registrar_brecha`
4. `registrar_contradiccion`
5. `get_next_interview_objective`
6. `sugerir_entrevistado`

Flujo por turno tal como lo definiste: contexto → análisis → guardar → contradicción/brecha → sugerencia → objetivo → una sola pregunta.

Inyección de contexto al inicio de cada sesión: empresa, marco regulatorio declarado con estado `por_validar`, entrevistado (nombre, puesto, capa, nivel de autoridad), conocimiento previo y gaps filtrados para ese entrevistado.

Prompt: **sin versión provisional**. Antes de crear la edge function se inserta en `agent_prompts` (`nombre = 'cerebro_institucional'`) el contenido completo de `PROMPT_MAESTRO_CEREBRO_INSTITUCIONAL_EMPRESA_REGULADA_v2.txt`, que se entrega al iniciar la Fase 4. La función lo lee de ahí igual que `chat-asistente` lee `dm` y `farma`; esos prompts no se tocan.

Regla de la edge function (corre con service_role): `guardar_conocimiento`, `registrar_brecha` y `registrar_contradiccion` siempre dejan estado inicial `capturado` / `abierta`. Nunca transicionan a `validado` ni `resuelta`; esas transiciones solo ocurren por acción humana autenticada desde `/cerebro/validacion`.

### Fase 5 — Exportación
`brain_exports` + generación del `.txt` consolidado por tipo de conocimiento, con secciones para brechas, contradicciones y memoria viva, y encabezado de contexto de la empresa para que una IA nueva entienda la organización sin ver las entrevistas.

## Detalles técnicos
- Persistencia del conocimiento independiente del historial: el agente siempre reconstruye contexto desde `brain_knowledge_items` / `brain_gaps`, nunca desde el historial del chat.
- `brain_interview_sessions.interview_thread_id` (renombrado desde `conversation_id`) guarda el vínculo con el historial: UUID libre, sin FK a ninguna tabla de chat. El vínculo es por convención, no por constraint.
- Documentos en el bucket de Storage existente, ruta `org_id/brain/...`, descarga por URL firmada.
- Sin campo de confianza numérica; el `estado` es el indicador.
- Sin cambios de esquema en tablas existentes; las FK hacia `folios`/`riesgos`/`profiles`/`organizations` son solo referencias salientes.

## Confirmado
- Prompt Maestro v2 obligatorio desde el inicio, sin provisional; se entrega al llegar a la Fase 4.
- Visibilidad: Professional y Enterprise; Trial con una sola sesión y sin exportar; Starter fuera del MVP.
- "Índice de madurez del conocimiento identificado" en lugar de "cobertura", `interview_thread_id`, y RLS con separación captura/gobernanza.
- Arrancamos por la Fase 1: un commit por tabla, en el orden de dependencias listado.
