# Roadmap

- [ ] Soporte: conservar empresa al actualizar, sin cierre automático por almacenamiento local; probar restauración y salida explícita.

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
