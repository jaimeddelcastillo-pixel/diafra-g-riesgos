# P1c — Capacitación por módulo

## Aplicado
- `cursos.modulo_clave` referencia el catálogo `modulos`. Los dos cursos existentes (NOM-241 y NOM-059) quedaron asignados a `riesgos`, con eventos `P1C_ASIGNAR_MODULO` en la bitácora.
- Capacitación, examen y Mis diplomas pertenecen al registro de Riesgos y reciben su `ModuloGuard('riesgos')`. Se conservan las mismas direcciones, incluida `/capacitacion/:cursoId/examen`.
- Lectura del curso, examen, diplomas, intentos aprobados y pendientes de la tarjeta se filtran por el módulo. El examen de otra pertenencia se detiene antes de consultar intentos o banco.
- Para diplomas históricos se consulta `cursos_ids_modulo`: solo devuelve identificadores, con sesión y acceso al módulo. No devuelve contenido del curso ni diplomas ajenos; las consultas de diplomas e intentos conservan su RLS. Evita esconder diplomas cuando vence el acceso al contenido.
- No se modificaron planes, pagos, expiraciones, reglas de examen/calificación, emisión de diplomas, solicitudes DC-3, `org_has_curso_access`, RLS existente ni datos DIAFRA.
- No se construyó un nuevo módulo Capacitación ni el motor futuro.

## Archivos y migraciones
Migraciones aplicadas:
- `drizzle/migrations/0026_p1c_cursos_por_modulo.sql`
- `drizzle/migrations/0027_p1c_identificadores_cursos_modulo.sql`
- `drizzle/migrations/0028_p1c_pendientes_cursos_riesgos.sql`

Modificados:
- `src/modules/riesgos/module.ts` — propiedad de las tres rutas.
- `src/App.tsx` — elimina las tres rutas sueltas; se generan desde el registro.
- `src/hooks/useCurso.ts` — filtro por módulo (Riesgos por defecto).
- `src/pages/ExamenFinal.tsx` — filtro y salida cuando el curso no corresponde.
- `src/pages/MisDiplomas.tsx` — filtro de diplomas e intentos del módulo.
- `AGENTS.md`, `roadmap.md`.
- `src/integrations/supabase/types.ts` — regenerado automáticamente por las migraciones, no editado a mano.

Creados: `src/test/p1c.test.tsx`, `p1c_down.sql`, este reporte.

### Reversión
`p1c_down.sql` está en la raíz. La carpeta `drizzle/rollback/` rechazó la escritura por ser protegida, igual que en P1b.1; no se evadió la protección ni se cambió el archivo P1 original.
Restaurar primero el código anterior de P1c; después ejecutar esta reversión, antes de `p1b1_down.sql` y de la reversión P1 completa. Conserva la bitácora. SQL guardado, no ejecutado ni probado contra datos reales.

## Pruebas
- 34 pruebas automáticas aprobadas: 5 P1c, 5 P1b.1, 23 Listado Maestro y 1 base.
- Compilación de vista previa: último registro `build OK`.
- Sesión real QA consultor: curso NOM-241 visible, 12 lecciones y avance 0/12. Examen abre con tres intentos disponibles, sin iniciar un intento. Mis diplomas abre y muestra el vacío real.
- QA Starter sin Cerebro: curso sigue visible como Operador con el mismo avance. `/cerebro` sigue mostrando «Módulo no contratado».
- Cambio de empresa desde el selector probado; sesión devuelta a adminqa. El aviso de bienvenida de QA Starter se omitió para continuar; no se cambiaron reglas del tour.
- Sin errores de ejecución en el navegador durante la comprobación final.
- Ambas asignaciones de cursos aparecen en bitácora; la condición de revisión vencida sigue usando `updated_at`, sin cambio.

### Límites de verificación
- Las dos empresas QA comprobadas no tienen diplomas emitidos. No se verificó una descarga de diploma histórico ni se emitió un DC-3 para probar: estas operaciones no se modificaron.
- No se comprobó visualmente una empresa sin acceso al curso: las membresías disponibles del consultor son professional, enterprise y starter. Se conservó literalmente la regla comercial de la pantalla y la función de acceso existente; no se inventó un bloqueo para simular esa prueba.
- No se probó un nuevo curso de Cerebro, porque no existe y crearlo queda fuera de P1c.

## Incongruencias existentes, no corregidas
- Pantalla y función de acceso del curso difieren en trial: la pantalla habilita trial según `subscription_status`, pero `org_has_curso_access` no concede contenido a trial sin curso pagado. También difieren en comprobaciones de expiración/estado: la pantalla acepta `tiene_curso_pagado` por sí solo; la función exige vigencia de ese pago o un plan no trial activo. Se reportó antes de intervenir y se dejaron intactas.
- El comentario antiguo de Capacitación dice Enterprise/curso pagado, mientras la condición real incluye Starter y Professional. No se usó ese comentario para cambiar derechos.
- La limitación anterior del Panel TRACEA con empresas QA queda fuera de P1c.

## Pendiente: fecha de revisión vencida
No corregido ahora, por instrucción expresa.
- Existe `public.folios.fecha_cierre`, tipo `date`, admite NULL. Está disponible como «Fecha Cierre» editable en el encabezado del folio; no debe suponerse que sea un sello automático e inalterable de la transición a Cerrado.
- No existe un campo específico para la fecha de última revisión periódica en folios. `folio_versiones.motivo_revision` es un motivo de versión, no la fecha explícita de una revisión periódica terminada. Los campos de revisión de Cerebro son de conocimiento documental, no de folios.
- Regla actual compartida: estado Cerrado y `updated_at < folios_revision_corte()`, corte de 12 meses. Sigue igual tanto en el aviso como en la tarjeta.
- Trabajo futuro: fijar fecha efectiva de cierre y registrar explícitamente revisiones periódicas; calcular desde la última revisión registrada o, si no hay, desde el cierre, manteniendo aviso y tarjeta con una sola regla. Debe decidirse el tratamiento de folios históricos sin `fecha_cierre`, sin inventar fechas.

## Diagnóstico del motor futuro — propuesta, no construido
1. **Propiedad:** cada curso pertenece a un módulo mediante `modulo_clave`. Cerebro y Tendencias usarían las mismas tablas de módulos didácticos, lecciones, examen, intentos, diplomas y DC-3; los contenidos y criterios de evaluación serían de su propio curso, no una copia del examen de Riesgos.
2. **Acceso por curso:** catálogo de cursos incluidos en cada plan y concesiones individuales vigentes por empresa/curso (por ejemplo `organization_features.feature_key='curso:<id>'`). Validación en servidor para contenido, inicio de examen y emisión; no solo en menú. Mantener acceso al módulo separado del acceso pagado al curso.
3. **Compatibilidad:** trasladar `tiene_curso_pagado` y `curso_expira_en` a concesiones de los cursos actuales, conservando derechos existentes y resolviendo antes las diferencias trial señaladas. Los IDs legacy `nom241`/`nom059` del progreso requieren una correspondencia explícita con el ID del curso; no reemplazarlos perdiendo avances.
4. **Mis diplomas:** conservar la vista filtrada dentro de cada módulo; añadir después, en el perfil, una vista de todos los diplomas de la persona. Una capacitación vencida no debe ocultar diplomas ya obtenidos. Mantener aislamiento por empresa de solicitudes y documentos regulados.
5. **Stripe:** mapear cada precio/producto a curso y, si corresponde, al acceso temporal al módulo; en el webhook crear/renovar/revocar concesiones por curso con evento de pago idempotente y auditoría, en vez de activar el booleano global. Separar saldo y consumo DC-3 por la compra correspondiente, según reglas comerciales que se aprueben. Migrar compras previas sin duplicar accesos, certificados o saldos; manejar devoluciones y expiraciones sin borrar diplomas históricos.
6. **No decidido en P1c:** planes/precios de cursos futuros, si DC-3 será por curso o bolsa común, y acceso de compradores de curso sin módulo. Requieren decisión comercial antes del motor.