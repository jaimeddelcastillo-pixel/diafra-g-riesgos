
## Aclaración clave

Dos artefactos independientes:

| | Diploma TRACEA Academy | DC-3 STPS |
|---|---|---|
| Cuándo | Automático al aprobar ≥80% | Solicitud manual a petición del alumno |
| Costo | Incluido en el curso | $35 USD (o 1 incluido con `tiene_curso_pagado`/saldo) |
| Entrega | Inmediata, PDF en `/mis-diplomas` | 2-3 días hábiles vía correo, TRACEA lo emite ante SIRCE |
| Verificable | QR → `/diploma/verificar/{hash}` | No (es constancia oficial STPS) |

El diploma actual **no se toca**. El DC-3 se añade como flujo nuevo encima.

## Parte 1 — Acceso al curso (`src/pages/Capacitacion.tsx`)

Reemplazar:
```ts
const tieneCurso = org?.tiene_curso_pagado === true || planLower === "enterprise";
```
por:
```ts
const PLANES_CON_CURSO = ["starter","professional","enterprise","trial"];
const planActivo =
  PLANES_CON_CURSO.includes(planLower) &&
  ["active","trialing","past_due"].includes(org?.subscription_status ?? "");
const tieneCurso = planActivo || org?.tiene_curso_pagado === true;
```

UI bloqueado (`!tieneCurso`): mantener CTA actual + añadir segundo CTA "Contrata un plan desde $85 USD/mes" → `/planes`.

## Parte 2 — DC-3 como solicitud manual (encima del diploma)

### 2.1 Migración

Tabla nueva `dc3_solicitudes` (no toca `capacitacion_progreso` que es por lección):

```
id, user_id, org_id, curso_id (uuid), diploma_id (uuid, fk curso_diplomas, nullable),
intento_id, curso_titulo, curso_norma, calificacion,
email_destino, plan_org, fuente ('incluido'|'comprado'),
estado ('pendiente'|'enviado'|'cancelado') default 'pendiente',
solicitado_en, enviado_en, enviado_por, dc3_url, notas_admin,
created_at, updated_at
```

RLS:
- GRANT SELECT,INSERT a `authenticated`; ALL a `service_role`.
- Policy SELECT/INSERT propio (`user_id = auth.uid()`).
- Policy SELECT/UPDATE para `is_super_admin()`.

Constraint único parcial: un `pendiente`/`enviado` por `(user_id, curso_id)` para evitar duplicados.

### 2.2 Edge Function nueva `solicitar-dc3`

Entrada: `{ diploma_id }` (alumno ya tiene diploma emitido).

Lógica:
1. Validar auth y dueño del diploma.
2. Verificar que no haya solicitud activa para ese curso.
3. Determinar saldo:
   - `tiene_curso_pagado=true` → fuente `incluido`; al confirmar set `tiene_curso_pagado=false`.
   - `dc3_adicionales_disponibles>0` → fuente `comprado`; decrementar.
   - Sin saldo → responder `{ requires_payment: true, priceId }` y el frontend abre checkout DC-3 (`price_1TbRUHKfwzAg4OKvWE8uMR6y`). El webhook ya incrementa el saldo; al volver el alumno reintenta.
4. Insertar `dc3_solicitudes` estado `pendiente`.
5. Disparar dos correos vía `send-transactional-email`:
   - `dc3-solicitud-recibida` (al alumno).
   - `dc3-solicitud-interna` (a `soporte@tracea.com.mx`) con nombre, empresa, curso, calificación, email destino, plan, link `/admin/dc3`.

### 2.3 Plantillas de correo nuevas

En `supabase/functions/_shared/transactional-email-templates/`:
- `dc3-solicitud-recibida.tsx` — confirmación al alumno, 2-3 días hábiles, contacto soporte.
- `dc3-solicitud-interna.tsx` — interno, con todos los datos del trámite.
- `dc3-enviado.tsx` — opcional, cuando admin marca enviado y adjunta link.

Registrar en `registry.ts`. Deploy `send-transactional-email`.

### 2.4 Frontend — `/mis-diplomas` (NO eliminar nada existente)

En cada card de diploma existente, añadir bloque "Constancia DC-3 oficial STPS":
- Si no hay solicitud → botón:
  - Con saldo: azul "Solicitar mi DC-3 — Sin costo adicional".
  - Sin saldo: naranja "Obtener mi DC-3 oficial — $35 USD".
  - Texto informativo: "ℹ️ El DC-3 es constancia oficial con validez STPS. Lo recibirás en 2-3 días hábiles."
- Si solicitud `pendiente` → badge "DC-3 en trámite — recibirás respuesta en 2-3 días".
- Si `enviado` → badge verde "DC-3 enviado" + link `dc3_url` si existe.

### 2.5 Frontend — `ExamenFinal.tsx`

Pantalla de aprobación (mantener emisión automática de diploma):
- Mensaje actual del diploma.
- **Bloque añadido**: "¿Necesitas tu DC-3 oficial STPS?" con CTA según saldo (mismo componente que `/mis-diplomas`), nota 2-3 días hábiles, y enlace "Más tarde desde Mis diplomas".

### 2.6 Panel admin — `/admin/dc3`

Nueva página `src/pages/AdminDC3.tsx` (visible solo `is_super_admin`):
- Tabla con filtros (pendiente/enviado/todos): Nombre · Empresa · Curso · Calificación · Email · Fecha solicitud · Fuente · Estado · Acciones.
- Acción "Marcar como enviado" → dialog: campo opcional para subir PDF al bucket `diplomas` (carpeta `dc3/`) o pegar URL + notas → set `estado='enviado'`, `enviado_en`, `enviado_por`, `dc3_url`. Opcional: enviar `dc3-enviado` al alumno.
- Ruta en `App.tsx`, link en `AppSidebar` (sección Admin) y card en `/admin`.

## Fuera de alcance

- Nada toca `emitir-diploma`, `curso_diplomas`, regeneración ni verificación pública del diploma.
- Sin cambios en webhook Stripe (ya acredita `dc3_adicionales_disponibles`).
- Sin cambios en la evaluación.

## Confirmación antes de implementar

1. ¿OK tabla nueva `dc3_solicitudes` (recomendado) en lugar de columnas en `capacitacion_progreso`?
2. Email interno destino: ¿`soporte@tracea.com.mx`?
3. ¿Subir PDF del DC-3 al bucket `diplomas/dc3/` o solo guardar URL externa?
