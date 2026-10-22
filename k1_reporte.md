# K1 — Catálogos de Indicadores y puestos

## Entrega
- `/indicadores`, menú Calidad: Diccionario SGC, Por puesto y Puestos; ayuda por campo, filtros, pesos, detalle/edición, retiro activo=No y validación motivada.
- Plantilla vacía/exportación `.xlsx`, tres hojas, vista previa y aplicación atómica independiente de Tendencias. Referencias del mismo archivo, duplicados y valores inválidos comprobados; ausentes conservados.
- Puestos independiente de profiles.cargo. Código técnico adicional en KPI por puesto para identificar filas en Excel y actualizaciones.
- Indicadores registrado, sin activar ninguna empresa ni modificar planes. Superadministrador puede activarlo mediante el control compartido de módulos.

## Permisos
- Admin, RS y AC editan. Solo RS y AC validan. Operador, Lectura y Comité consultan con módulo activo. Soporte solo lectura.
- AC tiene rol efectivo Comité fuera de Indicadores, sin RS implícito ni administración de usuarios. El contexto de presentación adapta las pantallas antiguas sin editar archivos de Riesgos/Tendencias; la autorización sigue en servidor.
- AC puede designar su suplencia propia; admin/RS pueden designar la de AC. Solo aceptación vigente concede AC. Conserva titular en auditoría, sin autorizar AT ni dictamen RS por ser AC.
- Cambios de fórmula/meta/tendencia/unidad devuelven a borrador y limpian validación. Otros cambios manuales conservan validación; Excel siempre fuerza borrador, incluso si el cliente envía la bandera contraria.
- Tablas con lectura RLS, sin privilegios de escritura directa para authenticated. Escrituras por funciones auditadas, empresa derivada del servidor; función interna no invocable por authenticated.

## Migraciones aplicadas
- 0088_k1_rol_aseguramiento_calidad.sql
- 0089_k1_roles_suplencias.sql
- 0090_k1_catalogos_indicadores.sql
- 0091_k1_excel_y_pendientes.sql
- 0092_k1_escritura_manual_controlada.sql
- 0093_k1_auditoria_suplencia_ac.sql
- 0094_k1_preservar_validacion_manual.sql

## Archivos principales
- src/modules/indicadores/Indicadores.tsx, module.ts, lib/catalogo.ts, lib/persistencia.ts y lib/catalogo.test.ts.
- src/test/k1-indicadores-sql.test.ts y k1-rol-presentacion.test.ts; fixtures compartidos de pendientes y soporte actualizados.
- src/lib/rol-presentacion.ts; registro de módulos, contexto/etiquetas de roles, Configuración, Suplencias, activación empresarial y etiquetas de pendientes.
- create-user reconoce AC; función desplegada. No se crearon ni cambiaron usuarios reales.

## Pendiente
`kpi_por_validar`: «KPI en borrador por validar», ambos catálogos activos, únicamente RS/AC con Indicadores activo, perfil gestión y semáforo existente. Admin conserva acceso a pendientes de empresa, pero no recibe los KPI por validar al no ser validador.

## Verificación
Suite automática final: **329/329**, **39 archivos**, sin errores no controlados, ejecutada con forks y sin paralelismo entre archivos. Señal de compilación: OK.
SQL real copiado a tablas temporales QA con rollback: importación, auditoría, cuatro cambios críticos, preservación no crítica, reversión por error, retiro sin borrado, operador bloqueado, validación RS/AC/admin, importación siempre borrador, módulo/empresa, motivo, pendientes y suplencia AC con titular auditado.
No navegador, llamadas a IA, actualización/instalación de dependencias ni edición de archivos de Tendencias/Riesgos. No se probó un recorrido de sesión real ni la presentación en pantalla, por restricción explícita; las pruebas SQL no equivalen a esos recorridos.