# Matriz completa de equivalencia atdiafra → TRACEA — cierre solicitado T3b

## Criterio y evidencia

Fuente inspeccionada: `/tmp/t3b-atdiafra` (archivo fuente previamente descargado). La matriz anterior identificaba revisión `ce2e802265c93248e33be4a8e58c057dc7fac5e6`; el archivo no conserva Git y no permite verificar ese SHA independientemente. Destino: `src/modules/tendencias/` y servicios compartidos TRACEA.

**Hecho**: implementación localizada; solo los casos expresamente indicados en Evidencia están probados de principio a fin. **Falta**: implementación ausente, parcial o conexión incompleta. **Cambiado a propósito**: decisión autorizada, con motivo. Una fila mixta distingue lo disponible de lo faltante: no declara paridad completa.

Prefijos: `D/` = `src/modules/tendencias/`; `S/` = `src/` de atdiafra. Las agrupaciones enumeran todos los controles del archivo fuente revisado, no solo sus rutas.

### Cambios deliberados obligatorios

| Elemento | TRACEA | Estado y motivo |
|---|---|---|
| Anular AT, incluido borrador | `D/Analisis.tsx`, `tend_at_guard`, migración 0058 | **Cambiado a propósito**: solo RS o suplente vigente con facultad anular; nunca super_admin, autor ni admin por sí solos. Motivo obligatorio. |
| Borrar borrador | Estado anulado; código e historial conservados | **Cambiado a propósito**: se anula, no se borra; conservación y auditoría. |
| Emitir y consultar documentos | Snapshot servidor al emitir; Word desde snapshot | **Cambiado a propósito**: identidad/selección histórica inmutable, empresa activa y separación de funciones. |
| Revisión como estado separado | Borrador → emitido/anulado | **Cambiado a propósito**: T2 aprobado mantiene solo tres estados; revisión humana dentro del borrador. |
| Formatos diferentes por módulo | Configuración FOR-VAL-16-02 actual y exportador normativo compartido | **Cambiado a propósito**: formatos por módulo quedan para una fase posterior; no se implementaron en este cierre. |
| Catálogo fijo y marca DIAFRA | Catálogos por empresa, nombre/logo configurados | **Cambiado a propósito**: multiempresa; no cargar datos reales DIAFRA en pruebas ni fijarlos globalmente. |
| Agua con IA | Captura manual, función rechaza agua | **Cambiado a propósito**: no existe prompt efectivo de agua en la fuente; no inventar skill. |
| Super_admin | Lectura en soporte vigente registrado | **Cambiado a propósito**: no escribe tend_ ni suplencias, no confirma IA, emite ni anula. |

## 1. Cada ruta y pantalla fuente

| Ruta / archivo atdiafra | Ubicación TRACEA | Estado |
|---|---|---|
| `/`, `routes/index.tsx` | `/tendencias`, `D/Tablero.tsx` | **Hecho T3c-2**: cuatro tarjetas de captura, tarjetas Reporte/Cumplimiento y aviso de lecturas dudosas guardadas o en propuestas pendientes. |
| `/modulo/$slug`, `routes/modulo.$slug.tsx` | `/tendencias/captura?modulo=…`, `D/Captura.tsx` | **Hecho parcial**: captura/selección/fotos; controles avanzados abajo. |
| `/reporte`, `routes/reporte.tsx` (Outlet) | Registro `D/module.ts`, `D/Marco.tsx` | **Cambiado a propósito**: router y marco compartidos. |
| `/reporte/`, `routes/reporte.index.tsx` | `/tendencias/reporte`, `D/Reporte.tsx`, `ReporteVistas.tsx` | **Hecho T3c-2**: consolidado, jerarquía, detalle y precargas. Exportador general exacto **pospuesto por decisión de Jaime**; se conserva el normativo. |
| `/reporte/$id`, `routes/reporte.$id.tsx` | `/tendencias/reporte/:id`, `D/ReporteDetalle.tsx` | **Hecho T3c-2**: lecturas por semana, volver, editar y retirar con motivo/confirmar/cancelar; RPC conserva historial y rechaza inputs emitidos. |
| `/reporte/normativo`, `routes/reporte.normativo.tsx` | `/tendencias/cumplimiento`, `D/Cumplimiento.tsx` | **Hecho** con interacción distinta; diferencias abajo. |
| `/reporte/tendencias`, `routes/reporte.tendencias.tsx` | `/tendencias/analisis`, `D/Analisis.tsx` | **Hecho**: flujo AT; limitaciones históricas/documentales abajo. |
| `/reporte/registro-at`, `routes/reporte.registro-at.tsx` | `/tendencias/registro-at`, `D/RegistroAT.tsx` | **Hecho**: listado/filtros/abrir/Excel. |
| `/configuracion`, `routes/configuracion.tsx` | `/tendencias/catalogos`, `/tendencias/configuracion`; perfil compartido | **Hecho parcial / cambiado a propósito**: separar catálogos, formato y perfil. |
| `/admin/auditoria`, `routes/admin.auditoria.tsx` | `src/pages/Auditoria.tsx`, historial individual en Análisis | Filtros/explorador específico **pospuesto por decisión de Jaime**; auditoría compartida conservada. |
| `/admin/usuarios`, `routes/admin.usuarios.tsx` | Gestión compartida `src/pages/Configuracion.tsx` y funciones administrativas | **Cambiado a propósito**: no duplicar gestión; equivalencia de todas las acciones no verificada. |
| `/auth`, `routes/auth.tsx` | Login/Register/Recuperar compartidos | **Cambiado a propósito**: identidad/sesión única; recorridos de recuperación no probados en este cierre. |
| `/reset-password`, `routes/reset-password.tsx` | `src/pages/ResetPassword.tsx` | **Cambiado a propósito**: recuperación compartida. |
| `routes/__root.tsx`, router y árbol generado | `src/App.tsx`, registro de módulos, guards y layout | **Cambiado a propósito**: React Router/plataforma; carga/404/volver compartidos. |
| `/lovable/email/auth/preview` | Infraestructura compartida de correo | **Cambiado a propósito**: no crear endpoint paralelo; equivalencia exacta no verificada. |
| `/lovable/email/auth/webhook` | Auth email hook compartido | **Cambiado a propósito**: servicio existente, no replicar cola fuente. |
| `/lovable/email/queue/process` | Envío directo compartido | **Cambiado a propósito**: infraestructura TRACEA sin cola fuente. |
| Nueva TRACEA: suplencias (sin ruta fuente) | `/tendencias/suplencias`, `D/Suplencias.tsx` | **Hecho**: alta, revocación, historial, banner y aviso/reintento. |

Las diez rutas del módulo están registradas. **Hecho T3c-2**: Reporte y Cumplimiento tienen tarjetas de Tablero y entradas propias del menú lateral; detalle registrado en `module.ts`.

## 2. Botones, campos y acciones por pantalla/componente

| Archivo/componente fuente | Cada control o acción | Destino | Estado / diferencia |
|---|---|---|---|
| `ModuloCard`, `CumplimientoCard` | Cuatro módulos; contadores/avance; aviso de dudosos; acceso Cumplimiento | Tablero y pendientes | **Hecho T3c-2** módulos/avance, tarjetas Reporte/Cumplimiento y aviso de lecturas dudosas pendientes. |
| `modulo.$slug` | Elegir módulo, registro y semana; abrir semana; volver/listado | Captura | **Hecho**, presentación propia. |
| Mismo | Nuevo registro; nombre/instrumento/área/ISO/HVAC/etapa/límites/unidad; alta contextual | Captura y Catálogos | **Hecho** nombre, instrumento, objetivo presión y contexto derivado. **Hecho T3c-1**: área/HVAC/etapa/límites/unidad y altas de área/instrumento. Alta de catálogos solo admin por permiso aprobado, no se amplía al operador. |
| Mismo | Guardar, descartar, añadir semana, cerrar/continuar después de guardar | Captura | **Hecho** guardar/seleccionar semana; **hecho T3c-1** descarte explícito y diálogo postguardado. |
| Mismo | Corregir fecha, colisión, confirmar/cancelar; eliminar semana/registro | Sin equivalentes completos | **Hecho T3c-1** corregir lunes, colisión, cancelar y retiro motivado; **cambiado a propósito** no DELETE. |
| `WeeklyReadingsTable`, `WeeklyReadingsTablePresion` | T/HR/presión/filtro/agua; valor/hora/antefirma/N/A; colores; edición motivada | Tabla de Captura | **Hecho** valores/horas/N/A/dudosos/autor; motivo semanal auditado. **Hecho T3c-1** antefirma editable; motivo semanal centralizado y auditado en servidor en vez de diálogo por lectura. |
| Mismos | N/A día entero; mover día izquierda/derecha; limpiar día | Captura / captura-controles | **Hecho T3c-1**: tres turnos, T y HR; mover conserva hora/antefirma destino como fuente. |
| `PresionesModule`, `ObjetivoPresionSelector` | Objetivo par/manómetro/HEPA; límites/baseline/objetivo semanal | Captura y Catálogos | **Hecho T3c-1**: objetivo semanal, selector manómetro/HEPA, límites/contexto de áreas y alertaBaseline original conectada. |
| `AreaSelector` | Seleccionar; abrir alta, código/nombre/ISO; guardar/cancelar | Catálogos separado | **Hecho T3c-1**: selección y alta contextual código/nombre/ISO/HVAC, cancelar/guardar; solo admin. |
| `InstrumentoSelector` | Seleccionar, filtrar/contexto; alta código/bitácora; guardar/cancelar | Captura y Catálogos | **Hecho T3c-1**: alta contextual, código duplicado, área/bitácora/especificación, filtro por tipo; solo admin. |
| `FotoSemana` | Subir, reemplazar referencia, abrir | Captura, persistencia | **Hecho** almacenamiento privado/URL firmada; también permite guardar PDF, pero IA solo PNG/JPEG. |
| `ImageImporter`, `ImageImporterPresion` | Seleccionar imagen; extraer; propuesta/confianza; corregir; integrar; cancelar | ExtraccionBitacora, Captura, extraccion.ts | **Hecho** extracción individual T/HR, presión y filtros; revisión explícita, dudosos bloquean. **Hecho T3c-1** compresión derivada antes de envío y fecha detectada confirmable/corregible. |
| Mismos | `aplicarLecturas`, `compressImage`, encabezados/fechas | propuestaSemana; lectura privada | **Hecho** mapa 21 celdas sin desplazar días; **hecho T3c-1** compresión y propuesta de lunes detectado, confirmada por capturista. |
| `LoteFotosImporter` | Añadir/arrastrar; progreso; procesar secuencial; detectar fecha/duplicados; previsualizar; incluir/omitir; corregir lunes; reintentar; integrar/cancelar | Fotos por lote de Captura | **Hecho T3c-1**: agregar/arrastrar, progreso secuencial, propuesta independiente por foto, duplicados, previsualización, omitir, corregir lunes, revisión y confirmar. Fallos recuperables aislados; reintento por foto fallida, confirmación reintentable sin repetir IA; bloques terminales detienen llamadas. Dos propuestas QA confirmadas y leídas tras recarga. |
| `reporte.index` | Recargar; fechas/año/T1–T4/S1/S2/anual; buscar; limpiar filtros | Reporte | **Hecho**. |
| Mismo | Áreas → instrumentos → registros; volver; vistas área/instrumento/avance | Reporte/ReporteVistas | **Hecho** jerarquía/área efectiva. |
| Mismo | Excel/PDF consolidado; consolidar/detectar duplicados/fusionar/eliminar | Reporte, avance, export-normativo | **Hecho** consolidación en memoria y descargas. **Cambiado a propósito** conservar originales; fusión persistente **pospuesto por decisión de Jaime**; retiro motivado ya disponible. |
| `VistaInstrumentos` | Buscar, catálogo completo/sin capturas, KPIs; editar/ver bitácora/análisis; PDF/Excel individual | ReporteVistas | **Hecho T3c-2** vista/descargas y precarga de registroId en Captura, ids/fechas en Análisis. |
| `VistaAvance` | Matriz semanal/leyenda/KPIs; anterior/siguiente; Excel | ReporteVistas y avance | **Hecho** hasta 60 lunes, desplazamiento y exportación. |
| `reporte.$id` | Detalle, volver, editar, eliminar con confirmar/cancelar | ReporteDetalle | **Hecho T3c-2**; eliminación sustituida por retiro motivado mediante RPC existente, nada se borra. |
| `reporte.normativo` | Recargar/copiar enlace; trimestre/año/rango; módulo/área/HVAC; solo no conformes | Cumplimiento | **Hecho**; error de portapapeles no tratado explícitamente; área/HVAC usan campos directos. |
| Mismo | Todos/áreas-pares/instrumentos; ordenar; cobertura; KPIs antes de filtrar | Cumplimiento | **Hecho**, orden selector distinto de cabeceras fuente. |
| Mismo | Todos/ninguno/individual; chips removibles; restablecer; expandir detalle/series/capacidad/OOS | Cumplimiento | **Hecho**. |
| Mismo | Agrupar por registro/área/HVAC/módulo; Excel/PDF | Cumplimiento, export-normativo | **Hecho** exportación; **falta** interacción jerárquica exacta. PDF de Cumplimiento explícitamente tabular, sin gráficas; PDF consolidado de Reporte sí las incluye. |
| `reporte.tendencias` | Selección HVAC/instrumentos; fechas/presets; año; calidad; justificación n<20 | Análisis | **Hecho**; año derivado de fecha, no selector independiente. |
| Mismo | Sugerir código siguiente; recuperar por código/query | registros-at y Análisis | **Cambiado a propósito** código servidor; **falta** sugerencia/recuperación por código (usa `?at=id`). |
| Mismo | Editar §2/§8.1/§9/§10/§11; restablecer; guardar borrador | Análisis, texto-forval16 | **Hecho**. |
| Mismo | Word; Excel/ZIP paquete; ZIP gráficas; emitir; nueva versión/motivo; anular/motivo; cerrar/cancelar | Análisis, registros-at, generadores | **Hecho T3c-2**, autorización RS/suplente y snapshot; Word anulado con ANULADO, motivo y fecha. Sin snapshot no se reconstruye exportación calculada. |
| Mismo | Historial; JSON anterior/nuevo; abrir versión; cambios §13 | Análisis | **Hecho T3c-2**: modo histórico identificado, controles de escritura bloqueados y regreso a versión actual; sin snapshot solo consulta de textos/metadata. |
| Mismo | Autoemitido/suplencia; firma/fecha/nombre/cargo | Configuración, guards y Word | **Hecho** leyendas y snapshots; no certifica todos los casos de autoemisión. |
| `TendenciaCard` | Gráficas, puntos/tooltip/reglas/carta R/tabla; copiar imagen/R/tabla; PNG individual | TendenciaCard | **Hecho**; botones individuales no pasan por bloqueo global n<20 de Análisis. |
| `reporte.registro-at` | Tabla código/sistema/periodo/versión/estado/dictamen/fechas/firmantes; filtros; actualizar; abrir; nuevo; Excel | RegistroAT | **Hecho T3c-2**: anulados tachados en pantalla y Excel (xlsx-js-style). |
| Configuración perfil | Nombre/cargo; guardar | Configuración compartida | **Cambiado a propósito** perfil único; no duplicarlo. |
| Configuración HVAC | Alta/editar; código/UMA/descripción/etapas; activo; guardar/cancelar/cerrar | Catálogos | **Hecho**, formulario genérico. |
| Configuración áreas | Alta/editar; código/nombre/ISO/HVAC; activo; guardar/cancelar | Catálogos | **Hecho**. |
| Configuración instrumentos | Código/bitácora/tipo/área/libre/parámetro/especificación/rangos/baseline/saturación; activo; guardar/cancelar | Catálogos | **Hecho parcial** campos principales/normativos; **falta** búsqueda/filtros/ayudas contextuales y comprobar semántica antigua lie_pa/lse_pa. |
| Configuración objetivos | Par X/Y/manómetro/HEPA/instrumento/ISO/unidad/límites; activo; guardar/cancelar | Catálogos | **Hecho**, ayudas/validación contextual no idénticas. |
| `CambiosFiltroEditor` | Listar por instrumento; fecha/nota; agregar/quitar | Catálogos | **Hecho** listar/crear/editar; **hecho T3c-1** retiro motivado; filtro contextual sigue **falta** para T3c-2; **cambiado a propósito** no borrar. |
| `PendientesValidacionTab` | Contar/filtrar; validar/editar/N/A; límites/HR/área/referencia/fecha; guardar/cancelar | Campos normativos Catálogos | **Hecho T3c-2**: bandeja con conteos únicos/especificación/área, filtros de búsqueda/tipo/área/pendiente, validar/editar/N/A, referencia y fecha; guardado auditado existente, solo admin. N/A solo especificación. |
| `FormatoForVal16Tab` | Logo/versiones/firmantes/textos/ISO; guardar nueva versión; restaurar sección/quitar logo | Configuración | **Hecho** cargar/reemplazar/guardar; restaurar textos por sección y quitar logo **pospuesto por decisión de Jaime**. Formatos por módulo después. |
| `LocalMigrationCard` | Detectar locales/importar/resultado/limpiar | Sin equivalente | **No aplica**: TRACEA no tiene datos en el navegador que migrar. |
| Auditoría e `HistorialAT` | Recargar; tabla/operación/actor/búsqueda/fechas; abrir/cerrar valores; buscar código/actor/versiones/snapshot | Auditoría compartida e historial individual | **Hecho T3c-2** historial individual solo lectura; filtros específicos de Auditoría/explorador global **pospuesto por decisión de Jaime**. |
| Admin usuarios | Recargar; crear email/password/rol; invitar; cambiar rol; reset/confirmar; recuperación; cancelar/cerrar; eliminar | Gestión compartida | **Cambiado a propósito** no duplicar; desactivar en vez de borrar; **falta verificación** uno a uno de invitación/recuperación. |
| Auth/Reset/ChangePasswordDialog | Login/signup/email/password; olvidé/enviar/volver; nueva/confirmar; guardar/cancelar/cerrar | Auth compartida | **Cambiado a propósito**; recorridos no verificados en este cierre. |
| AppHeader/AuthGuard/TraceaLogo/TraceaSiteButton | Inicio/configuración/admin/auditoría/perfil/password/salir; sesión/carga/404/volver; logo/tracea.site | Layout/guards/plataforma | **Cambiado a propósito** integración única; conservar tracea.site; no equivalencia visual literal. |

## 3. Cada exportación y función de biblioteca fuente

| Archivo fuente | Todas las exportaciones de negocio | TRACEA y estado |
|---|---|---|
| `statistics.ts` | descriptive, capability, zoneOf, westernElectric, fmt | `D/lib/statistics.ts`: **hecho**, motor intacto. |
| `estadistica-pno.ts` | subgruposPorDia, descriptivaPNO, fueraDeSpec, limitesAlertaAccion, limitesDesdeParametros, cartaXbarR, cartaXbarMRR, etiquetaCapacidad, capacidad, normalidad, senalesFueraDeControl, suficienciaMuestra, dictamen; CONSTANTES_XR, E2_MR, D2_MR, TEXTO_INVESTIGAR_CAUSA_ESPECIAL | Homónimo: **hecho**, motor intacto. |
| `fechas-lectura.ts` | fechaRealISO, esLecturaUtil, recortarSemanasPorFecha, coberturaReal | Homónimo: **hecho**, intacto. |
| `normativo.ts` | trimestreDeFecha, rangoPeriodo, semanasDelPeriodo, diasHabilesEntre, analizarRegistro, evaluarRegistro, conclusionRegistro, evaluarLote, detectarNoConformidades, esRegistroDeInstrumento, claveGrupo, etiquetaGrupo, tipoRegistroReporte, etiquetaTipoRegistro, tituloReporteDeModulos; MINIMO_NORMATIVO, N_MINIMO_CPK, CPK_WARN, CPK_FAIL, PCT_SPEC_FAIL, ETIQUETA_CONTROL, ETIQUETA_CAPACIDAD, ETIQUETA_CUMPLIMIENTO, ETIQUETA_CATEGORIA | Homónimo: **hecho**, motor intacto. |
| `texto-forval16.ts` | listaEs, fraseCantidad, nombreVariable, ubicacionTxt, dictamenGlobal, fraseEstacional, accionDe, fraseSenales, generarTexto; SECCIONES | Homónimo: **hecho**, intacto. |
| `export-forval16.ts` | serial, fmtDMY, pasoRedondo, escala, etiquetaPeriodo, specTxt, dictTxt, construirBloques, exportarPaqueteForVal16 | Homónimo/Análisis: **hecho**, identidad/imports adaptados; paquete Excel/ZIP. |
| `word-forval16.ts` | sinAcentos, nombreArchivoWord, generarWordForVal16 | Homónimo/Análisis: **hecho**, snapshots/identidad/firmantes; borrador marcado y emitido limpio. Limitación anulado en §5. |
| `export-normativo.ts` | exportarNormativoExcel, exportarNormativoPDF | Homónimo: **hecho**, seis hojas Excel y PDF con gráficas/identidad parametrizada. |
| `export-utils.ts` | exportarReporteExcel, exportarReportePDF | **Pospuesto por decisión de Jaime**: exportadores generales exactos; se usa normativo en Reporte. No declarar hojas/layout idénticos. |
| `chart-renderer.ts` | generarBloqueEstadisticoRegistro, generarChartsRegistro | Homónimo: **hecho**, canvas guard añadido; gráficas especificación y alerta/acción. |
| `imagen-grafica.ts` | layoutPNG, graficaPNG, descargarBlob, copiarImagen, copiarHTML; PX_16x9, PX_16x5, ESCALA_PNG | Homónimo: **hecho**, canvas guards. |
| `TendenciaCard.tsx` | leyendaDe, nombreArchivo, pngsDeTarjeta, tablaHTML, TendenciaCard | Homónimo: **hecho**. |
| `formato-forval16.ts` | cargarFormato, guardarFormato, sustituir; SECCIONES_FIJAS, FORMATO_DEFAULT | Constantes/helper homónimos y persistencia: **hecho / cambiado a propósito**, formato versionado por empresa. |
| `catalogos.ts` | listSistemasHVAC, upsertSistemaHVAC, setSistemaHVACActivo; listAreas, upsertArea, setAreaActivo; listInstrumentos, upsertInstrumento, setInstrumentoActivo; listCambiosFiltro, addCambioFiltro, deleteCambioFiltro; ISO_CLASES, ISO_LIMIT_PA, ISO_TEMP_HR | Constantes homónimas; listarCatalogo/guardarCatalogo/Catálogos: **hecho parcial**; deleteCambioFiltro no migrado por conservación, retiro **hecho T3c-1** mediante tend_retirar, sin DELETE. |
| `objetivos-presion.ts` | listObjetivosPresion, upsertObjetivoPresion, setObjetivoPresionActivo, describirLimite, alertaBaseline; TIPO_OBJETIVO_LABEL | Helpers homónimos y persistencia genérica: **hecho parcial**; alertaBaseline original y selector conectados T3c-1; ayudas de catálogo adicionales T3c-2. |
| `seleccion-forval16.ts` | unirPorInstrumento, hvacDe, codigoRegistro; MODULOS_TENDENCIA | Homónimo: **hecho**, adaptado/conectado. |
| `semanas.ts` utilidades | lunesDe, nombreMes, semanaVacia, lecturasEsperadas, lecturasCapturadas, esSemanaCompleta, esSemanaVacia, rangoFechasRegistro, nombreRegistroConFechas, detectarDuplicados, flattenLecturas; DIAS, TURNOS, DIAS_NO_LABORABLES_DEFAULT | Homónimo: **hecho**, adaptado. |
| `semanas.ts` persistencia | listRegistros, getRegistro, upsertRegistro | listarRegistros/guardarRegistro/guardarSemana: **cambiado a propósito**, empresa activa y RPC motivada. |
| `semanas.ts` conservación | fusionarRegistros, deleteRegistro | **Cambiado a propósito** no DELETE; retiro hecho T3c-1; fusión persistente **pospuesto por decisión de Jaime**. |
| `semanas.ts` migración | getLocalRegistros, migrateLocalToCloud, clearLocalRegistros | **No aplica**: TRACEA no tiene datos en el navegador que migrar. |
| `fotos-bitacora.ts` | mesesEncabezado, detectarLunesFoto, subirFotoBitacora, urlFotoBitacora | subirFoto/abrirFoto: **hecho**; helpers de fecha **hecho T3c-1**, propuesta de lunes conectada individual/lote. |
| `storage.ts` | loadJSON, saveJSON, removeKey | **Cambiado a propósito** persistencia Cloud; migración local **no aplica**. |
| `diafra-data.ts` | SISTEMAS_HVAC, ISO_LIMITS, MODULOS | Catálogos por empresa/catalogos/Tablero: **cambiado a propósito**, no datos DIAFRA globales. |
| `utils.ts` | cn | `src/lib/utils.ts`: **hecho**, compartido. |
| `auth-context.tsx`, AuthGuard | AuthProvider, useAuth, AuthGuard | Auth/guards compartidos: **cambiado a propósito**, empresa activa/facultades servidor. |
| `admin-users.functions.ts` | listManagedUsers, createManagedUser, inviteManagedUser, updateManagedUserRole, deleteManagedUser, setManagedUserPassword, sendManagedUserPasswordRecovery | Servicios administrativos compartidos: **cambiado a propósito**, equivalencia individual **no verificada**. |
| `admin-users.server.ts` | getManagedUsers, createManagedUserAccount, inviteManagedUserAccount, updateManagedUserAccountRole, deleteManagedUserAccount, setManagedUserPasswordAccount, sendManagedUserPasswordRecoveryEmail | Misma adaptación; desactivación sustituye eliminación. |
| Plantillas auth | signup, recovery, reauthentication, magic-link, invite, email-change | Plantillas compartidas: **cambiado a propósito**, no nuevas funciones Tendencias. |
| `supabase/functions/extract-bitacora/index.ts` | POST/OPTIONS; T/HR/presión/filtros; gateway/JSON/errores | `tend-extract-bitacora`: **hecho**, skills v1.0, foto privada, roles/consumo/propuesta, sin reintento automático; contrato registro_id/foto_path. Agua manual. |

Tipos/interfaces y componentes UI genéricos no añaden funciones de negocio; controles de negocio están enumerados en §2. El archivo fuente y la matriz previa extensa se conservan para trazabilidad, sin modificar atdiafra.

## 4. Funciones nuevas TRACEA y evidencia real

| Función | Ubicación | Estado y evidencia |
|---|---|---|
| Alta suplencia; fechas/facultades/respaldo/motivo | Suplencias.tsx, org_suplencias | **Hecho**. Alta QA con motivo y facultad autorizar comprobada. Respaldo es texto/referencia; archivo de respaldo **pospuesto por decisión de Jaime**. |
| Aviso vigente al encabezado | AvisoSuplencia en Marco | **Hecho**; visible en QA antes de revocar, refresco periódico. |
| Revocar e historial | Suplencias.tsx | **Hecho**; revocada visible y conservada. |
| Correo cuando requerido, reintentar, resultado sistema | tend-aviso-suplencia; template suplencia-rs; tend_aviso_tomar/terminar | **Hecho**: HTTP 200/enviado y timestamp sin error guardado. Reintento posterior resultados vacíos, sin envío duplicado. **No verificado** buzón receptor ni dos llamadas simultáneas reales; claim servidor impide reclamo repetido. |
| Tres skills originales v1.0 | Skills de IA, agent_prompts/ia_skills | **Hecho**: extraccion_bitacora_temphr/presiones/filtros vigentes; textos comparados con originales, igualdad exacta antes de interpolar empresa. |
| Extraer T/HR | tend-extract-bitacora, Captura | **Hecho**: imagen sintética QA, HTTP 200, 21 T + 21 HR, valores 22 y 45 y skill/hash/modelo conservados; T confirmada y recargada con valor 22. |
| Extraer presiones | Mismos | **Hecho**: HTTP 200, 21 lecturas; corregir lunes 12 → 12.5, confirmar y recargar: 12.5 persistente. |
| Extraer filtros | Mismos | **Hecho**: imagen sintética QA, HTTP 200, 21 lecturas 0.3 y unidad inH2O propuesta; skill/hash/modelo conservados; confirmación/readback 0.3 y unidad inH2O visible tras recargar. |
| Propuesta/dudosos/revisión humana | extraccion.ts, ExtraccionBitacora, tend_confirmar_extraccion | **Hecho**: no valida/emite; corregir o N/A dudosos + revisión explícita. Semana con lecturas previas exige motivo y auditoría; emitida bloqueada por guards existentes. |
| Consumo total histórico por empresa | tend_extracciones y contador aislado por org | **Hecho**: reserva antes de IA y propuesta/error persistidos; límite desde plan_limites; errores también conservados. No hay cobro/precios nuevos. |
| Información ⓘ solo super_admin | InformacionRespuestaIA en historial | **Hecho en código**, control compartido R19; sesión QA admin no muestra ⓘ. Visual de super_admin en soporte no repetido en este cierre. |
| Pausa IA terminal y reclamo correo | 0057; tend_ia_control/tend_avisos_control | **Hecho**: escritura solo sistema, sin reintentos automáticos; acceso/crédito bloqueado persiste. |
| Borrador RS-only | 0058, Analisis | **Hecho**: admin rechazado, RS anula sin borrar, prueba SQL QA con rollback. |
| Word desde snapshot | snapshot-forval16, Analisis | **Hecho** previamente comprobado navegador QA AT-2026-005 borrador/emitido; regresión original repetida y pasa. |
| Pendiente AT por autorizar | module.obtenerPendientes | **Hecho** según rol/suplencia, excluye elaborador/modificadores; sin inventar permiso cliente. |

### PDF consolidado: sí existe en atdiafra

`S/lib/export-normativo.ts` incluye por serie dos gráficas: especificación/control y límites de alerta/acción. Se portaron `chart-renderer.ts` y el bloque del PDF. TRACEA Reporte activa ese bloque, usa empresa/logo configurados, conserva tablas/evaluación y pagina para evitar solapamientos. No corresponde marcar «no existe en atdiafra».

Descarga real QA `/tendencias/reporte`: PDF de cinco páginas, 3,683,687 bytes, todas convertidas e inspeccionadas. Página 4 gráfica de especificación de presión; página 5 gráfica de alerta/acción indicando datos insuficientes (correcto para 15 lecturas). Encabezado QA Brain adminqa, no DIAFRA. No se modificó motor estadístico. Cumplimiento mantiene su llamada tabular explícita `incluirGraficas:false`; no confundir ambos PDF.

## 5. Diferencias pendientes que impiden declarar equivalencia total

1. **Hecho T3c-1**: lote IA independiente revisado, secuencial, progreso, previsualizar, omitir, duplicados, fecha y reintento. Recuperación de propuestas tras recarga por historial individual; cola de archivos local no se conserva al recargar.
2. **Hecho T3c-1**: helpers originales de lunes; fecha propuesta confirmable; compresión derivada antes de IA.
3. **Hecho T3c-1**: contexto, antefirma editable, objetivos/selector semanal y baseline; alta contextual mantiene admin-only (cambiado a propósito por permisos aprobados).
4. **Hecho T3c-1**: N/A/mover/limpiar, descartar/postguardado y corregir lunes conservando ID, con motivo/auditoría y colisiones.
5. **Pospuesto por decisión de Jaime**: PDF semanal y análisis local dentro de captura.
6. **Hecho T3c-2**: detalle `/tendencias/reporte/:id`, volver/editar/retirar motivado; Captura adopta `registroId` y módulo, Análisis resuelve `ids` de registros a instrumentos y precarga `desde`/`hasta`, incluido enlace general.
7. **Hecho T3c-1**: retiros motivados conservados en historial y fuera de nuevos cálculos; emitidos bloqueados. Fusión persistente **pospuesto por decisión de Jaime**.
8. **Hecho T3c-2**: bandeja de validación con conteos/filtros/validar/editar/N/A. Ayudas/filtros generales de catálogos fuera del alcance de esta entrega; restaurar textos y quitar logo **pospuesto por decisión de Jaime**.
9. Migración local **no aplica**, TRACEA no tiene datos en el navegador que migrar; filtros específicos de Auditoría/explorador e historial AT global **pospuesto por decisión de Jaime**.
10. **Hecho T3c-2**: modo histórico explícito de solo lectura; Word ANULADO con motivo/fecha separados del snapshot de emisión, sin tratarlo como emitido; Excel de RegistroAT tachado. Histórico/anulado sin snapshot no exporta cálculos con catálogos actuales.
11. **Pospuesto por decisión de Jaime**: exportadores generales originales `export-utils`; se conservan normativos, sin declarar hojas/layout idénticos.
12. **Hecho T3c-2**: tarjetas y entradas laterales Reporte/Cumplimiento; aviso de lecturas dudosas pendientes en Tablero.
13. Equivalencia uno a uno de administración/auth/recuperación/plantillas compartidas y recepción de correo en buzón; concurrencia real de envíos pendiente de prueba.
14. Formatos por módulo deliberadamente posteriores; firma Part 11 y quién Revisó separados por fase, no implementados aquí.

Son faltantes explícitos, no motivos autorizados inventados. Se entregan los cuatro puntos del cierre con estas limitaciones; **no se declara T3b con paridad funcional total**.

## 6. Archivos cambiados en este cierre

- `src/modules/tendencias/{Captura,ExtraccionBitacora,Suplencias,Analisis,Reporte}.tsx`.
- `src/modules/tendencias/lib/{extraccion,chart-renderer,export-normativo}.ts`.
- `src/modules/tendencias/lib/__tests__/{extraccion,export-normativo-graficas}.test.ts`.
- `supabase/functions/tend-extract-bitacora/index.ts`, `tend-aviso-suplencia/index.ts` (desplegadas).
- `supabase/functions/_shared/{documento-contenido,bitacora-lecturas}.ts`; plantilla/registro suplencia-rs existente utilizado.
- `drizzle/migrations/0057_t3b_aviso_claim_y_bloqueo_ia.sql`, `0058_t3b_anulacion_borrador_rs_suplente.sql` (aplicadas); tres skills v1.0 registradas como datos, no DDL de seed.
- `t2_down.sql`, `t3b_cierre_pruebas.sql`, `docs/reglas-detalle.md`, `AGENTS.md` (R23), `roadmap.md`, este `t3b_matriz.md`.

## 7. Pruebas y límites

- **118/118 pruebas, 18 archivos** en la ejecución final de Vitest; incluye 36 pruebas originales de motor, Word original con fixture de prueba/identidad DIAFRA (sin consultar datos reales), snapshot, captura/confirmación y dos pruebas de gráficas PDF. Advertencias React act/React Router, sin fallos.
- **3/3 reglas de cierre SQL**: admin autor no anula; RS anula y conserva registro; aviso enviado no puede reclamarse. Ejecutadas solo QA con ROLLBACK. Archivo `t3b_cierre_pruebas.sql`.
- Siete pruebas T2 y pruebas de integridad/HVAC se aprobaron en fases anteriores; no se presentan como nueva ejecución de este cierre.
- Navegador autenticado QA: tres llamadas IA reales, corrección/confirmación persistente de presión, suplencia/aviso/reintento/revocación y descarga PDF con todas sus páginas inspeccionadas.
- Buzón del RS, dos invocaciones simultáneas reales, todas las rutas administrativas y todos los escenarios de límite/errores no se probaron de principio a fin.
- Última señal de compilación: build OK; no ejecutar pruebas en empresas reales. Agua permanece manual, sin cambios a Riesgos/Cerebro/atdiafra.


## 8. Entrega T3c-1

Archivos: Captura, LoteFotosImporter, AltaContextual, ControlesSemana, ExtraccionBitacora, Catalogos, hooks; lib/persistencia, semanas, fotos-bitacora, compress-image, extraccion-cliente, captura-controles y sus pruebas. Migración 0059 aplicada; t2_down.sql, t3c1_pruebas.sql, AGENTS.md R24, docs/reglas-detalle.md y roadmap actualizados. Motor y skills no modificados.

Evidencia: 129/129 pruebas en 19 archivos; 71 de bibliotecas Tendencias incluidas (motor/Word original). t3c1_pruebas.sql ejecutado con rollback solo QA: motivos, corrección de fecha conservando ID, auditoría anterior/nuevo, colisiones, retiros de tres tipos, no reactivación, snapshots sin inactivos, bloqueo emitido por edición manual/extracción/fecha y tres retiros. Navegador QA: nueva captura, mover T/HR, N/A, guardar y readback; corregir fecha; dos fotos extraídas, revisadas, confirmadas y readback 22/45; retiro visible en historial. No se simuló fallo real del proveedor: aislamiento y parada terminal probados unitariamente.

T3c-2 no ejecutado. PDF semanal/análisis local y fusión persistente esperan decisión; formatos/Part 11/Revisó posteriores. No se declara paridad total.

### Reconfirmación T3c-1 — 18/10/2026

Diferencias 1, 2, 3, 4 y 7 revisadas sobre el código existente. Ajustes en `LoteFotosImporter.tsx` (aviso de semana previamente guardada, conservando corrección motivada) y `ExtraccionBitacora.tsx` (aviso y bloqueo de confirmación sin motivo cuando ya hay lecturas). Sin modificar motor, skills ni reglas de base de datos; nada se borra. Suite existente: **129/129 pruebas, 19 archivos**, sin pruebas nuevas. No se usó navegador, no se llamó a la IA ni se inspeccionaron descargas en esta revisión; pruebas funcionales a cargo de Jaime. Alta contextual conserva admin-only; cola local de fotos no persiste tras recargar. T3c-2 fuera de alcance.
