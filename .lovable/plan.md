# Mejorar la experiencia del Wizard de Riesgos

## Problema

Hoy, en `RiesgoWizardDialog`, cualquier cierre del diálogo (clic fuera, tecla Esc, botón X, navegación por error) ejecuta `reset()` y descarta TODO lo capturado, sin aviso y sin posibilidad de regresar. Eso provoca:

- Salidas accidentales al desplazarse o al pulsar Esc.
- Pérdida total al activar atajos del navegador (por ejemplo captura de pantalla) y cerrar el modal resultante.
- Frustración al recapturar 5–7 pasos de información.

## Solución propuesta (3 capas de protección)

### 1. Auto-guardado de borrador en `localStorage`

- Mientras el wizard está abierto, persistir el estado `s`, `step`, y banderas auxiliares (`residualesEditados`, `causaRaizAplicado`, `extraJustificacion`) con debounce (~600 ms) en una clave por folio:
  - Crear nuevo: `tracea:wizard:draft:new:<folioId>`
  - Editar existente: `tracea:wizard:draft:edit:<riesgoId>`
- Al abrir el wizard, si existe un borrador no vacío y no es modo edición ya hidratado, mostrar un banner **"Recuperar borrador del <fecha>"** con dos acciones: **Recuperar** (carga el estado y posiciona en el último paso) o **Descartar**.
- Borrar el borrador cuando: se guarda con éxito, se descarta explícitamente, o el usuario confirma "Salir sin guardar".

### 2. Confirmación inteligente al cerrar

- Calcular `isDirty` comparando `s` contra `initialState` (o contra el snapshot inicial en modo edición).
- Interceptar el cierre del `Dialog`:
  - Reemplazar `onOpenChange={(o) => !o && (reset(), onClose())}` por un handler que, si `isDirty`, abra un `AlertDialog` de confirmación: **"¿Salir del wizard? Tu avance quedará guardado como borrador y podrás continuar después."** con botones **Continuar editando** (default) y **Salir y guardar borrador**.
  - Bloquear cierre por Esc y por clic fuera cuando `isDirty` usando `onEscapeKeyDown`/`onPointerDownOutside` con `e.preventDefault()` y disparar el mismo `AlertDialog` (no cerrar silenciosamente).
- El botón "Cancelar" del paso 1 y el botón X del header llaman al mismo flujo.

### 3. Aviso de salida del navegador

- Añadir `beforeunload` mientras el wizard está abierto y `isDirty` para que, si el usuario recarga o cierra la pestaña, el navegador pida confirmación (aparte del borrador ya persistido en `localStorage`).

## Cambios concretos

### `src/components/RiesgoWizardDialog.tsx`
- Nuevo helper `useWizardDraft(key, state, step, enabled)` con debounce que `setItem`/`removeItem`.
- Nuevo estado `recuperarVisible` y banner al inicio del `DialogContent`.
- Nuevo `AlertDialog` "Salir del wizard" controlado por estado `confirmCerrarOpen`.
- Reemplazar handler de `onOpenChange` por `intentarCerrar()`.
- Añadir `onEscapeKeyDown` y `onPointerDownOutside` en `DialogContent`.
- En `handleGuardar`, `handleGuardarYOtro`, `handleGuardarYAsistente`: tras éxito, limpiar la clave del borrador.
- Hook `useEffect` para registrar/desregistrar `beforeunload`.
- Computar `isDirty` con `useMemo` (`JSON.stringify(s) !== JSON.stringify(initialState)` para crear; comparar contra snapshot inicial para editar).

### Sin cambios
- Lógica de validación, persistencia en BD, scoring NPR, Asistente IA y causa raíz.
- No hay cambios en backend ni en otros componentes.

## Resultado esperado

- Cerrar el wizard nunca pierde datos sin antes preguntar.
- Si algo externo cierra el modal (atajos del navegador, navegación), al reabrir el wizard del mismo folio aparece el banner para recuperar exactamente donde se quedó.
- El usuario puede cerrar a propósito con un clic y confirmación, sabiendo que su avance queda guardado.
