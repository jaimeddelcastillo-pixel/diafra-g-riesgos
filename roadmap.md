# Roadmap

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
- [ ] Paridad atdiafra restante — sin bloquear entrega de matriz: lote IA, fecha/compresión, captura avanzada/acciones de día/fecha persistida/PDF semanal, detalle y precargas de enlaces, retiros/fusión conservadora, validación/migración local/auditoría específica, modo histórico/Word anulado/tachado Excel y exportadores generales. Inventario exacto en t3b_matriz.md; no afirmar paridad completa ni trabajo en segundo plano.

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
