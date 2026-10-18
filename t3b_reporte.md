# T3b — avance verificado

## Emisión y fuentes del Word

La selección por HVAC se resuelve en el servidor. Se rechaza la emisión si no hay instrumentos activos o registros activos seleccionados. 0055 congela los siguientes datos; 0056 alinea la precedencia HVAC con atdiafra (registro → área elegida → código libre), con prueba QA positiva/negativa:

|Dato usado|Fuente al emitir / lectura histórica|
|---|---|
|Nombre, logo, confidencialidad, versión del formato, firmantes, textos fijos y tabla ISO|tend_formato y perfil de empresa → formato_snapshot|
|Código AT, versión, estado, fecha de emisión, sistema, periodo y selección|tend_registros_at → datos_snapshot.registro_at|
|Textos §2, §8.1, §9, §10, §11 y justificaciones n<20|registro AT → datos_snapshot.registro_at.texto / justificaciones|
|Nombre/cargo del autor y emisor, autoemisión y suplencia|identidades guardadas por servidor → datos_snapshot.registro_at|
|RS sustituido|RS titular congelado en org_suplencias → registro_at.rs_sustituido_nombre|
|Registros, módulo, área, ISO y límites T/HR/ΔP|tend_registros seleccionados → datos_snapshot.registros|
|Lecturas, HR, fechas, horas, antefirmas, N/A, dudas, observaciones, origen, foto y objetivo por semana|tend_semanas seleccionadas → registros[*].semanas[*], conservando id|
|Instrumentos, código de bitácora, especificaciones/estrictos, rangos operativos, saturación y estado de validación|tend_instrumentos → datos_snapshot.instrumentos|
|Objetivos de presión|tend_objetivos_presion seleccionados/referidos por semanas → datos_snapshot.objetivos; el motor original calcula sobre límites ya guardados en registros/instrumentos, no se inventa una nueva fórmula|
|Áreas y clasificación|tend_areas → datos_snapshot.areas|
|Sistema HVAC, nombre UMA, descripción y etapas|tend_sistemas_hvac → datos_snapshot.hvac|
|Cambios de filtro|tend_cambios_filtro de instrumentos elegidos → datos_snapshot.cambios|
|Historial y registro sustituido|historial AT → datos_snapshot.historial / sustituye|
|Fecha de corte de calidad de datos|fecha del servidor al emitir → datos_snapshot.fecha_calculo|
|Tablas, estadísticas y gráficas|motor original ejecutado sobre los datos congelados anteriores|

Un emitido no consulta catálogos/formato vivos. La reconstrucción rechaza snapshots incompletos. El logo se conserva según el contenido configurado: la conservación de bytes de cualquier URL externa aún necesita revisión; no se declara independencia de recursos externos si se configuró una URL mutable.

## Pruebas

- Motor original 36/36; total 47/47, incluida regresión Word 1/1.
- Siete T2 completas y aviso admin=true/RS=false: pasan con rollback QA.
- HVAC positivo, instrumentos vacíos, registros vacíos, objetivos e id de semana: pasan con rollback QA.
- Manual/extracción sin motivo sobre lecturas previas: rechazadas; corrección motivada con anterior/nuevo auditados: pasa.
- Snapshot modificado por cliente: rechazado.
- Semana emitida editada manualmente o por extracción: ambas rechazadas.
- Source manual, mes/año servidor y RS sustituido desde suplencia: pasan.
- Registro AT abre en soporte adminqa sin errores de navegador; el listado estaba vacío. No prueba emisión/Word end-to-end.

## Pendiente, no se declara terminado

Paridad completa de captura/lotes y reporte consolidado, agrupaciones/pestañas de Cumplimiento, auditoría interna, entrega real de correo/reintentos, tres skills originales y extracción IA con revisión humana, descarga Word de AT real. La matriz conserva todos los faltantes; no se eliminaron del alcance.