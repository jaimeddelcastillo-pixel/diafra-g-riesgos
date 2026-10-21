# T5d — suplencias de plataforma

## Disponible
- Configuración › Suplencias: `/configuracion/suplencias`, independiente del contrato de Tendencias. La ruta anterior redirige; se retiró del menú de Tendencias.
- Designación del titular o del otro rol, motivo y categoría; aceptación/rechazo por el suplente; terminación anticipada con motivo. Los permisos exigen aceptación, vigencia y titular activo; no se mezclan RS y Admin.
- Registros existentes conservados sin reescribir: quedan pendientes de aceptación si no tenían aceptación registrada. Sus identidades anteriores siguen disponibles.
- Firma de Riesgos sobre la asignación del titular RS: identidad real del firmante y atribución congeladas; emisión AT por suplente RS, nunca por suplente Admin ni por quien elaboró/modificó.
- Avisos al titular conservan el mecanismo de envío idempotente, ahora también para Admin; no se enviaron correos de prueba.
- Auditoría insert-only conserva actor y titular; registros de los módulos incluyen última atribución, y firma/autoría emitida conserva los datos históricos.

## Funciones y comprobaciones migradas
### Resolución compartida
`rol_efectivo`, `has_role`, `mis_roles_efectivos`, `contexto_org_actual`, `puede_administrar_usuarios`, `suplencia_contexto`. El contexto compartido de funciones obtiene roles efectivos del servidor; `useAuth` usa esos roles para los controles y menús.

### Suplencias y Tendencias
`org_suplencias_guard`, `org_suplencias_acceso`, `org_suplencia_titular_snapshot`, `designar_suplencia`, `responder_suplencia`, `terminar_suplencia`, `tend_acceso`, `tend_suplencia`, `tend_firmante_autorizante`, `tend_at_guard`; control `useFacultadesTendencias` y comprobación `verificarAutorizante`.

### Riesgos
`firmar_folio_suplencia`, `dictaminar_folio_efectivo`, `pendientes_riesgos`; `folio-workflow` usa las RPC autenticadas para firma/dictamen y roles efectivos para convocatoria/reapertura. `FolioDetail` admite firma de la asignación del titular sustituido y muestra el actor; auditoría/PDF muestran la atribución. Los demás controles `hasRole` resuelven los roles efectivos compartidos.

### Cerebro y Recursos
`brain_documents_estado_guard`, `brain_knowledge_items_governance`, `brain_knowledge_items_revision_guard`, `brain_resolver_enlace`, `pendientes_cerebro`, `org_documentos_copia_guard`, `retirar_documento`, `confirmar_catalogo_documentos`, `puede_editar_catalogo_documentos`, `pendientes_configuracion`.

### Funciones desplegadas con contexto/permisos efectivos
`create-user`, `delete-user`, `reset-user-password`, `send-welcome-email`, `folio-workflow`, `tend-aviso-suplencia`, `auditoria-invitar`, `tend-extract-bitacora`, `brain-import-listado`, `brain-interview`, `customer-portal`, `org-documento-huella`, `brain-extract-document`, `create-checkout`. Un suplente RS no tiene permiso de administrar usuarios; el titular RS conserva su permiso previo.

### Atribución
`audit_suplencia_contexto`, `registro_suplencia_contexto`, `firma_suplencia_identidad`.

## Controles deliberadamente no convertidos
- `get_user_org_id`, `set_org_activa`, `mis_organizaciones`, `same_org_member`, `nombres_personas`: comprueban membresía/empresa/identidad, no autoridad delegable.
- `crear_sesion_entrevista` y validaciones de usuarios elegibles: comprueban pertenencia/asignación; la elegibilidad Autorizó sí usa `tend_firmante_autorizante` → `rol_efectivo`.
- Superadministración, registro inicial, facturación automática y destinatarios titulares de avisos conservan sus reglas propias; una suplencia no convierte a nadie en superadministrador ni cambia el titular destinatario.
- No se sustituyeron controles de autoría, asignación personal o firma histórica por rol efectivo: no son permisos de rol.

## Verificación y límites
- Suite automática: **279/279 pruebas, 33 archivos**. Ocho pruebas nuevas ejecutan funciones reales sobre tablas temporales QA con reversión; comprueban motivo/designación, aceptación, vencimiento, solapamiento, aislamiento RS/Admin, emisión AT, firma Riesgos y atribución.
- Las pruebas SQL aíslan empresa/sesión/módulo: no verifican RLS ni sesión productiva completa.
- Sin navegador, llamadas IA, envío de correo real ni cambios de dependencias. La comprobación visual y el recorrido autenticado quedan pendientes por la restricción solicitada.
- La suite existente de pg_safeupdate informa que el entorno no permite cargar esa biblioteca: no afirmar verificación con la extensión activa.
