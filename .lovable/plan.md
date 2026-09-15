# Separar la convocatoria a votación del envío a firma

Hoy el comité solo se entera del folio cuando ya se envió a firma: ese es el único momento en que sale un correo. Por eso, al intentar enviar a firma, el sistema avisa que varios miembros no han votado — nunca fueron invitados a votar.

## Qué se va a hacer

**1. Nuevo botón "Solicitar votación del comité"**
Aparece en el folio mientras está en Borrador, junto al botón de enviar a firma. Lo puede usar quien creó el folio, un administrador o el Responsable Sanitario.

Al pulsarlo:
- Envía un correo a cada miembro del comité con liga directa al folio, invitándolos a revisar y votar.
- El folio se queda en Borrador (la votación ocurre en Borrador, como hoy).
- Se puede volver a pulsar para reenviar recordatorio a quienes aún no han votado; en ese caso el correo solo va a los pendientes.
- Queda registro en la bitácora de auditoría (quién convocó, cuándo, a quiénes).

**2. Correo nuevo de convocatoria a votación**
Distinto al de firma: asunto y texto de "Se solicita tu revisión y voto", con el resumen del folio (código, proceso, norma, número de Ids) y el botón "Revisar y votar". Sin el texto legal de firma electrónica, que no aplica aquí.

**3. El correo de firma se enfoca en el Responsable Sanitario**
Al enviar a firma se sigue notificando a los miembros que deben firmar y al Responsable Sanitario (como hoy), pero el aviso al RS cambia a un correo propio de "Folio listo para dictamen", que incluye el resultado de la votación: cuántos aprobaron, cuántos con observaciones, cuántos pendientes.

**4. Aviso más claro al enviar a firma**
Si quedan miembros sin votar, además de preguntar si deseas continuar, se ofrece la opción de enviarles primero la convocatoria a votación.

## Detalles técnicos

- `folio-workflow`: nueva acción `solicitar-votacion` (valida org, estado Borrador y rol; consulta `comite_votos` para excluir a quien ya votó; envía vía `send-transactional-email` con `idempotencyKey` por ronda para permitir recordatorios; inserta registro en `audit_trail`).
- Nuevas plantillas en `_shared/transactional-email-templates/`: `folio-solicitud-votacion.tsx` y `folio-listo-dictamen.tsx`, registradas en `registry.ts`, usando `TraceaShell`.
- En `enviar-a-firma`, la notificación al aprobador final pasa a `folio-listo-dictamen` con el conteo de votos; la de miembros sigue en `folio-enviado-firma`.
- `FolioDetail.tsx`: botón y handler nuevos; en `handleEnviarAFirma`, el confirm de pendientes ofrece la acción de convocar.
- Sin cambios de esquema.
