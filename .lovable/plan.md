# Codificación de folios configurable por organización

Hoy el código se arma en la base de datos con formato fijo `GR-[TIPO]-[AAAA]-[NNN]` y los tipos viven en un archivo del frontend. El objetivo es que cada organización defina prefijo, grupos, período y dígitos, sin tocar los folios ya emitidos.

## Resultado esperado

- `/configuración` gana dos tarjetas nuevas: **Formato de folio** (prefijo, período, dígitos + preview en vivo) y **Tipos de folio** (grupos base + personalizados, activar/desactivar).
- Los folios nuevos usan la configuración de su organización; los existentes conservan su código tal cual.
- El consecutivo, su reciclaje al cancelar/borrar y la trazabilidad se mantienen con la misma lógica.

## Bloques

| Bloque | Configuración | Valores |
|---|---|---|
| Prefijo | `folio_prefijo` | 2–4 letras mayúsculas, default `GR` |
| Grupo | tabla `org_folio_tipos` | códigos base + personalizados, activables |
| Período | `folio_formato_periodo` | `anio_completo` (2026), `anio_corto` (26), `trimestre` (Q1-26), `sin_periodo` |
| Consecutivo | `folio_digitos_consecutivo` | 3 (001) o 4 (0001) |

Separador siempre `-`.

## Base de datos

1. `organizations`: agregar `folio_prefijo TEXT DEFAULT 'GR'`, `folio_formato_periodo TEXT DEFAULT 'anio_completo'`, `folio_digitos_consecutivo INTEGER DEFAULT 3`. Validación por trigger (prefijo `^[A-Z]{2,4}$`, período dentro del set permitido, dígitos 3 o 4).
2. Tabla nueva `org_folio_tipos` (`id, org_id, codigo, nombre, activo, es_personalizado, orden, created_at, updated_at`) con único `(org_id, codigo)`. GRANTs a `authenticated` y `service_role`; RLS: lectura para miembros de la organización, escritura solo para admin de la organización o super admin. Los grupos base (`es_personalizado = false`) no se pueden borrar — solo desactivar.
3. Backfill: poblar `org_folio_tipos` para todas las organizaciones existentes según su norma (DM: SGC, FAB, SIS, CAL, PRD, PMS · Farma: SGC, FAB, SIS, CAL, PRD, FV · MULTI: los siete). El mismo poblado se hace al crear una organización nueva.
4. `folio_sequence`: agregar `periodo_key TEXT` y unicidad `(org_id, tipo, periodo_key)`; backfill `periodo_key = year::text` para no romper las secuencias vigentes. `sin_periodo` usa una clave fija por organización.
5. `folios`: agregar `codigo_periodo TEXT` y `codigo_consecutivo INTEGER` para no depender de parsear el texto del código.
6. `next_folio_code(p_tipo)`: lee la configuración de la organización, valida que el tipo exista y esté activo en `org_folio_tipos`, calcula la clave de período, reserva el consecutivo y arma el código con el padding configurado. La firma no cambia, así que los llamadores actuales siguen igual.
7. `reciclar_folio_sequence()`: deja de usar la expresión regular `GR-...` y usa `codigo_periodo` / `codigo_consecutivo` del folio borrado, con respaldo al parseo antiguo para folios previos.

## Frontend

- `src/config/tipos-folio.ts` queda como catálogo de semillas; los selectores pasan a leer `org_folio_tipos` mediante un hook nuevo `useOrgTiposFolio()`.
- Selector de tipo al crear folio (`src/pages/Folios.tsx`) y filtros por tipo: solo grupos activos de la organización, con etiquetas desde la base de datos.
- Tarjeta **Formato de folio**: campos de prefijo, período y dígitos, con preview en vivo "Tu próximo folio se verá así: `AR-FAB-Q1-26-001`" y guardado solo para admin.
- Tarjeta **Tipos de folio**: tabla con código, nombre, origen (TRACEA / personalizado), interruptor de activo, y alta de grupo personalizado validando código de 2–4 caracteres único por organización.
- `src/pages/FolioDetail.tsx`: el chequeo de "es el último folio" para el borrado físico usa los campos nuevos en lugar del regex.
- `getTipoLabel` acepta códigos personalizados (ya cae al código como respaldo).
- `supabase/functions/chat-asistente`: su respaldo manual arma `GR-...` a mano; se cambia para depender del RPC y fallar limpio si este falla.

## Fuera de alcance

Flujo de firmas, PDF y Asistente IA (más allá del ajuste de respaldo), y recalcular códigos ya emitidos.

## Decisiones aplicadas

- El consecutivo se reinicia por período: anual en los formatos de año, trimestral en `Q1-26`, y continuo cuando no hay período.
- Cambiar la configuración no afecta secuencias ya iniciadas; cada combinación de tipo y período mantiene su propio contador.