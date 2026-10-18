# Matriz de equivalencia T3b

## Actualización de implementación y evidencia

Esta sección prevalece sobre el inventario previo que sigue abajo, conservado como referencia de lo encontrado antes de implementar. No se declara equivalencia completa.

|Función|Destino actual|Estado verificado / pendiente|
|---|---|---|
|Selección HVAC e instrumentos, periodo, textos, gráficas, borrador, emisión/nueva versión/anulación|/tendencias/analisis|Implementada; emisión HVAC, vacíos y guards probados en SQL QA; flujo completo de navegador pendiente|
|Word histórico|snapshot-forval16 + Analisis|Datos y fecha congelados, sin consultas de catálogos para emitidos; 1 regresión Word pasa; descarga de AT real pendiente|
|Registro AT, filtros y Excel|/tendencias/registro-at|Pantalla cargada en soporte QA sin errores; creación/exportación completa pendiente|
|Edición de semana con motivo|/tendencias/captura|RPC conectada; motivo/auditoría y rechazo de emitidos en ambas vías pasan SQL QA; lote necesita motivo por elemento|
|Cumplimiento|/tendencias/cumplimiento|Motor normativo copiado; filtros URL, selección, KPIs, detalle, Excel/PDF implementados; agrupaciones/pestañas y paridad completa pendientes|
|Reporte consolidado|/tendencias/reporte|Reutiliza provisionalmente Cumplimiento; NO reproduce avance/jerarquía/detalle fuente|
|Suplencias y aviso del encabezado|/tendencias/suplencias|Pantalla alta/revocación/historial creada; entrega correo/reintentos sin verificar|
|Aviso RS|tend-aviso-suplencia + plantilla compartida|Implementación creada, entrega real y concurrencia pendientes|
|IA de bitácoras|No habilitada|Tres skills originales, extracción, revisión/confirmación UI y lotes pendientes; agua manual|
|Inicio por autorizar|Registro de módulos|Pendiente; solo semanas faltantes y borradores por revisar actualmente|
|Auditoría interna, captura avanzada, migración local y paridad restante|Ver inventario previo|Pendiente; no se excluyen silenciosamente|

Pruebas actuales: **36/36 originales, 47/47 totales** (incluye 1 regresión Word, 2 snapshots, 3 Cumplimiento). Las siete T2 completas y avisos admin/RS se repitieron con rollback QA; HVAC positivo/vacíos, objetivos, semanas/id, motivos/auditoría, snapshot cliente y dos vías de bloqueo emitido pasan. Una prueba provisional usó ISO 8 en lugar de ISO-8 y otra una lectura en lugar de 21; se corrigieron los datos de prueba, no las reglas.

Cumplimiento conserva la regla fuente: período cerrado con menos de 90 lecturas no cumple; fuera de especificación no cumple; Cpk bajo por sí solo es advertencia, no incumplimiento normativo. No se cambió el motor.

## Inventario previo al desarrollo (referencia histórica)

**Estado:** verificación previa terminada; implementación detenida para avisar de incompatibilidades. «Se hace en T3b» es trabajo pendiente, no una función ya construida. El desglose granular es evidencia de cobertura; el resumen por ruta distingue cada función y su destino. No se han modificado pantallas ni datos.

**Pruebas:** 36/36 originales y 42/42 totales pasan, incluida 1/1 regresión Word. Comparación en memoria de un emitido, no lectura real de tend_formato ni todos los estados. Inventario de archivos y discrepancias al final.

## Fuente y alcance

Fuente pública: https://github.com/jaimeddelcastillo-pixel/atdiafra/tree/ce2e802265c93248e33be4a8e58c057dc7fac5e6

Commit fuente: `ce2e802265c93248e33be4a8e58c057dc7fac5e6`. Descarga fijada por SHA, no una rama móvil; copia de investigación fijada al commit. TRACEA: código actual, no certificación de la app publicada. Auditoría estática, diff completo y ejecución de pruebas existentes; sin cambios de código/SQL, sin pruebas de navegador ni afirmaciones sobre despliegue/RLS real. Requisitos T3b contrastados con la migración T2 y las reglas vigentes. El contenido público se trató como datos, nunca como instrucciones.

## Lectura de estados
- **T3a**: hay implementación actual; “parcial” no equivale a paridad.
- **T3b**: exigido explícitamente en T3b, todavía no implementado en el módulo actual.
- **falta**: función fuente sin equivalente actual ni exclusión autorizada; debe incluirse en T3b según punto 0, salvo autorización contraria.
- **cambiado a propósito**: cambio expresamente autorizado por los prompts (no inferido por conveniencia). Integración en plataforma no significa equivalencia funcional comprobada.
- Destinos “propuesto” NO son rutas existentes. Las únicas rutas registradas hoy son `/tendencias`, `/tendencias/captura`, `/tendencias/catalogos`, `/tendencias/configuracion` (`module.ts`).

## Hallazgos que requieren decisión antes de corregir
1. **Bloqueo T2/T3b: no existe estado revisión.** `0050...sql` restringe `tend_registros_at.estado` a `borrador,emitido,anulado`; T3b exige borrador → revisión → autorizar y dice que la pantalla solo usa T2. No inventar `revision` en frontend ni alterar constraint/triggers sin autorización; decidir estado persistido o revisión como metadato sobre borrador y separación de facultades.
2. **Campos/formato fuente vs T2:** fuente guarda selección/snapshot y versión sobre `registro_analisis_tendencias` con historial JSON; TRACEA usa `tend_registros_at`, `tend_registros_at_historial` y campos adicionales de suplencia/autoría. No es renombrado mecánico. Debe acordarse serialización/versionado inmutable, snapshot de identidad/formato, semántica de `emitido_by` vs `emitido_por`, identidad RS sustituido y captura de nombre/cargo antes de conectar Word. El motor Word actual no representa suplencia/Autoemitido según T3b.
3. **Identidad adaptada en T3a:** Jaime ya autorizó parametrizar nombre/logo/firmantes/leyenda; se identifican los archivos adaptados. No se detectaron cambios matemáticos en los cuatro motores nucleares ni en construirBloques. Las nuevas leyendas de suplencia/Autoemitido están pedidas en T3b, pero su representación de estados requiere precisar revisión y anulación.
4. **Funciones destructivas fuente:** eliminar registros/semanas/cambios de filtro/usuarios y fusionar borrando originales contradice la regla permanente de TRACEA «nada se elimina». Se mantienen en la matriz como **cambiado a propósito por conservación de datos**: retiro/anulación motivada o fusión con referencias a los originales, jamás DELETE. No se reintroduce eliminación ni se relaja T2.
5. **Paridad administrativa:** fuente administra usuarios y correo globalmente; no duplicar gestión de usuarios/auth de TRACEA dentro del módulo sin aprobación. Mapeo a plataforma es propuesto y no una exclusión tácita del alcance del punto 0.
6. **Presión/filtros/unidades y captura:** fuente distingue unidades, objetivo por semana, límites, etapas HVAC y selección/alta contextual; captura actual simplificada no los reproduce todos. `Tablero` fija filtros en Pa y agua en µS/cm, fuente extractor filtros declara inH₂O y no construye prompt de agua. Confirmar unidades y alcance de agua; no corregir cálculos ni inventar extractor silenciosamente.
7. **Skill exacta vs multiempresa:** prompt fuente incluye DIAFRA y heurísticas explícitas que corrigen años/dígitos; T3b pide texto v1.0 exacto y T3a pide sin DIAFRA fijo. Resolver parametrización conservando versión original; IA propone, jamás valida automáticamente. Fuente acepta agua en tipo pero `buildPrompt` retorna vacío: reportar esta limitación antes de extender.
8. **Regresión Word limitada:** existe prueba y pasa; no es una comparación end-to-end con una fila real de `tend_formato`, ni prueba de todas las variables/estados. Se alimenta formato en memoria, una serie T, logo/gráfica sintéticos; el mismo constructor local genera bloques para ambos generadores, por lo que no demuestra independencia de cálculo fuente. No declarar “Word idéntico en todos los casos”.
9. Configuración actual guarda formato y autoemisión en llamadas separadas; hay riesgo de guardado parcial y concurrencia en `version=max+1`. Acordar solución sin modificar T2 unilateralmente.
10. Firma electrónica Part 11, Cerebro, causa raíz y auditoría externa: expresamente fuera de T3b. Auditoría interna del módulo SÍ está incluida.

## Matriz funcional resumida por ruta
|Ruta fuente / función|TRACEA destino actual o propuesto|Estado|Discrepancia / condición|
|---|---|---|---|


### /
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|Cuatro tarjetas de módulos y acceso captura|/tendencias → captura|T3a|Existen; estado resumido solo semana actual|
|Avance semanal y alertas lecturas IA dudosas|Tablero / reporte propuesto|T3b|Falta detalle histórico y vínculo de revisión|
|Reporte consolidado; análisis y registro AT|rutas reporte propuestas|T3b|No existen enlaces ni páginas actuales|

### /modulo/$slug
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|Slugs presiones, temp-hr, filtros, agua; selector registro y semana|/tendencias/captura|T3a|Mapeo a presiones/temphr/filtros/agua, UI distinta|
|Alta registro y captura valores, hora, antefirma, observaciones, N/A|/tendencias/captura|T3a|Parcial: comprobar campos y validación, no equiparar a tabla fuente|
|Guardar / descartar / nueva semana / continuar con otra semana|/tendencias/captura|T3a|Guardar y semana por fecha existen; falta flujo postguardado y descartar explícito|
|Elegir área e instrumento, alta contextual, clasificación y límites|/tendencias/captura|falta|Alta simplificada no conserva todos los selectores/contexto|
|Objetivo presión por semana y configuración presión/etapa HVAC|/tendencias/captura|falta|No hay selector objetivo por semana equivalente|
|Corrección fecha de semana con confirmación|/tendencias/captura|falta|Cambiar fecha seleccionada no corrige registro guardado|
|Editar lectura guardada con motivo obligatorio|/tendencias/captura|falta|Captura actual no ofrece diálogo de motivo equivalente|
|Mover columna día izquierda/derecha y limpiar día|/tendencias/captura|falta|No implementado|
|Eliminar semana / registro zona con confirmación|/tendencias/captura|falta|Cambiado a propósito: retirar/anular con motivo; nunca borrar|
|Foto individual: cargar, abrir, reemplazar|/tendencias/captura|T3a|Carga y URL firmada; revisar PDF y reemplazo|
|Importador IA foto T/HR/presiones/filtros: comprimir, propuesta, confianza, revisar|/tendencias/captura|T3b|Solo archivo sin extracción actualmente|
|Lote fotos: reconocer, asignar, revisar, omitir/reintentar y confirmar|/tendencias/captura|T3b|Lote actual solo asigna registro/lunes y sube archivo|
|Análisis local, gráficas, periodo/atajos y PDF semanal|/tendencias/captura|falta|Motor copiado no equivale a UI conectada|

### /reporte/
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|Recargar y filtrar periodo, módulos, áreas, instrumentos|reporte consolidado propuesto|T3b|Página ausente|
|Vistas áreas/instrumentos/registros, navegación jerárquica y limpiar filtros|reporte consolidado propuesto|T3b|Ausente|
|Vista instrumentos: editar, PDF y Excel por instrumento|reporte consolidado propuesto|falta|Ausente|
|Vista avance: semanas anteriores/siguientes y exportar Excel|reporte consolidado propuesto|T3b|Ausente|
|Exportar consolidado Excel/PDF|reporte consolidado propuesto|T3b|Ausente|
|Fusionar duplicados y eliminar registro con confirmación|reporte consolidado propuesto|falta|Requiere decisión de permisos|
|Acceder normativo, análisis tendencias y registro AT|reporte consolidado propuesto|T3b|Ausente|

### /reporte/$id
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|Detalle guardado; volver y abrir edición|detalle propuesto|falta|Sin ruta equivalente|
|Eliminar registro con confirmación|detalle propuesto|falta|Cambiado a propósito: conservar original y retirar con motivo|

### /reporte/normativo
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|Recargar y copiar enlace con filtros URL|reporte normativo propuesto|falta|No hay página ni exportador normativo copiado|
|Periodo trimestre/año/rango; filtros módulo/área/HVAC y solo no conformes|reporte normativo propuesto|falta|No hay página ni exportador normativo copiado|
|Agrupar por área/instrumento; seleccionar todos/ninguno; remover chips/restablecer|reporte normativo propuesto|falta|No hay página ni exportador normativo copiado|
|Pestañas todos/áreas/instrumentos, ordenar columnas y expandir detalle|reporte normativo propuesto|falta|No hay página ni exportador normativo copiado|
|KPIs, cobertura mínimo normativo, Cpk, fuera especificación y detalle de serie|reporte normativo propuesto|falta|No hay página ni exportador normativo copiado|
|Exportar Excel y PDF de selección|reporte normativo propuesto|falta|No hay página ni exportador normativo copiado|

### /reporte/tendencias
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|Seleccionar sistema HVAC o instrumentos; año, T1–T4, S1/S2, anual y rango|análisis AT propuesto|T3b|Motor fechas intacto; UI ausente|
|Sugerir siguiente código AT; abrir reporte guardado por código/query|análisis AT propuesto|T3b|Usar máximo reservado también emitidos/anulados; no reutilizar|
|Calidad por instrumento y justificación obligatoria n<20|análisis AT propuesto|T3b|Bloquear todas exportaciones pertinentes|
|Gráficas/tabla por instrumento, punto naranja/rojo con fecha, lectura y regla|análisis AT propuesto|T3b|TendenciaCard no copiado|
|Editar/restablecer textos §2 §8.1 §9 §10 §11|análisis AT propuesto|T3b|Generador texto copiado; sin editor|
|Guardar borrador y selección/textos/justificaciones|análisis AT propuesto|T3b|Persistencia AT no conectada|
|Exportar paquete Excel/ZIP y gráficas todas ZIP|análisis AT propuesto|T3b|Exportador copiado parcialmente, sin interfaz|
|Copiar imagen, gráfica R, tabla; descargar PNG individual|análisis AT propuesto|T3b|UI ausente|
|Word borrador con marca y Word emitido limpio|análisis AT propuesto|T3b|Generador copiado, no conectado|
|Emitir: bloqueo por especificaciones y rol; nueva versión con motivo|análisis AT propuesto|T3b|T2 difiere; no implementar bypass|
|Historial de versiones solo lectura y cambios §13|análisis AT propuesto|T3b|Historial tabla existe; UI ausente|
|Autoemisión y etiqueta Autoemitido|análisis AT propuesto|T3b|Config existe; faltan flujo/Word|
|Flujo revisión y autorización RS/suplente|análisis AT propuesto|T3b|Estado revisión no existe en T2|

### /reporte/registro-at
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|Listado código/sistema/periodo/creación/modificación/versión/dictamen/estado|registro AT propuesto|T3b|Sin página actual|
|Buscar código; filtros año, sistema y estado|registro AT propuesto|T3b|Sin página actual|
|Abrir snapshot guardado por código|registro AT propuesto|T3b|Sin página actual|
|Exportar registro FOR-VAL-16-01 Excel; incorporar elaboró/autorizó y anulados tachados|registro AT propuesto|T3b|Sin página actual|

### /configuracion
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|Perfil nombre/cargo guardar|perfil organización/plataforma|cambiado a propósito|Reutilización plataforma requiere verificar equivalencia|
|Autoemisión toggle|/tendencias/configuracion|T3a|Existe|
|HVAC crear/editar/desactivar/activar y cancelar diálogo|/tendencias/catalogos|T3a|Formulario genérico|
|Áreas crear/editar/activar/desactivar, ISO y HVAC|/tendencias/catalogos|T3a|No clasificada corregida por 0051|
|Instrumentos crear/editar/activar/desactivar, filtros tipo/búsqueda|/tendencias/catalogos|T3a|Parcial: campos existen; faltan filtros y ayudas contextuales|
|Objetivos presión crear/editar/activar/desactivar y par cuartos/instrumento|/tendencias/catalogos|T3a|Parcial; verificar unicidad y validación contextual|
|Cambios filtros listar/agregar/eliminar|/tendencias/catalogos|T3a|Alta/editar; falta eliminación equivalente|
|Pendientes validación: contar, filtrar y resolver instrumentos/áreas|configuración propuesta|T3b|No existe tab|
|Formato: logo subir/quitar, versión, firmantes, textos fijos y tabla ISO, guardar nueva versión|/tendencias/configuracion|T3a|Adaptado a empresa; verificar equivalencia de interfaz logo y versionado|
|Migración local: detectar/importar/limpiar registros navegador|sin destino|falta|LocalMigrationCard no copiado|

### /admin/auditoria
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|Recargar; filtros tabla, operación, usuario/búsqueda y fecha|auditoría interna Tendencias propuesta|T3b|Sin interfaz module-specific actual|
|Abrir detalle JSON anterior/nuevo y cerrar diálogo|auditoría interna Tendencias propuesta|T3b|Sin interfaz module-specific actual|
|Historial AT: listar versiones, abrir snapshot solo lectura; admin y RS|auditoría interna Tendencias propuesta|T3b|Sin interfaz module-specific actual|

### /admin/usuarios
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|Recargar lista usuarios|gestión usuarios plataforma (fuera módulo)|falta|Gestión existente en /configuracion: lista/alta/roles/reset/desactivación; no duplicar. Invitación equivalente no verificada|
|Crear usuario email/contraseña/nombre/rol; cancelar/guardar|gestión usuarios plataforma (fuera módulo)|falta|Gestión existente en /configuracion: lista/alta/roles/reset/desactivación; no duplicar. Invitación equivalente no verificada|
|Invitar usuario email/nombre/rol; cancelar/enviar|gestión usuarios plataforma (fuera módulo)|falta|Gestión existente en /configuracion: lista/alta/roles/reset/desactivación; no duplicar. Invitación equivalente no verificada|
|Cambiar rol usuario|gestión usuarios plataforma (fuera módulo)|falta|Gestión existente en /configuracion: lista/alta/roles/reset/desactivación; no duplicar. Invitación equivalente no verificada|
|Eliminar usuario: confirmar/cancelar y protección usuario propio|gestión usuarios plataforma (fuera módulo)|falta|Gestión existente en /configuracion: lista/alta/roles/reset/desactivación; no duplicar. Invitación equivalente no verificada|
|Restablecer contraseña diálogo; enviar correo recuperación|gestión usuarios plataforma (fuera módulo)|falta|Gestión existente en /configuracion: lista/alta/roles/reset/desactivación; no duplicar. Invitación equivalente no verificada|

### /auth
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|Iniciar sesión|autenticación plataforma|cambiado a propósito|No migrar auth dentro del módulo; validar flujo existente|
|Crear cuenta|autenticación plataforma|cambiado a propósito|No migrar auth dentro del módulo; validar flujo existente|
|Olvidé contraseña: enviar y volver|autenticación plataforma|cambiado a propósito|No migrar auth dentro del módulo; validar flujo existente|
|Enlace TRACEA sitio actual|autenticación plataforma|cambiado a propósito|No migrar auth dentro del módulo; validar flujo existente|

### /reset-password
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|Validar sesión recuperación, nueva contraseña/confirmar, guardar y volver|recuperación plataforma|cambiado a propósito|No verificado en navegador|

### __root / compartido
|Función fuente|Destino TRACEA|Estado|Observación|
|---|---|---|---|
|404 volver al inicio; AuthGuard carga/redirige|router plataforma|cambiado a propósito|No crear cascarón alterno|
|Header inicio/configuración/admin/auditoría, perfil, cambiar contraseña y salir|header plataforma|cambiado a propósito|CambioPasswordDialog incluye contraseña actual/nueva/confirmación y cancelar|
|Logo y enlace TRACEA sitio actual|layout plataforma|cambiado a propósito|T3a exige conservar enlace login|

## Cambios deliberados T3b y funciones nuevas (no atribuirlos a fuente)
|Función|Destino|Estado|Condición|
|---|---|---|---|
|Anular AT por RS o suplente, no super_admin|Flujo AT propuesto|cambiado a propósito|Motivo obligatorio, actor y suplencia auditados|
|Borrador AT no se borra: se anula|Flujo AT propuesto|cambiado a propósito|También aplica la regla permanente de no eliminación a los demás registros|
|Emitir con nombre/cargo; frase suplencia con nombre RS|Word + registro|T3b|Necesita snapshot de identidad y adaptación autorizada de Word|
|Suplencias alta/revocar/historial/documento/periodo/facultades|Configuración organización|T3b|Tablas T2 existen; UI/correo no localizados en módulo|
|Banner suplencia vigente|Header compartido|T3b|Sin implementar en módulo|
|Correo RS requerido, fecha/error, reintento pendientes|Correo plataforma|T3b|No copiar infraestructura global independiente|
|Inicio: AT por autorizar para RS/suplente vigente|module.obtenerPendientes|T3b|Hoy solo semanas faltantes y borradores|
|Skill extraccion_bitacora v1.0, skills_usadas/modelo_ia e info super_admin|tend-extract-bitacora propuesto|T3b|No existe función ni conexión actual|
|Consumo empresa y límite si existe, sin bloquear si ausente|Extracción|T3b|No implementado|

## Edge functions, endpoints de servidor y correo (inventario completo)
|Fuente|Acciones/contrato|TRACEA|Estado / discrepancia|
|---|---|---|---|
|`supabase/functions/extract-bitacora/index.ts` (única edge function)|OPTIONS/CORS; POST imagenBase64/mediaType/module/variable/context; prompt por T/HR/presiones/filtros; llamada gateway IA; parse JSON y errores|`tend-extract-bitacora` propuesto|T3b; falta membresía org/módulo, skill, consumo y revisión humana; agua sin prompt fuente|
|`/lovable/email/auth/preview`|Previsualizar plantilla correo de auth|Infraestructura correo compartida|cambiado a propósito arquitectónico; no se probó paridad|
|`/lovable/email/auth/webhook`|Verificar evento auth y generar/encolar correo|Infraestructura compartida|cambiado a propósito; no endpoint Tendencias nuevo|
|`/lovable/email/queue/process`|Procesar cola de correo, errores/reintento|Infraestructura compartida|cambiado a propósito; conectar aviso RS en T3b sin duplicar|
|`src/lib/admin-users.functions.ts` + `.server.ts`|Server functions listar, crear, invitar, actualizar rol, eliminar, restablecer contraseña y recuperación; validación token/rol|Administración plataforma propuesta|falta equivalencia comprobada; NO son edge functions Supabase|

## Motor, archivos copiados y pruebas
Comparación de TODOS los archivos existentes bajo `src/modules/tendencias/lib` contra `src/lib` fuente. “Intacto” significa bytes idénticos, no solo lógica equivalente. Archivos solo TRACEA no se presentan falsamente como copiados.
|Archivo relativo|Clasificación|Diferencia|
|---|---|---|

|`__tests__/estadistica-pno.test.ts`|intacto|SHA-256 idéntico|
|`__tests__/fechas-lectura.test.ts`|intacto|SHA-256 idéntico|
|`__tests__/fixtures/ins-cmb-03-t-q1-2025.json`|intacto|SHA-256 idéntico|
|`__tests__/formato-atdiafra.reference.ts`|solo TRACEA|Sin homólogo con ese nombre en fuente|
|`__tests__/integracion.test.ts`|solo TRACEA|Sin homólogo con ese nombre en fuente|
|`__tests__/texto-forval16.test.ts`|adaptado|Véase diff íntegro en anexo|
|`__tests__/word-atdiafra.reference.ts`|solo TRACEA|Sin homólogo con ese nombre en fuente|
|`__tests__/word-regresion.test.ts`|solo TRACEA|Sin homólogo con ese nombre en fuente|
|`catalogos.ts`|adaptado|Véase diff íntegro en anexo|
|`estadistica-pno.ts`|intacto|SHA-256 idéntico|
|`export-forval16.ts`|adaptado|Véase diff íntegro en anexo|
|`fechas-lectura.ts`|intacto|SHA-256 idéntico|
|`formato-forval16.ts`|adaptado|Véase diff íntegro en anexo|
|`objetivos-presion.ts`|adaptado|Véase diff íntegro en anexo|
|`pendientes.ts`|solo TRACEA|Sin homólogo con ese nombre en fuente|
|`persistencia.ts`|solo TRACEA|Sin homólogo con ese nombre en fuente|
|`seleccion-forval16.ts`|adaptado|Véase diff íntegro en anexo|
|`semanas.ts`|adaptado|Véase diff íntegro en anexo|
|`statistics.ts`|intacto|SHA-256 idéntico|
|`texto-forval16.ts`|intacto|SHA-256 idéntico|
|`word-forval16.ts`|adaptado|Véase diff íntegro en anexo|

### Interpretación de adaptaciones
- `estadistica-pno.ts`, `statistics.ts`, `fechas-lectura.ts`, `texto-forval16.ts`: intactos; no diferencia matemática/textual detectada.
- `export-forval16.ts`: imports locales, argumento empresa y portada Excel sustituye DIAFRA por empresa; construcción de bloques y cálculos sin cambio detectado. Identidad autorizada por T3a §4, excepción a regla literal de §1 a ratificar.
- `word-forval16.ts`: nombre empresa/logo/leyenda dinámicos y placeholder empresa; conservar estructura. No incluye todavía nuevos textos Autoemitido/suplencia. No afirmar intacto.
- `formato-forval16.ts`: elimina persistencia original y firmantes DIAFRA; placeholder empresa; identidad opcional. Persistencia se traslada a `persistencia.ts` y tablas T2. Cambios de identidad pedidos, refactor superior a imports/tablas que debe quedar explícito.
- `catalogos.ts`: conserva tipos/defaults pero elimina helpers CRUD originales; reemplazo genérico en persistencia. No es una copia íntegra funcional.
- `semanas.ts`: ver diff, no asumir que todo soporte de captura fue copiado intacto.
- `__tests__/texto-forval16.test.ts`: solo import adaptado. Otros dos tests fuente y fixture intactos.
- Referencias `word-atdiafra.reference.ts`/`formato-atdiafra.reference.ts` son test doubles del generador/formato fuente, no una segunda aplicación independiente; diff de referencia abajo.

### Resultado de pruebas ejecutadas
`bunx vitest run src/modules/tendencias/lib/__tests__`: **5 archivos, 42/42 pruebas pasan**. Fuente: **36 pruebas** (20 estadística + 3 fechas + 13 texto), todas presentes y pasando en TRACEA. Adicionales: 5 integración + 1 Word. Salida completa `/tmp/t3b-tests.log`.
Regresión Word existente: mismo fixture `ins-cmb-03-t-q1-2025.json`, datos y formato DIAFRA en memoria, Word emitido, normaliza IDs y compara document/header/footer/numbering/styles XML, textos/tablas y bytes media. **Pasa**; no lee realmente tend_formato ni compara borrador, suplencia, autoemisión, otros instrumentos, PNG real ni todos los componentes DOCX. No se creó otra prueba porque ya existe y la orden vigente es investigación sin editar proyecto.

## Inventario exhaustivo de acciones por archivo/ruta (evidencia granular)
Las tablas siguientes desglosan cada línea de acción/diálogo/select/tab/submit encontrada en páginas y componentes de aplicación (excluye primitives UI genéricos sin lógica de negocio). Las filas de apertura/cierre/cancelación son parte de la funcionalidad, no rutas adicionales. Mismo componente compartido se asigna a sus rutas consumidoras; el resumen anterior aporta diferencias semánticas. Se incluyen manejadores además de botones para que exportaciones y acciones sin etiqueta visible no se omitan.


### __root — `src/routes/__root.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`7: function NotFoundComponent() {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`54: function RootShell({ children }: { children: React.ReactNode }) {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`70: function RootComponent() {`|plataforma compartida; paridad no probada|cambiado a propósito|

### /admin/auditoria — `src/routes/admin.auditoria.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`1: import { createFileRoute, Navigate } from "@tanstack/react-router";`|pantalla propuesta, inexistente hoy|T3b|
|`37: export const Route = createFileRoute("/admin/auditoria")({`|pantalla propuesta, inexistente hoy|T3b|
|`71: function AuditoriaPage() {`|pantalla propuesta, inexistente hoy|T3b|
|`79: function AuditoriaContent() {`|pantalla propuesta, inexistente hoy|T3b|
|`90:   const load = async () => {`|pantalla propuesta, inexistente hoy|T3b|
|`145:           <Button variant="outline" size="sm" onClick={load} disabled={loading}>`|pantalla propuesta, inexistente hoy|T3b|
|`157:               <Select value={tableFilter} onValueChange={setTableFilter}>`|pantalla propuesta, inexistente hoy|T3b|
|`168:               <Select value={opFilter} onValueChange={setOpFilter}>`|pantalla propuesta, inexistente hoy|T3b|
|`236:                           <Button`|pantalla propuesta, inexistente hoy|T3b|
|`239:                             onClick={() => setSelected(e)}`|pantalla propuesta, inexistente hoy|T3b|
|`255:       <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>`|pantalla propuesta, inexistente hoy|T3b|
|`256:         <DialogContent className="max-w-3xl">`|pantalla propuesta, inexistente hoy|T3b|
|`257:           <DialogHeader>`|pantalla propuesta, inexistente hoy|T3b|
|`258:             <DialogTitle>Detalle del cambio</DialogTitle>`|pantalla propuesta, inexistente hoy|T3b|
|`318: function HistorialAT() {`|pantalla propuesta, inexistente hoy|T3b|
|`351:                 <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setVer(f)}><Eye className="h-4 w-4" /></Button></TableCell>`|pantalla propuesta, inexistente hoy|T3b|
|`357:       <Dialog open={!!ver} onOpenChange={(o) => !o && setVer(null)}>`|pantalla propuesta, inexistente hoy|T3b|
|`358:         <DialogContent className="max-w-3xl">`|pantalla propuesta, inexistente hoy|T3b|
|`359:           <DialogHeader><DialogTitle>{ver?.codigo} · versión {ver?.version}</DialogTitle></DialogHeader>`|pantalla propuesta, inexistente hoy|T3b|

### /admin/usuarios — `src/routes/admin.usuarios.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`1: import { createFileRoute, Navigate } from "@tanstack/react-router";`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`54: export const Route = createFileRoute("/admin/usuarios")({`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`74: function formatDate(value: string &#124; null) {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`81: async function getAccessToken() {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`88: function UsuariosAdmin() {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`105:   const load = async () => {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`125:   const handleCreate = async (event: FormEvent<HTMLFormElement>) => {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`144:   const handleInvite = async (event: FormEvent<HTMLFormElement>) => {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`166:   const setUserRole = async (userId: string, newRole: AppRole) => {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`181:   const deleteUser = async (userId: string) => {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`195:   const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`223:   const sendRecovery = async (row: AdminUserView) => {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`253:               <Button`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`256:                 onClick={load}`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`263:               <Dialog open={openCreate} onOpenChange={setOpenCreate}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`264:                 <DialogTrigger asChild>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`265:                   <Button size="sm">`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`270:                 <DialogContent>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`271:                   <DialogHeader>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`272:                     <DialogTitle>Crear usuario</DialogTitle>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`273:                     <DialogDescription>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`277:                   <form className="space-y-4" onSubmit={handleCreate}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`302:                       <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`315:                     <DialogFooter>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`316:                       <Button`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`319:                         onClick={() => setOpenCreate(false)}`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`324:                       <Button type="submit" disabled={busy === "create"}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`333:               <Dialog open={openInvite} onOpenChange={setOpenInvite}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`334:                 <DialogTrigger asChild>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`335:                   <Button size="sm" variant="secondary">`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`340:                 <DialogContent>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`341:                   <DialogHeader>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`342:                     <DialogTitle>Invitar usuario</DialogTitle>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`343:                     <DialogDescription>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`347:                   <form className="space-y-4" onSubmit={handleInvite}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`363:                         onValueChange={(value) => setInviteRole(value as AppRole)}`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`377:                     <DialogFooter>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`378:                       <Button`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`381:                         onClick={() => setOpenInvite(false)}`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`386:                       <Button type="submit" disabled={busy === "invite"}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`447:                             onValueChange={(value) => setUserRole(row.user_id, value as AppRole)}`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`463:                           <Button`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`466:                             onClick={() => {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`479:                           <Button`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`482:                             onClick={() => sendRecovery(row)}`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`491:                           <AlertDialog>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`492:                             <AlertDialogTrigger asChild>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`493:                               <Button variant="destructive" size="sm" disabled={isMe &#124;&#124; actionBusy}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`498:                             <AlertDialogContent>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`499:                               <AlertDialogHeader>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`500:                                 <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`501:                                 <AlertDialogDescription>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`506:                               <AlertDialogFooter>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`507:                                 <AlertDialogCancel>Cancelar</AlertDialogCancel>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`508:                                 <AlertDialogAction onClick={() => deleteUser(row.user_id)}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`548:       <Dialog`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`558:         <DialogContent>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`559:           <DialogHeader>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`560:             <DialogTitle>Restablecer contraseña</DialogTitle>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`561:             <DialogDescription>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`565:           <form className="space-y-4" onSubmit={handleResetPassword}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`588:             <DialogFooter>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`589:               <Button`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`592:                 onClick={() => setResetTarget(null)}`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`597:               <Button type="submit" disabled={busy?.startsWith("pwd:")}>`|equivalencia pendiente de comprobar (ver resumen)|falta|

### /auth — `src/routes/auth.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`1: import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";`|plataforma compartida; paridad no probada|cambiado a propósito|
|`15: export const Route = createFileRoute("/auth")({`|plataforma compartida; paridad no probada|cambiado a propósito|
|`30: function AuthPage() {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`43:   const handleSignIn = async (e: FormEvent) => {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`55:   const handleSignUp = async (e: FormEvent) => {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`64:   const handleForgot = async (e: FormEvent) => {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`92:             <form onSubmit={handleForgot} className="space-y-4">`|plataforma compartida; paridad no probada|cambiado a propósito|
|`107:               <Button type="submit" className="w-full" disabled={busy}>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`110:               <Button`|plataforma compartida; paridad no probada|cambiado a propósito|
|`114:                 onClick={() => setShowForgot(false)}`|plataforma compartida; paridad no probada|cambiado a propósito|
|`122:                 <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`123:                 <TabsTrigger value="signup">Crear cuenta</TabsTrigger>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`126:                 <form onSubmit={handleSignIn} className="space-y-4 mt-4">`|plataforma compartida; paridad no probada|cambiado a propósito|
|`137:                         onClick={() => { setForgotEmail(email); setShowForgot(true); }}`|plataforma compartida; paridad no probada|cambiado a propósito|
|`145:                   <Button type="submit" className="w-full" disabled={busy}>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`151:                 <form onSubmit={handleSignUp} className="space-y-4 mt-4">`|plataforma compartida; paridad no probada|cambiado a propósito|
|`164:                   <Button type="submit" className="w-full" disabled={busy}>`|plataforma compartida; paridad no probada|cambiado a propósito|

### /configuracion — `src/routes/configuracion.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`1: import { createFileRoute, Link } from "@tanstack/react-router";`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`40: export const Route = createFileRoute("/configuracion")({`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`52: function ConfiguracionPage() {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`80:             <TabsTrigger value="hvac">Sistemas HVAC</TabsTrigger>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`81:             <TabsTrigger value="areas">Áreas</TabsTrigger>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`82:             <TabsTrigger value="instr">Instrumentos</TabsTrigger>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`83:             <TabsTrigger value="pares">Objetivos de presión</TabsTrigger>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`84:             <TabsTrigger value="pendientes">Pendientes de validación</TabsTrigger>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`85:             <TabsTrigger value="formato">Formato FOR-VAL-16-02</TabsTrigger>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`100: function MiPerfil() {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`108:   const guardar = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`122:         <Button onClick={guardar}>Guardar</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`128: function AutoemisionAjuste() {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`136:   const cambiar = async (v: boolean) => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`153: function HVACTab() {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`159:   const reload = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`167:   const onToggle = async (it: SistemaHVAC) => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`203:                 <Button size="sm" variant="ghost" onClick={() => { setEditing(it); setOpen(true); }}>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`206:                 <Button size="sm" variant="ghost" onClick={() => onToggle(it)}>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`220: function HVACDialog({ open, onOpenChange, item, onSaved }: {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`233:   const save = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`249:     <Dialog open={open} onOpenChange={onOpenChange}>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`250:       <DialogContent>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`251:         <DialogHeader><DialogTitle>{item ? "Editar" : "Nuevo"} sistema HVAC</DialogTitle></DialogHeader>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`258:         <DialogFooter>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`259:           <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`260:           <Button onClick={save}>Guardar</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`268: function AreasTab() {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`275:   const reload = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`287:   const onToggle = async (it: AreaClasificada) => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`319:                 <Button size="sm" variant="ghost" onClick={() => { setEditing(it); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`320:                 <Button size="sm" variant="ghost" onClick={() => onToggle(it)}><Power className={\`h-3.5 w-3.5 ${it.activo ? "text-destructive" : "text-success"}\`} /></Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`332: function AreaDialog({ open, onOpenChange, item, hvacs, onSaved }: {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`345:   const save = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`357:     <Dialog open={open} onOpenChange={onOpenChange}>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`358:       <DialogContent>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`359:         <DialogHeader><DialogTitle>{item ? "Editar" : "Nueva"} área clasificada</DialogTitle></DialogHeader>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`377:         <DialogFooter>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`378:           <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`379:           <Button onClick={save}>Guardar</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`394: function InstrumentosTab() {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`402:   const reload = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`432:   const onToggle = async (it: Instrumento) => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`486:                   <Button size="sm" variant="ghost" onClick={() => { setEditing(it); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`487:                   <Button size="sm" variant="ghost" onClick={() => onToggle(it)}><Power className={\`h-3.5 w-3.5 ${it.activo ? "text-destructive" : "text-success"}\`} /></Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`508: function InstrumentoDialog({ open, onOpenChange, item, areas, objetivosAsignados, labelObjetivo, onSaved }: {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`542:   const save = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`563:     <Dialog open={open} onOpenChange={onOpenChange}>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`564:       <DialogContent className="max-w-xl">`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`565:         <DialogHeader><DialogTitle>{item ? "Editar" : "Nuevo"} instrumento</DialogTitle></DialogHeader>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`665:         <DialogFooter>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`666:           <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`667:           <Button onClick={save}>Guardar</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`675: function ObjetivosTab() {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`683:   const reload = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`700:   const onToggle = async (it: ObjetivoPresion) => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`738:                 <Button size="sm" variant="ghost" onClick={() => { setEditing(it); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`739:                 <Button size="sm" variant="ghost" onClick={() => onToggle(it)}><Power className={\`h-3.5 w-3.5 ${it.activo ? "text-destructive" : "text-success"}\`} /></Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`758: function ObjetivoDialog({ open, onOpenChange, item, areas, instrs, onSaved }: {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`813:   const save = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`833:     <Dialog open={open} onOpenChange={onOpenChange}>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`834:       <DialogContent className="max-w-xl">`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`835:         <DialogHeader><DialogTitle>{item ? "Editar" : "Nuevo"} par de cuartos</DialogTitle></DialogHeader>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`890:         <DialogFooter>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`891:           <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`892:           <Button onClick={save}>Guardar</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`901: function CatalogShell({ title, onAdd, loading, children }: { title: string; onAdd: () => void; loading: boolean; children: React.ReactNode }) {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`906:         <Button size="sm" onClick={onAdd} className="gap-1"><Plus className="h-4 w-4" /> Nuevo</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`917: function Field({ label, children }: { label: string; children: React.ReactNode }) {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|

### / — `src/routes/index.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`1: import { createFileRoute, Link } from "@tanstack/react-router";`|/tendencias|T3a|
|`10: export const Route = createFileRoute("/")({`|/tendencias|T3a|
|`20: function Index() {`|/tendencias|T3a|

### /modulo/$slug — `src/routes/modulo.$slug.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`3: import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`38: export const Route = createFileRoute("/modulo/$slug")({`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`74: function ModuloPage() {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`104: function TempHRModule() {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`141:   const createRegistro = async () => {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`194:   const removeRegistro = async (id: string) => {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`231:                 <Button`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`235:                   onClick={() => setActiveId(null)}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`278:                 <Button onClick={createRegistro} className="w-full gap-1"><Plus className="h-4 w-4" /> Crear registro</Button>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`315: function RegistroEditor({ registro, onPersist, onDelete }: {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`336:   const handleExportPDF = async () => {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`472:   const handleSave = async () => {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`539:               <Button size="sm" variant="outline" className="gap-1">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`572:               <Button size="sm" onClick={handleExportPDF} disabled={exportingPDF} className="w-full gap-1">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`578:             <Button size="sm" variant="outline" onClick={() => addEmptyWeek()} className="gap-1">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`583:             <Button size="sm" variant="ghost" onClick={handleDiscard} className="gap-1">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`588:             <Button size="sm" onClick={handleSave} disabled={!dirty &#124;&#124; saving} className="gap-1">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`693:                       onClick={() => setActiveWeekId(s.id)}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`711:                         onClick={(e) => { e.stopPropagation(); deleteWeek(s.id); }}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`744:                 <Button size="sm" variant="ghost" onClick={() => deleteWeek(activeWeek.id)} className="text-destructive">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`756:           <Button size="lg" onClick={handleSave} disabled={saving} className="gap-2 shadow-lg">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`764:       <AlertDialog open={postSaveOpen} onOpenChange={setPostSaveOpen}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`765:         <AlertDialogContent>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`766:           <AlertDialogHeader>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`767:             <AlertDialogTitle>Registro guardado ✓</AlertDialogTitle>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`768:             <AlertDialogDescription asChild>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`800:           <AlertDialogFooter>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`801:             <AlertDialogCancel onClick={handleCerrarPostSave}>Cerrar (volver al tablero)</AlertDialogCancel>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`802:             <AlertDialogAction onClick={handleNuevoRegistro}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### /reporte/$id — `src/routes/reporte.$id.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`1: import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`17: function moduloSlug(m: Modulo): string {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`27: export const Route = createFileRoute("/reporte/$id")({`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`57: function DetallePage() {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`74:   const handleDelete = async () => {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`132:               <Button size="sm" variant="outline" onClick={handleDelete} className="gap-1 text-destructive hover:text-destructive">`|equivalencia pendiente de comprobar (ver resumen)|falta|

### /reporte/ — `src/routes/reporte.index.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`1: import { createFileRoute, Link } from "@tanstack/react-router";`|pantalla propuesta, inexistente hoy|T3b|
|`24: export const Route = createFileRoute("/reporte/")({`|pantalla propuesta, inexistente hoy|T3b|
|`34: function moduloSlug(m: string): string {`|pantalla propuesta, inexistente hoy|T3b|
|`45: function areaEfectiva(`|pantalla propuesta, inexistente hoy|T3b|
|`68: function etiquetaInstrumento(r: Registro, instrMap: Map<string, Instrumento>): string {`|pantalla propuesta, inexistente hoy|T3b|
|`78: function claveInstrumento(r: Registro): string {`|pantalla propuesta, inexistente hoy|T3b|
|`90: function consolidarPorInstrumento(regs: Registro[]): Registro[] {`|pantalla propuesta, inexistente hoy|T3b|
|`119: function ReportePage() {`|pantalla propuesta, inexistente hoy|T3b|
|`143:   const reload = async () => {`|pantalla propuesta, inexistente hoy|T3b|
|`233:   const handleDelete = async (id: string) => {`|pantalla propuesta, inexistente hoy|T3b|
|`244:   const handleFusionarGrupo = async (grupo: Registro[]) => {`|pantalla propuesta, inexistente hoy|T3b|
|`299:             <Button size="sm" variant="outline" onClick={reload} className="gap-1">`|pantalla propuesta, inexistente hoy|T3b|
|`302:             <Button size="sm" asChild disabled={loading} className="gap-1">`|pantalla propuesta, inexistente hoy|T3b|
|`307:             <Button size="sm" variant="outline" asChild className="gap-1">`|pantalla propuesta, inexistente hoy|T3b|
|`310:             <Button size="sm" variant="outline" onClick={() => onExport("excel")} disabled={loading} className="gap-1">`|pantalla propuesta, inexistente hoy|T3b|
|`313:             <Button size="sm" variant="outline" onClick={() => onExport("pdf")} disabled={loading} className="gap-1">`|pantalla propuesta, inexistente hoy|T3b|
|`325:                 <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !desde && "text-muted-foreground")}>`|pantalla propuesta, inexistente hoy|T3b|
|`349:                 <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !hasta && "text-muted-foreground")}>`|pantalla propuesta, inexistente hoy|T3b|
|`413:                       <Button key={p.label} size="sm" variant={on ? "secondary" : "ghost"} onClick={() => { setDesde(p.d); setHasta(p.h); }}>`|pantalla propuesta, inexistente hoy|T3b|
|`434:             <button key={k} onClick={() => setVista(k)}`|pantalla propuesta, inexistente hoy|T3b|
|`455:             onClick={() => { setAreaSel(null); setInstrSel(null); }}`|pantalla propuesta, inexistente hoy|T3b|
|`464:                 onClick={() => setInstrSel(null)}`|pantalla propuesta, inexistente hoy|T3b|
|`500:             <Button size="sm" variant="ghost" onClick={() => { setFiltroArea(""); setFiltroInstr(""); }}>`|pantalla propuesta, inexistente hoy|T3b|
|`522:                       <Button size="sm" variant="outline" onClick={() => handleFusionarGrupo(grupo)} className="gap-1">`|pantalla propuesta, inexistente hoy|T3b|
|`565: function TablaAreas({`|pantalla propuesta, inexistente hoy|T3b|
|`590:               <tr key={g.key} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => onSelect(g.key)}>`|pantalla propuesta, inexistente hoy|T3b|
|`609: function TablaInstrumentos({`|pantalla propuesta, inexistente hoy|T3b|
|`632:               <tr key={g.key} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => onSelect(g.key)}>`|pantalla propuesta, inexistente hoy|T3b|
|`650: function TablaRegistros({`|pantalla propuesta, inexistente hoy|T3b|
|`709:                           onClick={() => onDelete(r.id)}`|pantalla propuesta, inexistente hoy|T3b|

### /reporte/normativo — `src/routes/reporte.normativo.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`2: import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`47: export const Route = createFileRoute("/reporte/normativo")({`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`95: function trimestreActual(): Trimestre {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`100: function peorCpk(a: AnalisisRegistro): number &#124; null {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`105: function hayFueraSpec(a: AnalisisRegistro): number {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`115: function severidad(a: AnalisisRegistro): Severidad {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`123: function NormativoPage() {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`157:   const reload = async () => {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`277:   const handleCopyLink = async () => {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`340:             <Button size="sm" variant="outline" onClick={reload} disabled={loading} className="gap-1">`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`343:             <Button size="sm" variant="outline" onClick={handleCopyLink} className="gap-1">`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`346:             <Button size="sm" variant="outline" onClick={handleExcel} disabled={loading &#124;&#124; analisisTab.length === 0} className="gap-1">`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`358:             <Button size="sm" onClick={handlePDF} disabled={loading &#124;&#124; analisisTab.length === 0} className="gap-1">`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`369:               <Select value={tipo} onValueChange={(v) => updateSearch({ tipo: v as SearchState["tipo"] })}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`392:                 <Select value={String(trimestre)} onValueChange={(v) => updateSearch({ q: Number(v) as Trimestre })}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`426:               <Select value={modulo &#124;&#124; "all"} onValueChange={(v) => updateSearch({ modulo: v === "all" ? "" : v as Modulo })}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`436:               <Select value={filtroArea &#124;&#124; "all"} onValueChange={(v) => updateSearch({ area: v === "all" ? "" : v })}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`448:               <Select value={filtroHvac &#124;&#124; "all"} onValueChange={(v) => updateSearch({ hvac: v === "all" ? "" : v })}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`464:                     onClick={() => updateSearch({ agrupar: opt })}`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`497:                   <Button size="sm" variant="ghost" onClick={() => setSeleccionados(new Set(filtrados.map((r) => r.id)))}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`500:                   <Button size="sm" variant="ghost" onClick={() => setSeleccionados(new Set())}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`570:                     onClick={c.onRemove}`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`580:               <Button`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`584:                 onClick={() => updateSearch({ modulo: "", area: "", hvac: "", nc: false })}`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`594:           <Tabs value={tab} onValueChange={(v) => updateSearch({ tab: v as TabKey })}>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`596:               <TabsTrigger value="todos">Todos <Badge variant="secondary" className="ml-2">{analisisAll.length}</Badge></TabsTrigger>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`597:               <TabsTrigger value="areas">Áreas / pares <Badge variant="secondary" className="ml-2">{analisisAreas.length}</Badge></TabsTrigger>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`598:               <TabsTrigger value="instrumentos">Instrumentos <Badge variant="secondary" className="ml-2">{analisisInstrumentos.length}</Badge></TabsTrigger>`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`628:                     <SortableTh label="Registro" onClick={() => toggleSort("nombre")} active={sort === "nombre"} dir={dir} align="left" />`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`630:                     <SortableTh label="Lecturas" onClick={() => toggleSort("lecturas")} active={sort === "lecturas"} dir={dir} />`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`631:                     <SortableTh label={\`% vs ${MINIMO_NORMATIVO}\`} onClick={() => toggleSort("porcentaje")} active={sort === "porcentaje"} dir={dir} />`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`632:                     <SortableTh label="Cpk peor" onClick={() => toggleSort("cpk")} active={sort === "cpk"} dir={dir} />`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`633:                     <SortableTh label="Fuera spec" onClick={() => toggleSort("fuera")} active={sort === "fuera"} dir={dir} />`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`652:                           onClick={() => toggleExpand(a.registro.id)}`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`744: function SortableTh({`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`745:   label, onClick, active, dir, align = "center",`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`746: }: { label: string; onClick: () => void; active: boolean; dir: SortDir; align?: "left" &#124; "center" }) {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`750:         onClick={onClick}`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`760: function SerieDetail({ a }: { a: AnalisisRegistro }) {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`827: function KPI({ label, value, tone = "default" }: { label: string; value: string &#124; number; tone?: "default" &#124; "success" &#124; "warning" &#124; "destructive" }) {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`845: function fmtFechaISO(iso: string &#124; null): string {`|equivalencia pendiente de comprobar (ver resumen)|falta|

### /reporte/registro-at — `src/routes/reporte.registro-at.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`1: import { createFileRoute, Link } from "@tanstack/react-router";`|pantalla propuesta, inexistente hoy|T3b|
|`14: export const Route = createFileRoute("/reporte/registro-at")({`|pantalla propuesta, inexistente hoy|T3b|
|`38: function RegistroATPage() {`|pantalla propuesta, inexistente hoy|T3b|
|`92:           <Button variant="outline" className="gap-1" onClick={exportar} disabled={!visibles.length}><FileSpreadsheet className="h-4 w-4" /> Exportar registro</Button>`|pantalla propuesta, inexistente hoy|T3b|
|`97:           <Select value={anio} onValueChange={setAnio}>`|pantalla propuesta, inexistente hoy|T3b|
|`101:           <Select value={sistema} onValueChange={setSistema}>`|pantalla propuesta, inexistente hoy|T3b|
|`105:           <Select value={estado} onValueChange={setEstado}>`|pantalla propuesta, inexistente hoy|T3b|

### /reporte/tendencias — `src/routes/reporte.tendencias.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`1: import { createFileRoute, Link } from "@tanstack/react-router";`|pantalla propuesta, inexistente hoy|T3b|
|`30: export const Route = createFileRoute("/reporte/tendencias")({`|pantalla propuesta, inexistente hoy|T3b|
|`53: function periodosDe(y: number) {`|pantalla propuesta, inexistente hoy|T3b|
|`77: function TendenciasPage() {`|pantalla propuesta, inexistente hoy|T3b|
|`129:   const sugerirAT = async (y: number) => {`|pantalla propuesta, inexistente hoy|T3b|
|`201:   const guardar = async (): Promise<boolean> => {`|pantalla propuesta, inexistente hoy|T3b|
|`236:   const exportar = async () => {`|pantalla propuesta, inexistente hoy|T3b|
|`250:   const exportarWord = async () => {`|pantalla propuesta, inexistente hoy|T3b|
|`300:   const marcarEmitido = async () => {`|pantalla propuesta, inexistente hoy|T3b|
|`316:   const nuevaVersion = async () => {`|pantalla propuesta, inexistente hoy|T3b|
|`325:   const zipTodas = async () => {`|pantalla propuesta, inexistente hoy|T3b|
|`356:           <Button variant="outline" size="sm" asChild className="gap-1">`|pantalla propuesta, inexistente hoy|T3b|
|`398:                 <Select value={String(anio)} onValueChange={(v) => {`|pantalla propuesta, inexistente hoy|T3b|
|`410:                   <Button key={p.l} size="sm" variant={desde === p.d && hasta === p.h ? "default" : "outline"} onClick={() => { setDesde(p.d); setHasta(p.h); }}>{p.l}</Button>`|pantalla propuesta, inexistente hoy|T3b|
|`423:             <Button size="sm" variant={modo === "hvac" ? "default" : "outline"} onClick={() => setModo("hvac")}>Por sistema HVAC</Button>`|pantalla propuesta, inexistente hoy|T3b|
|`424:             <Button size="sm" variant={modo === "instrumentos" ? "default" : "outline"} onClick={() => setModo("instrumentos")}>Elegir instrumentos</Button>`|pantalla propuesta, inexistente hoy|T3b|
|`428:               <Select value={hvacId} onValueChange={setHvacId}>`|pantalla propuesta, inexistente hoy|T3b|
|`501:                 <Button size="sm" variant="outline" className="gap-1" onClick={zipTodas} disabled={ocupado}><Download className="h-4 w-4" /> Descargar todas (ZIP)</Button>`|pantalla propuesta, inexistente hoy|T3b|
|`513:                   <Button size="sm" variant="ghost" className="gap-1" disabled={soloLectura} onClick={() => { setTexto(textoAuto); setEditado(false); }}>`|pantalla propuesta, inexistente hoy|T3b|
|`521:                       <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={async () => {`|pantalla propuesta, inexistente hoy|T3b|
|`535:               <Button variant="outline" className="gap-1" onClick={() => { setOcupado(true); guardar().finally(() => setOcupado(false)); }} disabled={ocupado &#124;&#124; !puedeEditar &#124;&#124; conflicto &#124;&#124; soloLectura}>`|pantalla propuesta, inexistente hoy|T3b|
|`538:               <Button className="gap-1" onClick={exportar} disabled={ocupado &#124;&#124; !atValido &#124;&#124; conflicto &#124;&#124; faltaJustif.length > 0}>`|pantalla propuesta, inexistente hoy|T3b|
|`542:                 <Button variant="outline" className="gap-1" onClick={marcarEmitido} disabled={ocupado}><BadgeCheck className="h-4 w-4" /> Marcar como emitido</Button>`|pantalla propuesta, inexistente hoy|T3b|
|`545:                 <Button variant="outline" className="gap-1" onClick={nuevaVersion} disabled={ocupado}><Unlock className="h-4 w-4" /> Nueva versión</Button>`|pantalla propuesta, inexistente hoy|T3b|
|`547:               <Button variant="outline" className="gap-1" onClick={exportarWord} disabled={ocupado &#124;&#124; !registroEditable &#124;&#124; conflicto} title={!registroEditable ? "Guarda el registro AT para exportar el Word" : undefined}><FileText className="h-4 w-4" /> Exportar Word{registroEditable && !soloLectura ? " (borrador)" : ""}</Button>`|pantalla propuesta, inexistente hoy|T3b|

### /reporte — `src/routes/reporte.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`1: import { createFileRoute, Outlet } from "@tanstack/react-router";`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`3: export const Route = createFileRoute("/reporte")({`|equivalencia pendiente de comprobar (ver resumen)|falta|

### /reset-password — `src/routes/reset-password.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`1: import { createFileRoute, useNavigate } from "@tanstack/react-router";`|plataforma compartida; paridad no probada|cambiado a propósito|
|`11: export const Route = createFileRoute("/reset-password")({`|plataforma compartida; paridad no probada|cambiado a propósito|
|`26: function ResetPasswordPage() {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`46:   const handleSubmit = async (e: FormEvent) => {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`86:               <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`91:             <form onSubmit={handleSubmit} className="space-y-4">`|plataforma compartida; paridad no probada|cambiado a propósito|
|`112:               <Button type="submit" className="w-full" disabled={busy}>`|plataforma compartida; paridad no probada|cambiado a propósito|

### /lovable/email/auth/preview — `src/routes/lovable/email/auth/preview.ts`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`3: import { createFileRoute } from '@tanstack/react-router'`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`62: export const Route = createFileRoute("/lovable/email/auth/preview")({`|equivalencia pendiente de comprobar (ver resumen)|falta|

### /lovable/email/auth/webhook — `src/routes/lovable/email/auth/webhook.ts`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`6: import { createFileRoute } from '@tanstack/react-router'`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`39: function redactEmail(email: string &#124; null &#124; undefined): string {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`46: export const Route = createFileRoute("/lovable/email/auth/webhook")({`|equivalencia pendiente de comprobar (ver resumen)|falta|

### /lovable/email/queue/process — `src/routes/lovable/email/queue/process.ts`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`3: import { createFileRoute } from '@tanstack/react-router'`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`14: function isRateLimited(error: unknown): boolean {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`23: function isForbidden(error: unknown): boolean {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`31: function getRetryAfterSeconds(error: unknown): number {`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`39: async function moveToDlq(`|equivalencia pendiente de comprobar (ver resumen)|falta|
|`64: export const Route = createFileRoute("/lovable/email/queue/process")({`|equivalencia pendiente de comprobar (ver resumen)|falta|

### __root / compartido — `src/components/AppHeader.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`9: export function AppHeader() {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`16:   const handleLogout = async () => {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`83:             <Button variant="ghost" size="sm" onClick={handleLogout} title="Cerrar sesión" className="text-white hover:bg-white/10 hover:text-white">`|plataforma compartida; paridad no probada|cambiado a propósito|

### /modulo/$slug — `src/components/AreaSelector.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`18: export function AreaSelector({ value, areas, onChange, onCatalogChanged, defaultIso = "ISO-8" }: Props) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`23:   const guardar = async () => {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`62:         <Button type="button" size="sm" variant={adding ? "secondary" : "outline"} onClick={() => setAdding((v) => !v)} className="gap-1 shrink-0">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`79:           <Button type="button" size="sm" onClick={guardar} disabled={saving} className="w-full">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### __root / compartido — `src/components/AuthGuard.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`5: export function AuthGuard({ children }: { children: ReactNode }) {`|plataforma compartida; paridad no probada|cambiado a propósito|

### /configuracion — `src/components/CambiosFiltroEditor.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`8: export function CambiosFiltroEditor({ instrumentoId }: { instrumentoId: string }) {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`15:   const agregar = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`29:           <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label="Quitar cambio"`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`30:             onClick={async () => { try { await deleteCambioFiltro(c.id); cargar(); } catch (e) { toast.error((e as Error).message); } }}>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`38:         <Button type="button" size="sm" variant="outline" onClick={agregar}>Agregar</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|

### __root / compartido — `src/components/ChangePasswordDialog.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`17: export function ChangePasswordDialog({ trigger }: { trigger: ReactNode }) {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`23:   const handleSubmit = async (event: FormEvent) => {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`47:     <Dialog open={open} onOpenChange={setOpen}>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`48:       <DialogTrigger asChild>{trigger}</DialogTrigger>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`49:       <DialogContent>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`50:         <DialogHeader>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`51:           <DialogTitle>Cambiar mi contraseña</DialogTitle>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`52:           <DialogDescription>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`56:         <form className="space-y-4" onSubmit={handleSubmit}>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`79:           <DialogFooter>`|plataforma compartida; paridad no probada|cambiado a propósito|
|`80:             <Button`|plataforma compartida; paridad no probada|cambiado a propósito|
|`83:               onClick={() => setOpen(false)}`|plataforma compartida; paridad no probada|cambiado a propósito|
|`88:             <Button type="submit" disabled={busy}>`|plataforma compartida; paridad no probada|cambiado a propósito|

### /modulo/$slug — `src/components/CorregirFechaSemana.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`14: export function CorregirFechaSemana({ actual, existentes, onConfirm }: Props) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`21:       <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setValor(actual); setOpen(true); }}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`24:       <Dialog open={open} onOpenChange={setOpen}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`25:         <DialogContent className="max-w-sm">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`26:           <DialogHeader>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`27:             <DialogTitle>Corregir fecha de la semana</DialogTitle>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`28:             <DialogDescription>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`40:           <DialogFooter>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`41:             <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`42:             <Button disabled={!lunes &#124;&#124; lunes === actual &#124;&#124; ocupada} onClick={() => { onConfirm(lunes); setOpen(false); }}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### / — `src/components/CumplimientoCard.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`7: export function CumplimientoCard() {`|equivalencia pendiente de comprobar (ver resumen)|falta|

### /modulo/$slug — `src/components/EliminarRegistroZona.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`10: export function EliminarRegistroZona({ nombre, onConfirm }: { nombre: string; onConfirm: () => Promise<void> &#124; void }) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`23:       <Button size="sm" variant="outline" className="mt-3 gap-1 text-destructive hover:text-destructive"`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`24:         onClick={() => { setTexto(""); setOpen(true); }}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`27:       <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`28:         <DialogContent>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`29:           <DialogHeader>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`30:             <DialogTitle>Eliminar registro completo</DialogTitle>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`31:             <DialogDescription>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`36:           <DialogFooter>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`37:             <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`38:             <Button variant="destructive" disabled={!ok &#124;&#124; busy}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`39:               onClick={async () => { setBusy(true); try { await onConfirm(); setOpen(false); } finally { setBusy(false); } }}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### /configuracion — `src/components/FormatoForVal16Tab.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`12: async function logoADataURL(file: File): Promise<string> {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`25: export function FormatoForVal16Tab() {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`34:   const guardar = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`96:               <Button type="button" size="sm" variant="ghost" onClick={() => setF({ ...f, textos: { ...f.textos, [k]: FORMATO_DEFAULT.textos[k] } })}>Restaurar precargado</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`104:         <Button onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar nueva versión del formato"}</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|

### /modulo/$slug — `src/components/FotoSemana.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`6: export function FotoSemana({ path, semana }: { path?: string &#124; null; semana?: string }) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`29:       <button type="button" onClick={() => setOpen((v) => !v)}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### /modulo/$slug — `src/components/InstrumentoSelector.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`27: export function InstrumentoSelector({`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`36:   const guardar = async () => {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`88:         <Button`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`92:           onClick={() => setAdding((v) => !v)}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`118:             <Button type="button" size="sm" onClick={guardar} disabled={saving} className="gap-1">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### /configuracion — `src/components/LocalMigrationCard.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`8: export function LocalMigrationCard() {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`17:   const handleMigrate = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`50:             <Button size="sm" onClick={handleMigrate} disabled={busy} className="gap-1">`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`53:             <Button size="sm" variant="ghost" onClick={handleDiscard} disabled={busy}>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|

### /modulo/$slug — `src/components/LoteFotosImporter.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`50: function construir(modulo: Modulo, p: Parsed, lunes: string): Semana {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`70: function rehacerSemana(s: Semana, lunes: string): Semana {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`75: export function LoteFotosImporter({ modulo, context, disabled, semanasExistentes, onApply }: Props) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`93:   async function procesar() {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`108:           const { data, error } = await supabase.functions.invoke("extract-bitacora", {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`148:   function agregar(files: FileList &#124; File[]) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`167:   function integrar() {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`181:       <Button variant="outline" size="sm" className="gap-1" disabled={disabled} onClick={() => setOpen(true)}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`184:       <Dialog open={open} onOpenChange={(v) => { if (!running) setOpen(v); }}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`185:         <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`186:           <DialogHeader>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`187:             <DialogTitle>Carga de fotos por lote</DialogTitle>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`188:             <DialogDescription>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`213:                     <Button size="sm" variant="outline" className="h-6 px-2 text-xs"`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`214:                       onClick={() => {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`265:                         onClick={() => setItemsSync((p) => p.filter((x) => x.id !== it.id))}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`276:           <DialogFooter>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`277:             <Button variant="ghost" disabled={running} onClick={() => { setOpen(false); setItemsSync(() => []); }}>Cancelar</Button>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`278:             <Button disabled={running &#124;&#124; aprobados.length === 0} onClick={integrar}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### / — `src/components/ModuloCard.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`12: export function ModuloCard({ modulo }: Props) {`|equivalencia pendiente de comprobar (ver resumen)|falta|

### /configuracion — `src/components/PendientesValidacionTab.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`13: export function PendientesValidacionTab() {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`44:             <Button size="sm" variant={esPend(i) ? "default" : "outline"} onClick={() => setEdit(i)}>{esPend(i) ? "Validar" : "Editar"}</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`53: function ValidarDialog({ item, onClose, onSaved }: { item: Instrumento; onClose: () => void; onSaved: () => void }) {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`66:   const guardar = async () => {`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`97:     <Dialog open onOpenChange={(o) => !o && onClose()}>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`98:       <DialogContent className="max-w-lg">`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`99:         <DialogHeader><DialogTitle>Especificación normativa · {item.codigo}</DialogTitle></DialogHeader>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`124:         <DialogFooter>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`125:           <Button variant="outline" onClick={onClose}>Cancelar</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|
|`126:           <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>`|/tendencias/catalogos o configuracion (ver resumen)|T3a parcial / T3b / falta|

### __root / compartido — `src/components/TraceaLogo.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`6: export function TraceaLogo({ size = 36, className }: TraceaLogoProps) {`|plataforma compartida; paridad no probada|cambiado a propósito|

### __root / compartido — `src/components/TraceaSiteButton.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`11: export function TraceaSiteButton({ className }: TraceaSiteButtonProps) {`|plataforma compartida; paridad no probada|cambiado a propósito|
|`13:     <Button`|plataforma compartida; paridad no probada|cambiado a propósito|

### /modulo/$slug — `src/components/presiones/ImageImporterPresion.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`3: // Una sola variable. Llama a la edge function extract-bitacora con module="presiones".`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`18: export async function compressImage(file: File, maxDim = 2800, targetBytes = 4_000_000): Promise<{ base64: string; mediaType: string }> {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`48: function approxBytes(dataUrl: string): number {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`73: export function aplicarLecturas(s: Semana, fuente: IALectura[]) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`94: export function ImageImporterPresion({ context, semanaInicio, onExtracted, extra }: Props) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`104:   async function handleFile(file: File) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`110:       const { data, error: fnError } = await supabase.functions.invoke("extract-bitacora", {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### /modulo/$slug — `src/components/presiones/ObjetivoPresionSelector.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`31: export function ObjetivoPresionSelector({ value, objetivos, areas, instrumentos, onChange }: Props) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`70:             onClick={() => { setTipo(t); onChange(null); }}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### /modulo/$slug — `src/components/presiones/PresionAnalysis.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`17: function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" &#124; "warn" &#124; "bad" }) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`28: export function PresionAnalysis({ semanas, limiteMinPa }: Props) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### /modulo/$slug — `src/components/presiones/PresionesModule.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`40: export function PresionesModule() {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`77:   const createRegistro = async () => {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`138:   const removeRegistro = async (id: string) => {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`173:                 <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => setActiveId(null)}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`196:                 <Button onClick={createRegistro} className="w-full gap-1">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`214:                         onClick={() => setActiveId(r.id)}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`252: function RegistroEditorPresion({ registro, objetivos, onPersist, onDelete }: {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`284:   const handleExportPDF = async () => {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`444:   const handleSave = async () => {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`513:               <Button size="sm" variant="outline" className="gap-1">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`523:                 <button type="button" onClick={() => { const r = rangoDatos(); atajo(r.d, r.h); }}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`526:                   <button key={a} type="button" onClick={() => atajo(\`${a}-01-01\`, \`${a}-12-31\`)}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`544:               <Button size="sm" onClick={handleExportPDF} disabled={exportingPDF} className="w-full gap-1">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`550:             <Button size="sm" variant="outline" onClick={() => setNewWeekOpen(true)} className="gap-1">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`555:             <Button size="sm" variant="ghost" onClick={handleDiscard} className="gap-1">Descartar</Button>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`558:             <Button size="sm" onClick={handleSave} disabled={!dirty &#124;&#124; saving} className="gap-1">`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`631:                     onClick={() => setActiveWeekId(s.id)}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`644:                       onClick={(e) => { e.stopPropagation(); if (!canDelete) { toast.info("Solo el super admin puede eliminar semanas"); return; } deleteWeek(s.id); }}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`682:       <AlertDialog open={newWeekOpen} onOpenChange={setNewWeekOpen}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`683:         <AlertDialogContent>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`684:           <AlertDialogHeader>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`685:             <AlertDialogTitle>Nueva semana del mismo instrumento</AlertDialogTitle>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`686:             <AlertDialogDescription>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`705:           <AlertDialogFooter>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`706:             <AlertDialogCancel>Cancelar</AlertDialogCancel>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`707:             <AlertDialogAction onClick={handleCrearSemanaManual} disabled={!manualWeekDate}>Crear semana</AlertDialogAction>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`712:       <AlertDialog open={postSaveOpen} onOpenChange={setPostSaveOpen}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`713:         <AlertDialogContent>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`714:           <AlertDialogHeader>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`715:             <AlertDialogTitle>Cambios guardados</AlertDialogTitle>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`716:             <AlertDialogDescription asChild>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`741:           <AlertDialogFooter>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`742:             <AlertDialogCancel>Finalizar</AlertDialogCancel>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`743:             <AlertDialogAction onClick={handleNuevoRegistro}>Continuar con otra semana</AlertDialogAction>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### /modulo/$slug — `src/components/presiones/WeeklyReadingsTablePresion.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`17: function isOut(value: number &#124; null, min: number) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`21: function NumCell({ value, onCommit, className, title }: {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`59: export function WeeklyReadingsTablePresion({ semana, limiteMinPa, parLabel, yaGuardada = false, onChange }: Props) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`197:                 onClick={() => { setPendingEdit(null); setMotivo(""); }}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`202:                 onClick={confirmarEdicion}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### /reporte/ — `src/components/reporte/ReporteVistas.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`64: function fueraDeLimites(r: Registro, s: Semana, ins?: Instrumento): number {`|pantalla propuesta, inexistente hoy|T3b|
|`72: function construirFilas(`|pantalla propuesta, inexistente hoy|T3b|
|`123: function lunesDelPeriodo(desde: Date, hasta: Date): string[] {`|pantalla propuesta, inexistente hoy|T3b|
|`135: function estadoSemana(f: Fila, lunes: string, instrMap: Map<string, Instrumento>) {`|pantalla propuesta, inexistente hoy|T3b|
|`154: function Leyenda({ children }: { children: React.ReactNode }) {`|pantalla propuesta, inexistente hoy|T3b|
|`158: function useFiltro(filas: Fila[]) {`|pantalla propuesta, inexistente hoy|T3b|
|`179: function EditarLink({ f, children, className }: { f: Fila; children: React.ReactNode; className?: string }) {`|pantalla propuesta, inexistente hoy|T3b|
|`190: function descargarReporte(f: Fila, desde: Date, hasta: Date, formato: "pdf" &#124; "excel") {`|pantalla propuesta, inexistente hoy|T3b|
|`213: export function VistaInstrumentos({ registros, areaDe, instrMap, catalogo, areasMap, desde, hasta }: Props) {`|pantalla propuesta, inexistente hoy|T3b|
|`277:                             <Button type="button" size="sm" variant="outline" asChild`|pantalla propuesta, inexistente hoy|T3b|
|`285:                           <Button type="button" size="sm" onClick={() => descargarReporte(f, desde, hasta, "pdf")}`|pantalla propuesta, inexistente hoy|T3b|
|`290:                           <Button type="button" size="sm" variant="outline" onClick={() => descargarReporte(f, desde, hasta, "excel")}`|pantalla propuesta, inexistente hoy|T3b|
|`313: export function VistaAvance({ registros, areaDe, instrMap, catalogo, areasMap, desde, hasta }: Props) {`|pantalla propuesta, inexistente hoy|T3b|
|`406:         <Button size="sm" variant="outline" onClick={exportar} className="gap-1 mt-3">`|pantalla propuesta, inexistente hoy|T3b|
|`413:           <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" aria-label="Semanas anteriores" onClick={() => desplazar(-1)} disabled={scrollPos <= 0}>`|pantalla propuesta, inexistente hoy|T3b|
|`430:           <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" aria-label="Semanas siguientes" onClick={() => desplazar(1)} disabled={scrollPos >= scrollMax - 1}>`|pantalla propuesta, inexistente hoy|T3b|

### /modulo/$slug — `src/components/temp-hr/ImageImporter.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`19: async function compressImage(file: File, maxDim = 2800, targetBytes = 4_000_000): Promise<{ base64: string; mediaType: string }> {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`54: function approxBytes(dataUrl: string): number {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`83: function normDia(s?: string): Dia &#124; null {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`87: function normTurno(s?: string): Turno &#124; null {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`94: export function aplicarLecturas(`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`123: export function ImageImporter({ context, semanaInicio, onExtracted, extra }: Props) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`135:   async function handleFile(file: File) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`142:       const { data, error: fnError } = await supabase.functions.invoke("extract-bitacora", {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`256:               <button key={v} onClick={() => setModo(v)}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### /modulo/$slug — `src/components/temp-hr/TempHRAnalysis.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`25: function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" &#124; "warn" &#124; "bad" }) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`37: function AnalysisBlock({ semanas, cfg }: { semanas: Semana[]; cfg: VarConfig }) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`161: export function TempHRAnalysis({ semanas, iso }: Props) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### /modulo/$slug — `src/components/temp-hr/WeeklyReadingsTable.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`14: function isOut(value: number &#124; null, min: number, max: number) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`28: function NumCell({ value, onCommit, className, title }: NumCellProps) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`69: export function WeeklyReadingsTable({ semana, iso, yaGuardada = false, onChange }: Props) {`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`227:               onClick={() => setDayNA(di, !naActivo)}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`255:                 onClick={() => shiftDay(di, -1)}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`264:                 onClick={() => clearDay(di)}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`272:                 onClick={() => shiftDay(di, 1)}`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`320:         <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setPendingEdit(null)}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`321:           <div className="w-full max-w-md rounded-lg bg-card border border-border p-5" onClick={(e) => e.stopPropagation()}>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`336:               <button onClick={() => setPendingEdit(null)} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancelar</button>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|
|`337:               <button onClick={confirmEdit} disabled={!motivo.trim()} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-50">Confirmar</button>`|/tendencias/captura (ver resumen para cada brecha)|T3a parcial / falta|

### /reporte/tendencias — `src/components/tendencias/TendenciaCard.tsx`
|Línea fuente y acción exacta|Destino|Estado|
|---|---|---|
|`32: async function svgFijo(b: Bloque, g: Grafica, w: number, h: number): Promise<{ svg: SVGSVGElement; limpiar: () => void }> {`|pantalla propuesta, inexistente hoy|T3b|
|`49: export async function pngsDeTarjeta(_root: HTMLElement &#124; null, b: Bloque): Promise<{ nombre: string; blob: Blob }[]> {`|pantalla propuesta, inexistente hoy|T3b|
|`66: function ticksSemana(xMin: number, xMax: number): number[] {`|pantalla propuesta, inexistente hoy|T3b|
|`75: function Grafico({ b, g, ratio, fijo }: { b: Bloque; g: Grafica; ratio?: string; fijo?: { w: number; h: number } }) {`|pantalla propuesta, inexistente hoy|T3b|
|`125: function Punto({ b, active, payload }: { b: Bloque; active?: boolean; payload?: { payload: { _p?: PuntoTendencia } }[] }) {`|pantalla propuesta, inexistente hoy|T3b|
|`143: export function tablaHTML(b: Bloque): { html: string; texto: string } {`|pantalla propuesta, inexistente hoy|T3b|
|`165: export function TendenciaCard({ b }: { b: Bloque }) {`|pantalla propuesta, inexistente hoy|T3b|
|`171:   const copiar = async (i: number) => {`|pantalla propuesta, inexistente hoy|T3b|
|`179:   const descargar = async () => {`|pantalla propuesta, inexistente hoy|T3b|
|`183:   const copiarTabla = async () => {`|pantalla propuesta, inexistente hoy|T3b|
|`250:         <Button size="sm" variant="outline" className="gap-1" onClick={() => copiar(0)}><Copy className="h-3.5 w-3.5" /> Copiar imagen</Button>`|pantalla propuesta, inexistente hoy|T3b|
|`251:         {b.graficas.length > 1 && <Button size="sm" variant="outline" className="gap-1" onClick={() => copiar(1)}><Copy className="h-3.5 w-3.5" /> Copiar gráfica R</Button>}`|pantalla propuesta, inexistente hoy|T3b|
|`252:         <Button size="sm" variant="outline" className="gap-1" onClick={copiarTabla}><Table2 className="h-3.5 w-3.5" /> Copiar tabla</Button>`|pantalla propuesta, inexistente hoy|T3b|
|`253:         <Button size="sm" variant="ghost" className="gap-1" onClick={descargar}><Download className="h-3.5 w-3.5" /> Descargar PNG</Button>`|pantalla propuesta, inexistente hoy|T3b|



# T3b — Inventario de archivos copiados en T3a

Origen: `jaimeddelcastillo-pixel/atdiafra`, commit `ce2e802265c93248e33be4a8e58c057dc7fac5e6` (2026-10-14). Destino de bibliotecas: `src/modules/tendencias/lib/`.

| Archivo origen | Estado | Diferencia en TRACEA |
|---|---|---|
| estadistica-pno.ts | Intacto | Contenido idéntico. |
| statistics.ts | Intacto | Contenido idéntico. |
| fechas-lectura.ts | Intacto | Contenido idéntico. |
| texto-forval16.ts | Intacto | Contenido idéntico. |
| export-forval16.ts | Adaptado | Imports locales; empresa parametrizada en portada Excel. Construcción de bloques y cálculos sin cambios. |
| seleccion-forval16.ts | Adaptado | Solo imports locales. |
| word-forval16.ts | Adaptado | Identidad/logo/confidencialidad/autor del documento parametrizados; sin logo DIAFRA de respaldo; comprobaciones de canvas/Blob nulos. Estructura, cálculos y texto original restante conservados. |
| formato-forval16.ts | Adaptado | Identidad parametrizada y firmantes sin personas fijas; `{empresa}` en objetivo; persistencia trasladada al adaptador empresarial. |
| catalogos.ts | Adaptado | Conserva modelos y escalas; funciones de persistencia trasladadas al adaptador empresarial, sin eliminación. |
| objetivos-presion.ts | Adaptado | Conserva modelos; persistencia trasladada al adaptador empresarial. |
| semanas.ts | Adaptado | Conserva modelos y lógica de lecturas; persistencia/localStorage/migración legacy trasladados o no expuestos; sin borrado de semanas. |
| __tests__/estadistica-pno.test.ts | Intacto | 20 pruebas originales. |
| __tests__/fechas-lectura.test.ts | Intacto | 3 pruebas originales. |
| __tests__/texto-forval16.test.ts | Adaptado | Solo import local; 13 pruebas originales. |
| __tests__/fixtures/ins-cmb-03-t-q1-2025.json | Intacto | Mismo fixture. |
| word-forval16.ts → __tests__/word-atdiafra.reference.ts | Adaptado | Imports de prueba, logo de prueba en lugar del import JPG y comprobaciones nulas; identidad y generador originales para comparación. |
| formato-forval16.ts → __tests__/formato-atdiafra.reference.ts | Adaptado | Conserva valores/firmantes/textos originales; sin acceso a datos ni funciones de persistencia. |

## Archivos propios de TRACEA, no copias literales
`module.ts`, `Marco.tsx`, `Tablero.tsx`, `hooks.ts`, `Catalogos.tsx`, `Captura.tsx`, `Configuracion.tsx`, `lib/persistencia.ts`, `lib/pendientes.ts`, `lib/__tests__/integracion.test.ts`, `lib/__tests__/word-regresion.test.ts`.

Las pantallas originales **no** se copiaron literalmente: T3a creó pantallas de TRACEA que todavía no incluyen todas las acciones del origen. La matriz de equivalencia identifica las diferencias pendientes; «T3a cerrado» no equivale a equivalencia completa de todas las funciones de atdiafra.

## Copias todavía pendientes de T3b
Reportes, gráficas, registro AT y sus auxiliares (incluidos `normativo.ts`, `export-normativo.ts`, `chart-renderer.ts`, `imagen-grafica.ts`, `fotos-bitacora.ts` y `export-utils.ts`) y `extract-bitacora/index.ts` se inventarían en la matriz. No se han copiado ni implementado en esta verificación previa.

## Resultado de pruebas
Nueva ejecución: **36/36 originales y 42/42 totales**, incluida la regresión Word (1/1). Alcance y limitaciones documentados en `t3b_verificacion_previa.md`.

# T3b — Verificación previa

## Resultado
No se han cambiado pantallas, cálculos, textos, permisos ni datos de Tendencias. La implementación se detiene ante incompatibilidades con T2, conforme al requisito de avisar antes de corregirlas. La matriz exhaustiva se entrega por separado en `t3b_matriz_equivalencia.md`.

## Regresión de Word y motor
- Ejecución nueva: `bunx vitest run src/modules/tendencias/lib/__tests__`: **42/42**, cinco archivos de pruebas, incluida **1/1 regresión Word**.
- El origen tiene 36 pruebas: 20 de estadística, 3 de fechas y 13 de textos. TRACEA conserva esas pruebas y añade cinco de integración y una de Word.
- La regresión usa el mismo fixture `ins-cmb-03-t-q1-2025.json`, identidad DIAFRA de prueba, mismos firmantes y logo proporcionado a ambos generadores.
- Compara cinco partes del documento: `document.xml`, `header1.xml`, `footer1.xml`, `numbering.xml` y `styles.xml`, normalizando identificadores de relaciones; compara asimismo tablas, textos y bytes de imágenes.
- Alcance exacto: prueba automática en memoria de un Word emitido, **no** lectura real de `tend_formato`, ni comparación binaria completa del ZIP, ni Word borrador. Las pruebas de navegador son de Jaime, como pide T3b.
- La referencia local Word se cotejó con el origen: diferencias solo de imports/logo de prueba y comprobación de canvas/Blob nulos. La referencia de formato conserva los valores originales, sin funciones de persistencia. No se modificó ninguna referencia ni cálculo.

## Incompatibilidades confirmadas en la base actual
| Requisito | Situación actual | Decisión antes de corregir |
|---|---|---|
| Borrador → revisión → emisión | Los únicos estados son borrador, emitido y anulado; el origen tampoco tiene estado revisión. | Elegir revisión como etapa persistida o como revisión del borrador sin nuevo estado. |
| Anular un borrador con motivo | El control actual solo permite anular emitidos. RS/suplente elaborador o modificador tampoco puede anular su propia versión. | Permitir borrador → anulado, conservando motivo y separación de funciones, sin dar escritura a super_admin. |
| Correo de suplencia y registrar resultado | El control de suplencias permite únicamente revocar; rechaza modificar enviado/error incluso con un cliente de servicio sin actor. | Operación servidor específica, autenticada y auditada, que solo registre el resultado del aviso. |
| Nombre histórico del RS sustituido | Se conservan nombre/cargo del suplente y del autorizador, no el nombre del RS sustituido. | Conservar esa identidad al emitir, sin reconstruirla usando un RS posterior. |
| Trazabilidad y consumo por extracción | T2 no tiene registros de extracción ni contador de esta función. El origen solo devuelve el consumo; no lo conserva. | Añadir almacenamiento de propuestas y consumo, con límite exclusivamente desde plan_limites. |
| Prompt original, sin identidad DIAFRA fija | El origen trae tres prompts según sistema, todos con DIAFRA fijo; para agua devuelve texto vacío. | Autorizar parametrizar únicamente identidad y registrar las variantes en la skill; decidir cómo abordar agua sin inventar un prompt «original». |
| Textos/estructura Word intactos y nuevas etiquetas | El origen no representa suplencia, Autoemitido ni anulado. | Añadir solo las leyendas expresamente pedidas, sin alterar estructura/cálculos; decidir si un anulado se exporta y con qué marca. |
| Abrir un emitido tal como se guardó | AT no congela la versión de formato ni todos los datos del reporte; el origen tampoco garantiza esa congelación. | Guardar instantáneas para nuevas emisiones; no inventar identidad o datos de emisiones históricas. |

## Semánticas existentes que no se corrigen por cuenta propia
- `version` aumenta en cada guardado/cambio de estado; coincide con atdiafra. No se introduce un contador documental independiente sin autorización.
- `autoemitido` solo es verdadero cuando el RS elaborador/modificador emite con la excepción empresarial encendida; no significa simplemente que el interruptor esté encendido. La excepción nunca aplica al suplente.
- El motivo de una nueva versión está en la nueva fila y aparece en el historial en la siguiente operación; no se reescriben las instantáneas previas.
- La insuficiencia de muestra (<20) se verifica antes de exportar; no se afirma que T2 ya aplique esta condición en la emisión.

## Fuera de alcance
No se toca Riesgos ni Cerebro. No se añade firma electrónica Part 11 (Fase 5), causa raíz ni auditoría externa. Ninguna prueba se ejecuta contra datos reales DIAFRA. No se publica la aplicación.