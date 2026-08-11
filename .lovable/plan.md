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

Patrón RLS idéntico al de `folios`/`riesgos`:
- SELECT: `org_id = get_user_org_id()` (o super_admin).
- INSERT/UPDATE: misma org y rol `admin`, `responsable_sanitario` u `operador`.
- DELETE: solo `admin`.
- `validado_por` / `resuelto_por` se fijan desde la app con `auth.uid()`.

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

Indicador de cobertura: `validados / (capturados + gaps abiertos) × 100`, calculado en una función `calcularCobertura` aislada para poder sustituirla luego por un catálogo de dominios esperados. Nota visible: "Indicador preliminar — calculado sobre el conocimiento identificado hasta ahora…".

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

El prompt vive en `agent_prompts` con `nombre = 'cerebro_institucional'`. Se inserta una versión inicial mínima y se reemplaza por `PROMPT_MAESTRO_CEREBRO_INSTITUCIONAL_v2` cuando lo entregues (sin tocar `dm` ni `farma`).

### Fase 5 — Exportación
`brain_exports` + generación del `.txt` consolidado por tipo de conocimiento, con secciones para brechas, contradicciones y memoria viva, y encabezado de contexto de la empresa para que una IA nueva entienda la organización sin ver las entrevistas.

## Detalles técnicos
- Persistencia del conocimiento independiente del historial: el agente siempre reconstruye contexto desde `brain_knowledge_items` / `brain_gaps`, nunca desde el historial del chat.
- `brain_interview_sessions.conversation_id` guarda el vínculo con el historial (uuid libre, sin FK a `chat_conversaciones` para no acoplar módulos).
- Documentos en el bucket de Storage existente, ruta `org_id/brain/...`, descarga por URL firmada.
- Sin campo de confianza numérica; el `estado` es el indicador.
- Sin cambios de esquema en tablas existentes; las FK hacia `folios`/`riesgos`/`profiles`/`organizations` son solo referencias salientes.

## Puntos a confirmar antes de codificar
1. El texto de `PROMPT_MAESTRO_CEREBRO_INSTITUCIONAL_v2` — si aún no lo tienes listo, arranco con un prompt provisional.
2. Visibilidad del módulo: ¿para todas las organizaciones o solo por plan/addon?
