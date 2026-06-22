
# Plan: Evaluación final NOM-241 + diploma

Infra ya existe (`ExamenFinal.tsx`, `AdminCursoEvaluacion.tsx`, `emitir-diploma`, `MisDiplomas.tsx`, `curso_examen_intentos`, `curso_diplomas`). Falta cargar contenido, blindar reglas y pulir el diploma.

## Decisiones confirmadas

- **Contenido:** lo proporcionas tú. Lo cargamos con un importador.
- **Tiempo límite:** 45 min, auto-envío al expirar.
- **Cooldown:** ninguno.
- **Anti-trampa por sorteo:** el banco tiene **7–8 preguntas por bloque** y en cada intento se sortean **5 por bloque (20 en total)**. Excelente decisión: garantiza que ningún intento es idéntico al anterior. Ya lo hace `pickRandom` en `ExamenFinal.tsx` — solo subimos el banco.

## 1. Carga del banco de preguntas

Distribución objetivo (validada en UI):

| Bloque | Mínimo activas | Recomendado |
|---|---|---|
| `marco_regulatorio` | 7 | 8 |
| `metodologia` | 7 | 8 |
| `casos_practicos` | 7 | 8 |
| `flujo_aprobacion` | 7 | 8 |
| **Total banco** | **28** | **30–32** |
| **Por intento (sorteado)** | 20 (5 por bloque) | — |

`AdminCursoEvaluacion.tsx` se actualiza:
- Contador por bloque mostrando `activas / 7` (verde ≥7, amarillo 5–6, rojo <5).
- Constante `META = 28` (mínimo); umbral "óptimo" 32.
- Modal **"Importar preguntas"** con dos modos:
  1. **JSON**:
     ```json
     [{"bloque":"marco_regulatorio","pregunta":"…","opcion_a":"…","opcion_b":"…","opcion_c":"…","opcion_d":"…","respuesta_correcta":"B","justificacion":"…"}]
     ```
  2. **CSV/TSV** con columnas: `bloque, pregunta, A, B, C, D, correcta, justificacion`.
- Validaciones: `correcta ∈ {A,B,C,D}` apuntando a opción no vacía, sin duplicados de enunciado, bloque válido.
- Modos *upsert* (reemplaza banco) o *append*.
- Preview tabulado antes de confirmar; al confirmar, `activo = true`.

Sigue funcionando la edición manual. Botón "Publicar evaluación" se desbloquea solo si **cada bloque tiene ≥7 activas**.

> Alternativa: si prefieres pegar las preguntas en chat, te las convierto a `INSERT` y las cargo con la herramienta `insert`. El importador queda igual para futuros cursos.

## 2. Reglas del examen (blindaje)

Reglas duras: **20 preguntas sorteadas (5 por bloque) de un banco ≥7/bloque, ≥80% (≥16 correctas), 3 intentos, 45 min/intento, sin cooldown.**

Cambios en `ExamenFinal.tsx`:
- Bloquear inicio si algún bloque tiene <7 activas (mensaje claro al alumno).
- **Temporizador visible 45:00**, auto-envío al expirar; guardar `started_at`, `finished_at`, `duracion_seg`.
- Sorteo por intento ya implementado (`pickRandom` 5/bloque); además **mezclar orden de opciones** A–D por pregunta en cada render.
- Panel lateral con estado de cada pregunta + "Marcar para revisar".
- Modal de confirmación antes de enviar.
- Anti-trampa básico adicional: registrar `tab_blur_count` (visibilitychange).
- Tras enviar: **revisión pregunta a pregunta** con justificación (solo del intento recién terminado).
- Reprobó y quedan intentos → botón **Reintentar** inmediato.
- Ya aprobó → ocultar "Iniciar"; CTA único a `/mis-diplomas`.

Migración: agregar a `curso_examen_intentos` las columnas `duracion_seg int`, `tab_blur_count int default 0`, `tiempo_limite_seg int default 2700`.

## 3. Flujo de diploma

- `emitir-diploma`: idempotencia. Si existe `curso_diplomas` para `(user_id, curso_id)`, devolver el existente sin regenerar PDF.
- Pantalla de resultado: eliminar `download_url`. Solo:
  - "🎓 Diploma emitido — Folio DIP-YYYY-NNN"
  - CTA primario → **Ver en Mis Diplomas**
  - "También enviamos el diploma a tu correo."
- Correo `diploma-emitido`: confirmar sin DC-3 ni URL firmada, CTA a `/mis-diplomas` (ya ajustado).

## 4. Revisión visual del diploma PDF

Auditar `emitir-diploma/index.ts`:

- Horizontal, carta, márgenes simétricos.
- Logo **TRACEA Academy** (confirmar archivo en `public/`).
- Tipografía sobria (serif para nombre, sans para metadatos).
- Bloques: nombre (grande), curso, calificación, fecha, folio `DIP-YYYY-NNN`, hash + QR a `tracea.com.mx/diploma/verificar/:hash`.
- Firma 200x80 del Ing. Jaime David Del Castillo Couret + "Instructor".
- Pie legal acordado (sin DC-3).
- QA visual con diploma de prueba.

## 5. Orden de implementación

1. Migración: columnas nuevas en `curso_examen_intentos`.
2. Importador de preguntas (JSON/CSV) + contadores por bloque (`META=28`) en `AdminCursoEvaluacion.tsx`.
3. Carga del banco (28–32 preguntas) — vía importador o conversión desde texto plano.
4. Refuerzo de `ExamenFinal.tsx` (timer 45 min, gating ≥7/bloque, mezcla de opciones, revisión, anti-cheat, CTA único).
5. Idempotencia en `emitir-diploma` + revisión visual del PDF.
6. QA end-to-end con usuario demo.

¿Apruebas para implementar?
