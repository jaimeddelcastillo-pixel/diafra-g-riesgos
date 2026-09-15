# Campos de acción de mejora cuando NO aplica

## Qué pasa hoy (verificado)

El sistema **no** genera fechas automáticas: la columna de fecha compromiso no tiene valor por defecto y nada en el código la rellena sola. Lo que ocurre es que los campos de acción (Acción propuesta, Responsable, Fecha compromiso) **siguen editables y conservan lo que ya se haya capturado** aunque se responda "No" a "¿Requiere acción de mejora?". Si alguna vez se escogió una fecha —a mano o propuesta por el asistente— se queda guardada y luego aparece en la ficha y en el PDF sin ninguna acción que la respalde.

En los datos reales de Diafra hay 4 riesgos en esa situación (dos de ellos con "N/A" en acción propuesta y fecha futura), de 307 totales.

## Propuesta

Regla única y trazable: **si no requiere acción, los tres campos quedan vacíos y bloqueados**.

1. **Bloqueo visual**: al poner "No" en ¿Requiere acción de mejora?, los campos Acción propuesta, Responsable y Fecha compromiso se deshabilitan y muestran la leyenda "No aplica — el riesgo es aceptable con los controles actuales".
2. **Limpieza al guardar**: si no requiere acción, se guardan los tres campos vacíos (fecha en blanco, no una fecha ficticia). Así nunca queda una fecha huérfana.
3. **Aviso al cambiar de "Sí" a "No"** con datos ya capturados: confirmación breve "Se eliminarán la acción, el responsable y la fecha compromiso de este ID. ¿Continuar?".
4. **Nada de "N/A" escrito a mano**: al quedar bloqueado y vacío, la ficha y el PDF muestran "No aplica" automáticamente en lugar de un guion suelto o un "N/A" capturado.
5. **Al revés también**: si se pone "Sí", los tres campos vuelven a ser obligatorios como ya lo son hoy (el wizard ya no deja avanzar sin ellos).

Esto aplica igual en las dos formas de capturar un riesgo: el asistente paso a paso (wizard) y el formulario completo de edición.

## Datos existentes

Los 4 riesgos que hoy tienen fecha sin acción requerida: se limpian con una corrección puntual y queda registro en la bitácora de auditoría. Los 13 que tienen "N/A" como texto se normalizan a vacío para que se muestre "No aplica".

## Detalle técnico

- `src/components/RiesgoFormDialog.tsx`: `disabled` en los tres controles cuando `!requiere_accion && !needsAction`; en el payload de guardado forzar `accion_propuesta: ""`, `responsable: ""`, `fecha_compromiso: null` en ese caso; diálogo de confirmación al desactivar el switch con datos presentes.
- `src/components/RiesgoWizardDialog.tsx`: en el paso de acción, cuando `!requiereAccion` mostrar el bloque informativo con los campos deshabilitados y forzar los mismos valores vacíos en `persist()`.
- `src/components/RiesgoDetailSheet.tsx` y `src/lib/generateFolioPDF.ts`: cuando `requiere_accion = false`, imprimir "No aplica" en el bloque de acción en vez de "—"/fecha.
- Limpieza de datos: `UPDATE riesgos SET accion_propuesta='', responsable='', fecha_compromiso=NULL WHERE requiere_accion=false AND (fecha_compromiso IS NOT NULL OR upper(accion_propuesta)='N/A')` (el trigger de auditoría registra el cambio).

Sin cambios de esquema ni de reglas de aprobación: las validaciones de `folio-workflow` ya solo exigen fecha cuando `requiere_accion` es verdadero.
