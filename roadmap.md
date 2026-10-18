# Roadmap

- [x] T3a: motor original 36/36 y total 42/42 con regresión Word; registro, tablero, catálogos, captura/fotos y configuración. T2 «No clasificada» autorizado y t2_down.sql actualizado. Navegador adminqa: alta HVAC/área/instrumento, semana y foto persistentes, logo/firmante persistentes, pendientes; operador sin edición; QA Starter sin acceso. Conservar tracea.site; sin IA/emisión/suplencias hasta T3b.

- [x] T2 Tendencias: 0050 aplicada, 11 tend_ + org_suplencias, RLS/roles, historial inmutable, bucket privado y auditoría horaria de vencimientos; beta manual solo adminqa sin precios/planes. Siete pruebas SQL y avisos admin/RS pasan con ROLLBACK solo QA; t2_down.sql no destructivo y t2_reporte.md.
- [x] T3b punto 0: matriz de rutas/acciones/funciones, inventario intacto/adaptado y nueva ejecución 36/36 originales, 42/42 totales (Word 1/1). Entrega t3b_matriz_equivalencia.md y verificación previa; sin cambios funcionales.
- [x] T3b controles de base: tres estados, anulación motivada de borrador, avisos solo sistema, identidades congeladas, extracciones trazables/límite histórico; reversión actualizada. Siete pruebas T2 y aviso RS pasan con rollback QA.
- [x] T3b correcciones de integridad: snapshots solo servidor al emitir con registros/semanas/id; ambos replace comprobados; RS titular congelado y copiado desde suplencia; motivo y auditoría manual/extracción; semanas emitidas bloqueadas en ambas vías; source/mes/año y foto validados en servidor. Pruebas adicionales en t3b_integridad_pruebas.sql.
- [x] T3b ajuste HVAC: 0055 aplicada, instrumentos resueltos por servidor, instrumentos/registros vacíos rechazados, objetivos y semanas/id congelados. Pruebas positivas/negativas QA con rollback pasan. Fuente Word documentada en t3b_reporte.md.
- [x] T3b captura individual usa RPC motivada; Word emitido usa snapshot y fecha de cálculo congelada. Motor original 36/36 y total 47/47, incluido Word. Registro AT abre en navegador soporte QA sin errores; no equivale a emisión/descarga completa en navegador.
- [ ] T3b cierre de equivalencia: completar funciones faltantes de captura/lotes/reporte consolidado/auditoría y agrupaciones de Cumplimiento; probar Word de AT real de principio a fin. Sin Part 11, Riesgos ni Cerebro.
- [ ] T3b correo: pantalla/plantilla/función de avisos y reintentos creadas; falta verificar entrega real y no-op concurrente. No declarar envío probado.
- [ ] T3b IA: faltan registrar tres skills v1.0 originales parametrizadas, implementar extracción/confirmación humana/lotes y probar llamada real. Agua manual. Función IA incompleta retirada; no habilitada.

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
Implementados reporte independiente, vistas por área/instrumento/avance, consolidación no destructiva, exportadores normativos de seis hojas y PDF tabular, KPIs/cobertura/filtros/agrupación de Cumplimiento; 110 pruebas pasan (16 archivos). Pendientes QA visual autenticado, descargas reales y gráficas PDF opcionales; sin cambios a motores, BD ni edge functions. Evidencia y lista de archivos en t3b_matriz_equivalencia.md.
