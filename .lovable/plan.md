# Reedición de códigos de folio (super_admin)

Herramienta de corrección puntual, visible solo para super_admin, en la ruta `/admin/super/reeditar-codigos`. No altera el flujo normal del sistema, ni PDFs ya generados, ni el Asistente IA.

## Nota importante sobre estados

El sistema no tiene el estado "Rechazado". Los estados reales son: Borrador, En Firma, Aprobado, Cerrado, Cancelado. Se permitirá editar únicamente folios en **Borrador**; el resto se muestra en solo lectura. Si quieres incluir también Cancelado como editable, dilo y lo ajusto.

## Paso 1 — Selección de organización

- Dropdown con todas las organizaciones (nombre + plan).
- Al elegir una, se lista la totalidad de sus folios ordenados por código.
- Tabla: Código actual | Estado | Nuevo código (input) | ¿Modificar? (checkbox).
- Buscador por código para organizaciones con muchos folios.

## Paso 2 — Edición

- El input y el checkbox solo se habilitan en folios Borrador. Los demás aparecen atenuados con la etiqueta "No modificable".
- Validación en vivo por fila mientras se escribe:
  - formato `PREFIJO-GRUPO-PERIODO-CONSECUTIVO` según la configuración de codificación de la organización (prefijo, grupos activos, formato de período, dígitos);
  - código no vacío y distinto del actual;
  - sin duplicados dentro de la misma organización (contra los folios existentes y contra los otros códigos nuevos capturados en la tabla).
- Contador en cabecera: "N folios marcados para modificar".

## Paso 3 — Confirmación

- Botón "Aplicar cambios" abre un diálogo con el resumen: "Se modificarán N folios. Esta acción queda registrada." y la lista viejo → nuevo.
- Se exige escribir **CONFIRMAR** para habilitar el botón definitivo.
- Si alguna fila tiene error de validación, el botón queda bloqueado.

## Qué ocurre al confirmar

Se ejecuta una única función de servidor que, por cada folio:

1. Verifica que quien llama es super_admin y que el folio sigue en Borrador y pertenece a la organización indicada.
2. Actualiza `codigo` y recalcula `codigo_periodo` / `codigo_consecutivo` a partir del nuevo código.
3. Escribe un registro en `audit_trail` con `accion: "codigo_corregido_super_admin"`, `valor_anterior` (código viejo) y `valor_nuevo` (código nuevo), con el usuario super_admin y la organización.
4. Al terminar, ajusta `folio_sequence` de cada combinación tipo/período afectada para que el consecutivo quede en el número más alto en uso; así los folios nuevos siguen la numeración correcta.

Todo el lote se procesa en una sola operación transaccional: si una fila falla, no se aplica nada y se devuelve el detalle del error.

## Acceso

- Ruta protegida: cualquier rol distinto de super_admin es redirigido.
- Entrada en el menú lateral solo dentro de la navegación de super_admin, no visible para admins de organización.
- La función de servidor valida el rol por su cuenta, no confía en el frontend.

## Detalles técnicos

- Nueva página `src/pages/AdminReeditarCodigos.tsx` + ruta en `src/App.tsx` + ítem en `src/components/AppSidebar.tsx` (lista `adminNavItems`).
- Nueva Edge Function `admin-reeditar-codigos` (verifica JWT y rol `super_admin` en `user_roles`, igual que `admin-asignar-tipo-folio`), que ejecuta una nueva función de base de datos `SECURITY DEFINER` para aplicar el lote de forma atómica.
- Migración: función `reeditar_codigos_folios(p_org_id uuid, p_cambios jsonb, p_actor uuid)` con las validaciones descritas y la actualización de `folio_sequence`. No se modifican tablas ni políticas existentes.
- La restricción existente `folios_org_codigo_unique (org_id, codigo)` respalda la validación de duplicados a nivel de base de datos.
- Reutiliza `useOrgTiposFolio` y el helper de preview de código ya usados en Configuración.