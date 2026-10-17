# T2 — Tendencias: base de datos

## Resultado
Aplicada `0050_t2_tendencias_suplencias_beta.sql`. Sin pantallas ni funciones edge.
`tendencias` está en beta, solo activada manualmente para QA Brain adminqa.
No tiene precios ni planes; triggers impiden incorporarla comercialmente mientras sea beta.
No se activó en empresas reales. Las activaciones temporales para pruebas se revirtieron.
Bucket privado `tend-bitacoras`; lectura e inserción por empresa activa, sin sobrescritura/borrado.

## Verificación previa y diferencias autorizadas
- Diseño actual de atdiafra leído, referencia `ce2e802265c93248e33be4a8e58c057dc7fac5e6`.
- Clave existente `tendencias`, antes próximamente; no se creó `analisis_tendencias`.
- Acceso usa `contexto_org_actual`, `get_user_org_id`, `mi_org_tiene_modulo` y `org_tiene_modulo`, como Cerebro.
- Roles existentes: enum incluye admin, responsable_sanitario, operador, comite_tecnico, lectura y super_admin; en las membresías QA hay admin, RS y operador.
- No existía tabla de suplencias; creada `org_suplencias` compartida.
- No se creó `pares_cuartos`: el diseño vigente usa `objetivos_presion`.
- Identificadores `par_cuartos_id` conservados como referencias históricas opacas, no como claves foráneas a una tabla inexistente.
- `perfiles`, `user_roles`, `audit_log` e infraestructura de correo del origen no se duplican: se reutilizan los servicios existentes de TRACEA.
- Configuración singleton del origen pasa a configuración única por empresa; UUID y metadatos empresariales agregados.
- Columnas antiguas lie_pa/lse_pa conservadas y documentadas como deprecadas; límites normativos en spec_lie/spec_lse.
- No se copiaron datos, permisos públicos ni funciones de exportación Word del origen.

## Tablas creadas
`tend_sistemas_hvac`, `tend_areas`, `tend_instrumentos`, `tend_objetivos_presion`,
`tend_cambios_filtro`, `tend_registros`, `tend_semanas`, `tend_formato`, `tend_config`,
`tend_registros_at`, `tend_registros_at_historial` y `org_suplencias`.
Todas con RLS y auditoría. Las once tend_ contienen org_id, migrado_desde y metadatos de autor/modificador.

## Siete pruebas SQL ejecutadas
SQL completo reproducible: `t2_pruebas.sql`. Transacción con ROLLBACK, solo empresas es_prueba.
Las denegaciones verifican mensajes concretos o cero filas afectadas y contenido intacto;
no se aceptan errores de datos inválidos como prueba de permisos.

| Prueba | SQL central (dentro del contexto y las fixtures del archivo) | Resultado |
|---|---|---|
| 1. A no ve B | `SELECT id FROM tend_sistemas_hvac WHERE id=rb;` con control positivo ra | PASA: B oculta, A visible |
| 2. Empresa sin módulo no lee/escribe | `SELECT * FROM tend_sistemas_hvac; INSERT INTO tend_sistemas_hvac(org_id,codigo,nombre_uma) VALUES(b,'T2-X','X');` | PASA: lectura oculta, alta rechazada y UPDATE cero filas |
| 3. Consultor solo empresa activa | `SELECT get_user_org_id(); SELECT id FROM tend_sistemas_hvac WHERE id IN(ra,rb);` antes y después de cambiar empresa | PASA en ambas direcciones A/B |
| 4. Operador no emite | `UPDATE tend_registros_at SET estado='emitido' WHERE id=at_op;` | PASA: rechazado por rol, permanece borrador |
| 5. Elaborador no autoriza | `UPDATE tend_registros_at SET estado='emitido' WHERE id=at_rs;` como RS autor y autoemisión=false | PASA: rechazado por separación de funciones |
| 6. Historial inmutable | `UPDATE tend_registros_at_historial SET datos='{}' WHERE registro_id=at_op; DELETE FROM tend_registros_at_historial WHERE registro_id=at_op;` | PASA authenticated y service_role; historial generado e intacto |
| 7. Super_admin no escribe | `INSERT INTO tend_sistemas_hvac(...); INSERT INTO org_suplencias(...);` y UPDATE/DELETE sobre las doce tablas | PASA: SELECT positivo en soporte, escrituras denegadas |

Control positivo adicional: un RS distinto del elaborador emite correctamente y conserva nombre/cargo e historial.
Avisos verificados: alta admin → aviso_rs_requerido=true; alta RS → false; enviado_en/error vacíos.
El vencimiento de permisos es inmediato por fecha_fin; la auditoría de vencimiento se ejecuta cada hora.

## Pendiente T3
Envío de correo al RS al registrar suplencias y reintento de avisos pendientes, con la infraestructura existente,
junto con la pantalla de Suplencias. T2 no envía correo.

## Reversión
`t2_down.sql`, en la raíz, no ejecutado: deshabilita T2 preservando datos, historial, bitácora y archivos.
Secciones separadas para estructura y datos, sin destruir tablas ni registros.