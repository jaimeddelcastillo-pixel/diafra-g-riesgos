# K1 — Catálogos de Indicadores del SGC y puestos

## Alcance
- Añadir **Calidad › Indicadores**, controlado por el acceso de la empresa al módulo `indicadores`, sin activarlo automáticamente en empresas ni asignarlo a planes.
- Tres pestañas: **Diccionario SGC**, con filtros por proceso/nivel; **Por puesto**, agrupada por puesto y con los códigos SGC a los que aporta; **Puestos**, independiente del perfil de usuario.
- Formularios para todos los campos solicitados, ayuda ⓘ por campo, motivo obligatorio de al menos cinco caracteres y retiro mediante **activo = No**, sin borrar registros.
- Avisar cuando los pesos SGC o de un puesto no sumen 100 %, sin bloquear la aplicación.

## Roles y validación
- Crear **Aseguramiento de Calidad (AC)**. Admin, RS y AC editan Indicadores; únicamente RS y AC validan; los demás usuarios con acceso al módulo consultan. Superadministrador en soporte permanece en lectura.
- Fuera de Indicadores, AC tiene los permisos de Comité Técnico, nunca los exclusivos del RS ni administración de usuarios por ser AC.
- Incorporar AC a las suplencias compartidas, conservando aceptación, vigencia, separación de roles, historial y atribución al titular. Admin/RS podrán designar la suplencia de AC; el titular AC podrá designar la propia, sin administrar suplencias de admin o RS.
- Si cambia fórmula, meta, tendencia o unidad de un KPI validado, devolverlo a **borrador** y limpiar la validación anterior. La validación siempre la realiza una persona autorizada.

## Excel y pendientes
- Plantilla vacía y exportación actual con hojas **Puestos**, **KPI_SGC** y **KPI_Puesto**, incluida `aporta_a` con códigos separados por coma.
- Vista previa **nuevo / cambia (antes → después) / sin cambio / error**. Bloquear duplicados, referencias inexistentes y tendencia/unidad/frecuencia/meta inválidas; resolver también referencias incluidas en el mismo archivo.
- Aplicar todo en una transacción con motivo y auditoría; los KPI importados quedan en borrador. Conservar los registros ausentes del archivo.
- Añadir **KPI en borrador por validar** a Mis pendientes de RS/AC, únicamente con el módulo activo y semáforo de gestión; incluir ambos catálogos KPI.

## Detalles técnicos
- Primera migración independiente: nuevo valor `aseguramiento_calidad` en `app_role`. Migraciones posteriores: rol efectivo/suplencias, tablas `puestos`, `kpi_definiciones`, `kpi_puesto` y `kpi_puesto_aporta`, funciones, RLS y permisos explícitos.
- Empresa y permisos derivados exclusivamente del contexto del servidor. Claves y referencias limitadas a la misma empresa; guardas contra DELETE y cambios de empresa, motivo obligatorio y auditoría inmutable en `audit_trail` con antes/después y actor real.
- `kpi_guard` protege edición/validación/retiro; funciones de escritura motivadas y `aplicar_kpis_excel` por conjuntos. Todo UPDATE lleva WHERE para respetar pg_safeupdate.
- Registrar el módulo con su carpeta propia y adaptador Excel independiente. Cambiar únicamente los puntos compartidos necesarios: registro, controles de rol, suplencias, activación empresarial y etiquetas/función de pendientes. No editar archivos de Tendencias ni Riesgos.
- Usar los controles, estilos y paquetes existentes; documentar la nueva estructura y las reglas de autorización en AGENTS.md.

## Verificación y entrega
- Ejecutar solo la suite automática, sin navegador, llamadas a IA ni cambios de dependencias. Datos de prueba aislados, nunca DIAFRA.
- Añadir pruebas de importación de puestos/KPI y enlaces, retorno a borrador, errores bloqueantes y reversión atómica, retiro sin borrado, operador sin edición y validación exclusiva RS/AC; comprobar aislamiento empresarial y suplencias AC sin permisos RS.
- Respuesta final de máximo diez líneas con archivos/migraciones, permisos efectivos AC, pendiente nuevo y resultado de la suite. La revisión en pantalla queda sin verificar por tu restricción.