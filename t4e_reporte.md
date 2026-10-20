# T4e — Catálogo Excel (IM-23)

## Entrega
- Catálogos muestra Plantilla de Excel, Exportar catálogo e Importar Excel únicamente para admin/RS fuera de soporte.
- Plantilla T4e-1: Instrucciones, Sistemas_HVAC, Areas, Instrumentos y Objetivos_presion. Ejemplos marcados en columna sin encabezado se ignoran. Desplegables OOXML con las clases T4f y listas existentes; Arial y ayuda del formulario. Sin fórmulas (no requiere recalcular).
- Vista previa local sin escrituras: nuevo, cambia (antes/después), sin cambio y error; errores bloquean aplicar; avisos reutilizan revisarInstrumento y medias trimestrales.
- Aplicación transaccional, motivo de cinco caracteres mínimo, empresa del servidor, autorización tend_acceso admin/RS, controles RLS existentes, códigos normalizados, comprobación de concurrencia contra filas originales. Solo campos de plantilla: ausentes intactos, IDs/autores preservados, activo No desactiva. Auditoría existente por cada INSERT/UPDATE con tracea.motivo. No toca AT, semanas, snapshots ni motor.

## Equivalencias (sin columnas nuevas)
- HVAC: nombre → nombre_uma; áreas: clase → iso, sistema_hvac → hvac_id por código.
- Instrumentos: tipo_equipo → tipo; tipo_analisis → clase_instrumento; variable → parametro; area → area_id por código; unidad → escala_unidad.
- lie/lse → spec_lie/spec_lse; lie_estricto/lse_estricto → spec_lie_estricto/spec_lse_estricto; estado_especificacion → spec_estado; referencia_normativa → spec_referencia; criterio_interno → spec_criterio_interno; nota_especificacion → spec_nota; lie_hr/lse_hr → spec_lie_hr/spec_lse_hr. Texto de especificación automático con comparaciones.
- rango_op_min/rango_op_max → op_min_pa/op_max_pa; dp_base → baseline_pa; tolerancia_base_pct → baseline_tolerancia_pct; dp_saturacion → dp_final_fabricante. Los demás encabezados conservan su nombre.
- Objetivos: instrumento → instrumento_id; area_mayor/area_menor → cuarto_x_id/cuarto_y_id; valor → limite_normativo_pa; uso par de cuartos → tipo par_cuartos. Uso saturación actualiza dp_final_fabricante/unidad/activo del instrumento, ya que la base solo admite objetivos par_cuartos. Contradicciones entre ambas hojas bloquean.
- Se añaden a la hoja de objetivos encabezados de campos **existentes** codigo/nombre/activo para conservar objetivos múltiples e inactivos al reimportar; sin código nuevo se propone OBJ-<instrumento>. No se añaden columnas a la base.
- La lista de estado admite na además de pendiente/validada para conservar los instrumentos existentes sin especificación.

## Archivos
- src/modules/tendencias/CatalogoExcel.tsx, Catalogos.tsx, lib/catalogo-excel.ts.
- lib/__tests__/catalogo-excel.test.ts, catalogo-excel-sql.test.ts.
- Migraciones 0070 (RPC atómica), 0071 (concurrencia original y saturación del mismo archivo), 0072 (estado y contradicciones de saturación).
- AGENTS.md de Tendencias, roadmap.md y este informe.

## Verificación y límites
- Suite completa ejecutada. Plantilla XLSX real: exportar, leer y revisar sin cambios; validaciones, altas y cambios.
- Función SQL real copiada a tablas temporales PostgreSQL con constraints, solo referencia a empresa es_prueba: altas, relaciones HVAC/áreas/instrumentos/objetivos, saturación, cambio, desactivación, auditoría motivada, versión inválida y reversión de datos/auditoría tras error. ROLLBACK final; cero cambios en registros reales.
- No navegador ni llamadas IA ni cambios de dependencias. Skill XLSX orientó la plantilla.
- Prueba autenticada contra tablas productivas no ejecutada: la conexión sandbox no permite asumir authenticated ni ejecutar la RPC productiva. Los controles de acceso se mantienen, pero su prueba funcional corresponde a Jaime en adminqa.