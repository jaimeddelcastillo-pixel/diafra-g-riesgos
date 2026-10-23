# Roadmap

- [x] K1: Indicadores del SGC y por puesto, catálogo de puestos, rol Aseguramiento de Calidad y suplencias aisladas, Excel con vista previa y aplicación atómica auditada, pendiente de validación; migraciones 0088–0095 y suite 329/329. Sin activar empresas, tocar archivos Tendencias/Riesgos, navegador, llamadas IA ni dependencias; recorrido visual/autenticado no verificado por restricción.

- [x] P1-b: menú plegable por usuario y cajón móvil, pendientes arriba de módulos, migas de pan de plataforma, alertas por color; sin cambios de permisos o lógica, sin navegador/IA/dependencias.
- [ ] P1-b asunto diario con vencidos: no existe remitente ni correo diario de Mis pendientes en el proyecto; requiere definir/autorizar ese envío antes de modificar un asunto inexistente.

- [x] P1 Mis pendientes: pendientes_usuario, semáforo por empresa, bloque Inicio, /pendientes con pestañas y filtros, contador en menú, confirmación de perfil (firmantes), aviso de suplencia encimada; pruebas SQL temporales. Sin navegador/IA/dependencias.

- [x] T5c: elegibles/predeterminado por rol, autor del AT por defecto y múltiples Elaboró/Revisó; Autorizó restringido por has_role/suplencia vigente, emisión atómica y ambos snapshots congelados; Word por firmante y compatibilidad histórica. Enlaces Empresas existentes comprobados sin duplicarlos. 208/208 pruebas de Tendencias y build OK; SQL real copiado a fixtures temporales con rollback, no sesión/RLS ni flujo completo de emisión. Sin navegador/dependencias; comprobación funcional de pantalla a cargo de Jaime.

- [x] Firmantes: user_id opcional persistido, selección manual quita asociación sin alterar textos, aviso no bloqueante Autorizó mediante has_role y suplencia vigente autorizar, aviso de cargo ausente; plantillas históricas intactas. 194/194 pruebas de Tendencias; sin navegador/IA/dependencias ni firma electrónica Fase 5.

- [x] Selector de usuarios activos de la empresa en Firmantes de Plantilla del reporte; copia nombre/cargo conservando rol y versiones anteriores; 184/184 pruebas de Tendencias, build OK; sin navegador ni dependencias.

- [x] T4e implementado: plantilla Excel T4e-1, exportación, vista previa sin escritura y RPC admin/RS atómica motivada; equivalencias sin columnas nuevas; pruebas XLSX y transacción SQL temporal con alta/cambio/bloqueo/reversión. Sin navegador/IA/dependencias ni motor. Informe t4e_reporte.md; verificación funcional con sesión adminqa a cargo de Jaime (sandbox no permite authenticated/RPC productiva).

- [x] T4f: tabla normativa compartida NOM-241/NOM-059, citas Word, clases y sugerencias; nuevas emisiones congelan tabla común, históricos intactos; suite automática sin navegador/dependencias.

- [x] Fase 1: Captura y Análisis adaptados desde atdiafra; exportación cruda única, pendientes/historial separados, cuatro secciones con gráficas, buscador/guía/consecutivo y avisos. Identificadores y descargas configurables; unicidad activa normalizada aplicada, adminqa sin duplicados activos ni retiros. Suite 143/143 y compilación OK; sin navegador/IA/dependencias. Verificación visual y funcional a cargo de Jaime.
- [x] Fase 2: Captura (popover Exportar PDF + Excel crudo, análisis del registro, zona de peligro con retiro auditado y bloqueo por AT emitido), Cumplimiento copiado de reporte.normativo, paso a Análisis con instrumentos/periodo/sistema. Reporte consolidado ya era copia; Fusionar/Borrar siguen fuera (no borrado). Verificación visual a cargo de Jaime.

- [x] Complemento T3d: Gemini 3.8 Flash con razonamiento minimal; tres v1.1 siguen en borrador con año escrito prioritario y candidatos desde primera fecha hasta actual +1. Comprobación compartida servidor/UI de todas las columnas; sin candidato requiere_revision, sin prohibición de 2024/anteriores y originales conservados. Función desplegada, huellas/estados leídos; suite 129/129 y build OK. Sin navegador/IA real/dependencias; validación funcional de extracción a cargo de Jaime.

- [x] T3d implementado: Gemini 3.8 Flash configurable por skill (elección de Jaime), sin razonamiento forzado, fotos intactas, extracción dos fotos y confirmación secuencial, rango histórico/fecha/confianza, tres v1.1 borrador sin publicar, enteros Word, aviso soporte y Excel crudo/correcciones mediante RPC acotada. 0060 aplicada y función desplegada; suite 129/129, build OK; sin navegador/IA real/dependencias. Detalles en t3d_reporte.md.
- [ ] T3d controles nuevos SQL QA: t3d_pruebas.sql (cinco reglas, rollback) no pudo ejecutarse porque la conexión de pruebas no puede adoptar authenticated; requiere conexión de pruebas autorizada. Pruebas funcionales y publicación v1.1 a cargo de Jaime; textos v1.0 vigentes intactos hasta publicar.

- [x] T3c-2 implementado: detalle/retirar con motivo y precargas, bandeja validación admin con conteos/filtros/validar/editar/N/A, Word anulado desde snapshot con motivo/fecha, Excel tachado, histórico solo lectura, tarjetas/menú/aviso dudosos. Suite existente 129/129 (19 archivos), build OK; sin navegador/IA real/inspección de descargas ni pruebas nuevas/SQL. Anulados/históricos sin snapshot no exportan cálculos. Matriz: solo filas afectadas; resto pospuesto por Jaime.

- [x] Reconfirmación T3c-1: diferencias 1/2/3/4/7 revisadas; aviso de semana existente en lote y bloqueo/aviso de confirmación individual sin motivo añadidos. Suite existente 129/129, 19 archivos; sin nuevas reglas SQL/pruebas, navegador, llamadas IA ni inspección de descargas. Pruebas funcionales a cargo de Jaime. T3c-2 no ejecutado.

- [x] T3c-1 verificado: lote IA con propuestas/revisión/reintento; fecha detectada y compresión; captura contextual/antefirma/objetivo/baseline; acciones por día/descarte/fecha con colisiones; retiro motivado de registros/semanas/cambios de filtro y pruebas QA. Motor intacto; 129/129 pruebas, controles SQL rollback QA y lote revisado/readback real. Alta catálogo conserva admin-only. T3c-2 espera aprobación de esta parte.

- [x] Cierre T3b solicitado: t3b_matriz.md exhaustiva entregada, gráficas originales del PDF descargadas/inspeccionadas, suplencias/aviso/reintento/revocación QA y extracción individual T/HR-presiones-filtros con skills originales v1.0, revisión humana y consumo; 118/118 pruebas y 3 reglas SQL QA con rollback. Agua manual y formatos por módulo posteriores. No equivale a paridad total: faltantes enumerados en la matriz.

- [x] T3a: motor original 36/36 y total 42/42 con regresión Word; registro, tablero, catálogos, captura/fotos y configuración. T2 «No clasificada» autorizado y t2_down.sql actualizado. Navegador adminqa: alta HVAC/área/instrumento, semana y foto persistentes, logo/firmante persistentes, pendientes; operador sin edición; QA Starter sin acceso. Conservar tracea.site; sin IA/emisión/suplencias hasta T3b.

- [x] T2 Tendencias: 0050 aplicada, 11 tend_ + org_suplencias, RLS/roles, historial inmutable, bucket privado y auditoría horaria de vencimientos; beta manual solo adminqa sin precios/planes. Siete pruebas SQL y avisos admin/RS pasan con ROLLBACK solo QA; t2_down.sql no destructivo y t2_reporte.md.
- [x] T3b punto 0: matriz de rutas/acciones/funciones, inventario intacto/adaptado y nueva ejecución 36/36 originales, 42/42 totales (Word 1/1). Entrega t3b_matriz_equivalencia.md y verificación previa; sin cambios funcionales.
- [x] T3b controles de base: tres estados, anulación motivada de borrador, avisos solo sistema, identidades congeladas, extracciones trazables/límite histórico; reversión actualizada. Siete pruebas T2 y aviso RS pasan con rollback QA.
- [x] T3b correcciones de integridad: snapshots solo servidor al emitir con registros/semanas/id; ambos replace comprobados; RS titular congelado y copiado desde suplencia; motivo y auditoría manual/extracción; semanas emitidas bloqueadas en ambas vías; source/mes/año y foto validados en servidor. Pruebas adicionales en t3b_integridad_pruebas.sql.
- [x] T3b ajuste HVAC: 0055 aplicada, instrumentos resueltos por servidor, instrumentos/registros vacíos rechazados, objetivos y semanas/id congelados. Pruebas positivas/negativas QA con rollback pasan. Fuente Word documentada en t3b_reporte.md.
- [x] T3b captura individual usa RPC motivada; Word emitido usa snapshot y fecha de cálculo congelada. Motor original 36/36 y total 47/47, incluido Word. Registro AT abre en navegador soporte QA sin errores; no equivale a emisión/descarga completa en navegador.
- [x] T3b Word de AT real de principio a fin en navegador QA: AT-2026-005 borrador (operador) con marca «BORRADOR – NO VÁLIDO» y emitido (RS) limpio con AUTORIZÓ y snapshots servidor; separación de funciones y bloqueo por especificación pendiente verificados. Pendiente: funciones faltantes de captura/lotes/auditoría. Sin Part 11, Riesgos ni Cerebro.
- [x] T3b correo: pantalla/plantilla/función y claim sistema; QA alta muestra banner, respuesta enviado y timestamp persistente, reintento sin duplicar y revocación conservada. Buzón receptor y concurrencia real no verificados.
- [x] T3b IA individual: tres skills originales v1.0 vigentes, tres llamadas reales QA HTTP 200, propuesta presiones corregida/confirmada/readback 12.5, consumo y trazabilidad persistentes. Agua manual. Lote IA no implementado; lote actual solo fotos.
- [ ] Paridad restante pospuesta por decisión de Jaime: export-utils generales, filtros específicos de Auditoría, respaldo de suplencias, restaurar textos/quitar logo del Formato, PDF semanal/análisis en captura y fusión persistente; no ejecutar sin nueva autorización. Formatos/Part 11/Revisó posteriores. Migración local no aplica. Pruebas funcionales T3c-2 a cargo de Jaime; anulados/históricos sin snapshot carecen de datos congelados para exportación calculada.

- [x] Soporte: actualizar adopta contexto del servidor sin cierre por marca local ausente; 10 pruebas pasan. Navegador QA adminqa: Cerebro conserva soporte tras recargar sin marca local y Terminar soporte vuelve al Panel.

- [x] C4c.1 Configuración adminqa confirmada; búsqueda OR/códigos/fallback acotado, texto con etapa y diagnóstico persistido, chips en línea; 13 pruebas pasan y ambas selecciones SQL traen K-0008. Detalles y límites en c4c1_reporte.md.
- [ ] C4c.1 Verificación del chat y llamada completa a contexto_cerebro en adminqa: navegador a cargo de Jaime; herramienta SQL sin EXECUTE y sesión disponible fuera de adminqa (no cambiar empresa).

- [x] C4c Códigos K, contexto validado vía función, interruptor apagado por defecto, composición y trazabilidad, chips/Usado en, reversión y prueba SQL QA; 50 pruebas automáticas pasan. Pendiente de Jaime: pegar skill, activar piloto y pruebas de navegador.

- [x] C4b.2 Fecha de México en contextos IA, información por respuesta, etiqueta global, restauración exacta, tarjetas agrupadas/conteos y aviso; reversión c4b2_down.sql (sin cambios SQL), cinco pruebas automáticas. Navegador a cargo de Jaime; MULTI cuenta en ambas normas y bloques incluye borradores.

- [x] P1c.1 Regla única mi_acceso_curso (RLS, examen, diploma, pantallas); Mis diplomas sin filtro por módulo; reversión p1c1_down.sql
- [ ] Motor futuro: el webhook de Stripe cambia trial → starter al comprar el curso; revisar ese efecto comercial al definir precios
- [x] P1c.2 Curso pagado sin vencimiento = vigente; Mis diplomas en lectura para empresas suspendidas; encabezado con total real en vista previa; reversión drizzle/rollback/p1c2_down.sql

- [x] P1c Preparar capacitación por módulo sin cambiar derechos comerciales ni progreso existente; reporte p1c_reporte.md, reversión p1c_down.sql, 34 pruebas y QA adminqa/Starter
- [ ] Posterior a P1c (espera aprobación; no corregir ahora): revisión vencida debe contar desde cierre o última revisión periódica registrada, no updated_at; existe folios.fecha_cierre (date nullable), no fecha explícita de última revisión periódica
- [ ] Verificación P1c pendiente: descarga de diploma/DC-3 histórico y pantalla sin acceso a curso (bloqueada por falta de esos casos en las membresías QA del consultor)

- [x] P1b.1 Redirigir super_admin fuera de soporte en rutas de módulos (7 rutas comprobadas)
- [x] P1b.1 Encabezado contextual desde el registro y menú de soporte con acceso empresarial (QA Starter y adminqa)
- [x] P1b.1 Alinear revisión vencida con check-folios-revision; reversión p1b1_down.sql (archivo previo protegido), 29 pruebas

- [x] C6a.1 Catálogo de tipos, Recursos (clasificación, huella en servidor)
- [x] C6a.2 Retención, enlace sugerido, Sin registro oficial, vigencia
- [x] Complemento C6a.3: plan_limites, Cerebro en trial, QA Starter sin Cerebro
- [x] C6a.3 Extracción con topes
- [x] C6a.4 Permiso por rol, Usar en IA, recorte de escaneados, brain_extracciones, Validación con fuente, propuestas, entrevista enlazada, Revisión atendida
- [ ] Exportar en servidor (cuando exista): validar `exportar` desde plan_limites
- [ ] Prueba de recorte a 20 páginas en QA Brain operqa (bloqueada: operqa solo tiene un operador y ya usó sus 3 extracciones)
- [ ] Fase posterior: retirar la restricción vieja de 12 valores de brain_documents.tipo

### Tendencias — reporte consolidado y paridad de Cumplimiento
Implementados reporte independiente, vistas por área/instrumento/avance, consolidación no destructiva, exportadores normativos de seis hojas, PDF consolidado con gráficas originales descargado e inspeccionado en QA, KPIs/cobertura/filtros/agrupación de Cumplimiento. Suite final 118/118 (18 archivos). Motor intacto; faltantes y diferencias exactas en t3b_matriz.md; no equiparar exportador normativo con export-utils original.

### Tendencias — T4h importación del catálogo por conjuntos
- [x] RPC por conjuntos (un bloqueo por tabla, un upsert por hoja, auditoría masiva); 200 renglones ~0.2 s en prueba con reversión
- [ ] Confirmar con sesión real de adminqa la importación parte 1 (72 renglones)

### Tendencias — T4i auditoría del módulo e importación no bloqueante
- [x] Auditoría de Tendencias en /tendencias/auditoria (menú, solo admin/RS): tend_* con fecha, usuario, acción, registro, antes→después, motivo y origen; filtros y exportación Excel
- [x] Importación del catálogo: valida solo renglones del archivo; existentes incompletos avisan sin bloquear; renglones vacíos con formato ignorados
- [x] Captura: etiqueta del objetivo «Objetivo N Pa»

### T5d — suplencias de plataforma
- [x] Informe final: listar funciones y comprobaciones migradas a rol_efectivo e identificar explícitamente pantallas o funciones sin migrar (solicitado tras aprobación).
- [x] Mover Suplencias a Configuración; designación admin/RS, categorías, aceptación, rechazo y terminación motivada; conservar existentes y avisos.
- [x] Unificar rol efectivo en servidor y permisos de Riesgos, Cerebro, Tendencias y plataforma sin mezcla de roles ni autoautorización.
- [x] Registrar identidad del titular en acciones y auditoría; suite automática con aceptación, vigencia, solapamientos y aislamiento RS/admin (sin navegador, IA ni dependencias).

- [ ] Verificación visual y recorrido autenticado de T5d: a cargo de Jaime; navegador expresamente excluido. Suite 279/279, funciones sobre fixtures temporales QA; no equivale a prueba de sesión/RLS real. Informe completo: t5d_reporte.md.
- [x] K2 captura de resultados de KPI: kpi_resultados con cálculo en servidor, copia inmutable de meta/tendencia/unidad, evidencia SGC en bucket privado kpi-evidencias, capturistas por KPI, pestaña Captura, pendientes agrupados y exportación Excel; suite con 9 pruebas SQL (sin navegador, IA ni dependencias).
- [x] K2-b captura corregida para KPI de puesto, referencia de la fuente SGC, evidencias del periodo ligables, vistas Por capturar/Año con último periodo cerrado.
- [ ] K2-a importación de resultados por Excel: migración rechazada por el usuario; en espera de indicación.
