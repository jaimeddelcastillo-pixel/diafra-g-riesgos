# Cerebro Institucional — Fase A (4 migraciones)

Solo base de datos. No se toca UI, edge functions ni módulos existentes. Un commit por migración, verificando cada una antes de la siguiente.

## Hallazgos verificados en la base de datos real

- `brain_interview_sessions` está **vacía** (0 filas): ninguna migración de esta fase afecta datos existentes.
- Los estados permitidos hoy NO son los del prompt. El CHECK vigente es `estado IN ('en_curso','pausada','finalizada','cancelada')` con `DEFAULT 'en_curso'`. La verificación pedida ("solo pendiente, en_proceso, completada") no puede cumplirse porque ese vocabulario nunca existió en esta tabla.
- `assignment_id` **ya existe** en `brain_interview_sessions`, con FK a `brain_interview_assignments`, `ON DELETE SET NULL` e índice. La migración 3 no necesita crearla.
- `metadata` no existe todavía en `brain_interview_sessions`: sí se agrega.
- `brain_gaps` y `brain_contradictions` tienen `session_id` (FK `ON DELETE SET NULL`): se aplica verificación de tres dimensiones en ambas.
- Ninguna parte del código escribe el estado de la sesión hoy, así que un cambio de vocabulario no rompe nada actualmente; solo condiciona la Fase B.

### Decisión pendiente sobre el vocabulario de estado

Propuesta por defecto (la que ejecuto salvo indicación contraria): **conservar el vocabulario actual y solo ampliarlo**, quedando `('en_curso','pausada','finalizada','cancelada','pendiente')`. Motivo: el CHECK propuesto elimina `cancelada`, y renombrar `en_curso→en_proceso` / `finalizada→completada` obliga a alinear la Fase B y las pantallas del Cerebro.

Alternativa si prefieres el vocabulario nuevo: `('pendiente','en_proceso','pausada','completada','cancelada')` con `DEFAULT 'pendiente'`. La tabla está vacía, así que el cambio sería limpio.

## Migración 1 — `brain_interview_turns`

Tal como se especificó: `id` UUID PK sin default (lo genera el frontend), `org_id` y `session_id` con `ON DELETE RESTRICT`, CHECK de estado (`pendiente|procesando|completado|fallido`), `operations` JSONB solo con metadata técnica de idempotencia, contadores, `current_objective`, `error` y timestamps.

GRANT `SELECT` a `authenticated` y `ALL` a `service_role`. RLS activo con una única policy de SELECT por organización. Índices por `session_id` y por `(org_id, estado)`. Trigger `trg_verify_turn_org_session` (BEFORE INSERT) que exige que la sesión pertenezca a la misma organización.

Pruebas: inserción válida, inserción con sesión de otra organización (debe fallar) y confirmación de que `authenticated` solo puede leer.

## Migración 2 — `brain_interview_messages`

Transcript visual de la sesión. `turn_id` nullable con `ON DELETE SET NULL`, `role` restringido a `user|assistant`, `metadata` solo técnica. GRANT y RLS idénticos a la migración 1 (lectura por organización, escritura solo service_role). Índices `(session_id, created_at ASC)` y parcial por `turn_id`. Trigger `trg_verify_message_turn_integrity` que valida turno → sesión → organización.

Pruebas: sin `turn_id`, con `turn_id` correcto, con turno de otra sesión y de otra organización (deben fallar), e inserción bloqueada para `authenticated`.

## Migración 3 — `brain_session_processes` + ALTER de sesiones

Tabla nueva con `UNIQUE (session_id, process_id)`, FKs `RESTRICT`, GRANT y RLS estándar, índices por sesión y por proceso, y trigger de integridad triple (sesión y proceso de la misma organización) en INSERT y UPDATE.

En `brain_interview_sessions`:
- Se agrega `metadata JSONB NOT NULL DEFAULT '{}'`.
- `assignment_id` ya existe con la definición correcta: se deja intacta (desviación respecto al prompt).
- Se reemplaza el CHECK de estado según la decisión de vocabulario anterior.
- Trigger `trg_verify_session_assignment_org` para que `assignment_id` sea de la misma organización.

Pruebas: combinaciones válidas e inválidas de organización, estado `pausada`, `assignment_id` de otra organización y violación del UNIQUE.

## Migración 4 — `turn_id` en tablas existentes

- `brain_knowledge_items.created_from_turn_id` + trigger de verificación turno+organización + índice parcial.
- `brain_gaps.turn_id` + trigger de tres dimensiones (usa `session_id` cuando está presente) + índice parcial.
- `brain_contradictions.turn_id` + trigger equivalente + índice parcial.

Todas las columnas son nullable, así que las filas existentes quedan con `turn_id` nulo y no se ven afectadas.

Pruebas por tabla: `turn_id` nulo, turno de la misma organización, turno de otra organización, turno de otra sesión y conteo de filas existentes con `turn_id` no nulo (debe ser 0).

## Entrega al cerrar la Fase A

Inventario completo de tablas, funciones, triggers, índices y constraints creados; resultado de cada prueba por migración; confirmación de que no se alteraron datos existentes; y lista de desviaciones (hasta ahora: `assignment_id` preexistente y el vocabulario de estado).

No se avanza a la Fase B sin aprobación explícita.