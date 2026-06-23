
## Objetivo

1. Arreglar la emisión del diploma (no se generó en tu intento aprobado).
2. Mostrar correctamente aciertos/errores por pregunta y resumen por bloque tras enviar el examen.
3. Dar calificación visual clara al alumno (durante y al final).
4. Dashboard de cumplimiento del curso para la empresa (admin/RS).

---

## 1. Fix de emisión de diploma

**Edge function `emitir-diploma`**
- Reemplazar el `.or(and(...),and(...))` que está fallando por dos lookups simples (por `intento_id` y por `(user_id, curso_id)`).
- Agregar `console.error` etiquetado en cada paso: lookup, folio, PDF, storage, insert. Hoy solo loguea en el catch general → por eso no quedó traza.
- Envolver `generarDiplomaPDF` en try/catch propio para distinguir error de render vs storage.

**`src/pages/MisDiplomas.tsx` — auto-recuperación**
- Si el usuario aprobó un examen pero no tiene diploma, mostrar botón **"Emitir mi diploma"** que invoca `emitir-diploma` con ese `intento_id`. Así emites el tuyo sin volver a presentar.

**`src/components/AppSidebar.tsx`**
- Añadir entrada **"Mis Diplomas"** (`/mis-diplomas`, ícono `Award`) en `orgNavItems`.

---

## 2. Revisión del examen con errores visibles y bloques

**Problema actual:** `ExamenFinal.tsx` está pintando todas las preguntas en verde porque en la pantalla de revisión compara contra una variable equivocada (todas terminan marcadas como correctas).

**Cambios en `src/pages/ExamenFinal.tsx`:**
- Usar `detalles[i].correcta` (que ya viene del RPC `examen_calificar`) para colorear cada pregunta:
  - Verde con ✓ si acertó.
  - Rojo con ✗ si falló — marcando claramente la opción del usuario y la opción correcta.
  - Mostrar `justificacion` debajo solo en preguntas falladas.
- Mostrar etiqueta de **bloque** en cada pregunta (Marco regulatorio / Metodología / Casos prácticos / Flujo de aprobación).

**Resumen por bloque (nuevo panel arriba de la revisión):**
- Tarjetas con: bloque, X / 5 aciertos, % del bloque, badge "Dominado" (≥80%) o **"Revisar este bloque"** (<80%) con recomendación textual.
- Usa `bloque_resumen` que ya devuelve el RPC.

---

## 3. Calificación visual para el alumno

**Durante el examen (`ExamenFinal.tsx`):**
- Barra de progreso de preguntas respondidas (X/20) ya existente — reforzar con contador visible.
- Temporizador con color: verde > 15 min, ámbar 5–15 min, rojo < 5 min.

**Al finalizar:**
- Hero result card con:
  - Círculo grande con la calificación (90 / 100), color por umbral (verde ≥80, ámbar 60–79, rojo <60).
  - Badge **"Aprobado"** / **"No aprobado"**.
  - X de 20 correctas, tiempo usado, intento N/3.
- Debajo, las 4 tarjetas por bloque del punto 2.
- Botón principal: si aprobó → "Ver mi diploma" → `/mis-diplomas`; si no → "Reintentar examen" (si quedan intentos).

---

## 4. Dashboard de cumplimiento (empresa)

**Nueva página `src/pages/AdminCumplimientoCurso.tsx`** (ruta `/admin/cumplimiento`, visible para `admin`, `responsable_sanitario` y `super_admin`).

Vista por curso (selector arriba, default NOM-241):
- KPIs: # miembros de la org, # aprobados, # en curso, # sin iniciar, % cumplimiento.
- Tabla de usuarios de la organización con columnas:
  - Nombre · Email · Rol
  - Estado curso: Sin iniciar / En curso / **Aprobado**
  - Mejor calificación
  - Intentos usados (n/3)
  - Fecha de aprobación
  - Folio de diploma (si emitido) + link descarga
- Filtros: estado, búsqueda por nombre.
- Botón **Exportar CSV**.

**RPC nueva `cumplimiento_curso(p_curso_id uuid)`** (SECURITY DEFINER):
- Verifica que `auth.uid()` es admin/RS/super_admin de la org.
- Devuelve filas con: user_id, nombre, email, rol, mejor_calificacion, intentos, aprobado, fecha_aprobacion, diploma_folio.
- Une `org_members` ⨝ `profiles` ⨝ `curso_examen_intentos` (best by user) ⨝ `curso_diplomas`.

**Sidebar:**
- Añadir entrada **"Cumplimiento"** en sección admin con ícono `GraduationCap`.

---

## Detalles técnicos

- No se toca el esquema de `curso_examen_intentos` ni `curso_evaluacion_preguntas` — todo el feedback viene del RPC existente `examen_calificar`.
- Sólo se añade la RPC `cumplimiento_curso` (lectura) en una migración.
- Todo el código nuevo de UI usa tokens del design system (Navy/Teal), sin hex hardcodeados.

---

## Archivos afectados

- `supabase/functions/emitir-diploma/index.ts` (fix + logs)
- `src/pages/MisDiplomas.tsx` (botón emitir)
- `src/pages/ExamenFinal.tsx` (revisión correcta + hero + bloques)
- `src/pages/AdminCumplimientoCurso.tsx` (nuevo)
- `src/App.tsx` (ruta nueva)
- `src/components/AppSidebar.tsx` (Mis Diplomas + Cumplimiento)
- Migración: RPC `cumplimiento_curso` + GRANT execute a authenticated.
