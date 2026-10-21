# T5d — Suplencias de plataforma

## Qué cambia
- Mover la pantalla de Suplencias a **Configuración › Suplencias**, independiente de contratar Tendencias. Admin y RS podrán designar; cada suplente podrá aceptar o rechazar su propia designación aunque su rol habitual sea otro.
- Elegir rol sustituido, titular y suplente de la empresa activa, inicio, fin y categoría: vacaciones, comisión, ausencia u otro. Exigir motivo para designar y terminar antes de tiempo, sin solicitar detalle médico.
- Mostrar estados **pendiente de aceptación, activa, rechazada y terminada**. La vigencia también se comprobará al usar un permiso, sin depender de que la pantalla esté abierta.
- Conservar las suplencias anteriores, su historial y avisos. No presumir aceptación de registros antiguos: permanecerán conservados y requerirán aceptación explícita para conceder permisos bajo la nueva regla.

## Permisos y trazabilidad
- Una sola suplencia aceptada por rol y empresa con fechas que se solapen; impedir también el solapamiento al aceptar, incluso con solicitudes simultáneas.
- Designa el titular o el otro rol autorizado con motivo: admin para RS y RS para admin. El superadministrador en soporte sigue siendo de solo lectura.
- Centralizar el permiso en **rol_efectivo(usuario, rol)**, calculado en el servidor para la empresa activa. Una suplencia de RS no concede admin; una de admin no permite autorizar AT.
- Aplicar la misma comprobación en Riesgos, Cerebro, Tendencias y plataforma, incluidas sus pantallas y operaciones protegidas. Mantener la separación entre elaboración y autorización y los demás requisitos actuales de firma.
- Conservar actor real y titular sustituido en cada acción y su auditoría, mostrando **«por suplencia de <titular>»**. No reescribir registros históricos ni firmas previas.
- Mantener el correo al titular y los reintentos sin envíos duplicados, adaptándolo también a suplencias de admin.

## Detalles técnicos
- Extender `org_suplencias` de forma aditiva con rol, estado, aceptación/rechazo/terminación y titular general; conservar columnas existentes para compatibilidad.
- Proteger transiciones y solapamientos en el servidor, con permisos de lectura suficientes para que el designado responda y sin autorización derivada del navegador.
- Mantener `has_role` compatible como punto de acceso a la comprobación común; adaptar contexto, funciones de suplencia anteriores y comprobaciones directas de rol que eludan ese punto. No reemplazar controles exclusivos de superadministrador ni ampliar permisos comerciales.
- Documentar la regla común en las instrucciones del proyecto y actualizar reglas anteriores de Tendencias que concedían permisos sin aceptación.

## Verificación
- Ejecutar la suite automática sin navegador, llamadas a IA ni cambios de dependencias; pruebas aisladas de QA y reversión, nunca datos de DIAFRA.
- Comprobar: RS aceptada autoriza AT y firma en Riesgos sin administrar usuarios; pendiente o vencida no concede permisos; dos suplencias solapadas del mismo rol se rechazan; admin no autoriza AT; quien elaboró no autoriza; aislamiento entre empresas; aceptación y terminación auditadas.
- Informar resultados y cualquier verificación que quede pendiente, sin presentar pruebas de lógica aislada como una firma real completada en pantalla.