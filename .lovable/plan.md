# Inserción de riesgos en bloque desde el asistente IA

## Problema

Cuando el asistente propone varios riesgos numerados (1, 2, 3, 4, 5), el backend corta el turno después de la **primera** propuesta y el panel solo permite insertar de una en una. Resultado: el usuario ve la enumeración en el texto, pero solo un riesgo llega al folio (queda en el Id 1) y el resto se pierde.

## Solución

Permitir que el asistente proponga varios riesgos en un mismo turno y que se inserten como bloque, en el orden propuesto, generando Ids consecutivos 1…N.

### 1. Backend (`chat-asistente`)

- Aceptar múltiples bloques `proponer_riesgo` en una misma respuesta (hoy el primero fija `stopAfter` y termina el turno). Se emiten todos al cliente como tarjetas.
- Límite de seguridad: máximo 10 propuestas por turno; si el modelo excede, se recortan y se le informa en el `tool_result` que continúe en el siguiente turno.
- Ajuste del prompt: cuando el usuario pida "varios riesgos" o un análisis completo, emitir una llamada `proponer_riesgo` **por cada** riesgo, en el orden lógico deseado, sin numerarlos dentro de los campos de texto.

### 2. Panel del asistente (`AssistantPanel.tsx`)

- Agrupar las tarjetas `proponer_riesgo` consecutivas de un mismo mensaje en un bloque "Riesgos sugeridos (N)".
- Cada tarjeta muestra su posición propuesta (1, 2, 3…) y conserva su botón "Insertar" individual.
- Botón nuevo **"Insertar todos"** en la cabecera del bloque: inserta **secuencialmente** (uno tras otro, esperando respuesta) para respetar el orden y evitar colisiones de numeración.
- Progreso visible ("Insertando 3 de 5…"), y resumen final: insertados, duplicados omitidos, errores.
- Los duplicados por similitud (>80%) durante "Insertar todos" no abren `confirm()` uno por uno: se omiten y se listan al final para que el usuario decida insertarlos individualmente con forzado.

### 3. Numeración

No requiere cambios de base de datos: el trigger `set_riesgo_numero_local` ya asigna `max+1` con lock por folio, así que la inserción secuencial produce Ids 1…N en el orden propuesto. Se mantiene el reordenamiento por arrastre ya existente para ajustes posteriores en Borrador.

## Detalles técnicos

- `supabase/functions/chat-asistente/index.ts`: quitar el corte tras la primera propuesta, contar propuestas del turno (`MAX_PROPUESTAS_POR_TURNO = 10`), un `tool_result` por bloque.
- `src/components/AssistantPanel.tsx`: nuevo componente de bloque de propuestas + función `insertarRiesgosEnLote` que reutiliza `insertarRiesgo` en serie y acumula resultados.
- Sin migraciones. Sin cambios en `chat-insertar-riesgo`.
