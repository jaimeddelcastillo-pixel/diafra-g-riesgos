## Objetivo
Permitir a una org comprar **packs de 100 consultas IA** (pago único en Stripe) que se suman a su límite mensual sin alterar el plan. Las extras no caducan y se consumen **después** de agotar el límite del plan del mes.

## Contexto encontrado
- Contador mensual: `chat_uso_mensual.mensajes_consumidos` (org/year/month).
- Límite IA por plan: `PLAN_LIMITS` dentro de `supabase/functions/chat-asistente/index.ts` (starter=30, professional=300, enterprise=ilimitado).
- Gate de límite hoy: `chat-asistente` corta con HTTP 429 `limite_alcanzado` cuando `usage >= limit`.
- Stripe checkout one-time ya existe en `create-checkout` (modo `payment`) y el webhook ya maneja `checkout.session.completed` para addons (`curso`, `protocolos`, `dc3_extra`) registrándolos en `addon_purchases`.
- Catálogo en frontend: `src/config/plans.ts` (`PLANS`, `ADDONS`).
- UI contador: `src/components/AssistantPanel.tsx` (`refreshUsage`).

## Cambios propuestos

### 1. Base de datos (migración)
Agregar a `public.organizations`:
- `consultas_ia_extras INTEGER NOT NULL DEFAULT 0`

No se reinicia con el ciclo mensual. Solo aumenta por compra y baja por consumo.

### 2. Catálogo (frontend + edge)
- `src/config/plans.ts`: nuevo tipo `AddonId | "consultas_ia_100"` con entrada en `ADDONS`:
  - Nombre: "Pack 100 consultas IA"
  - Precio: `$15 USD` (placeholder hasta que el usuario pase el Price ID real)
  - Descripción: "Se suman a tu límite mensual actual. No caducan hasta ser usadas."
  - `priceId`: **placeholder `price_PENDIENTE_CONSULTAS_IA_100`** — se reemplaza por el real cuando el usuario lo provea.
- `supabase/functions/create-checkout/index.ts`: añadir el price al `PRICE_CATALOG` con `mode: "payment"`, `producto: "consultas_ia_100"`.
- `supabase/functions/stripe-webhook/index.ts`: añadir al `PRICE_TO_PRODUCT` y `PLAN_LABELS`.
- Constante compartida `CONSULTAS_POR_PACK = 100` en el webhook (en caso de futuros packs de otro tamaño, dejar el handler genérico por producto).

### 3. Webhook Stripe — acreditar pack
En `stripe-webhook`, dentro de `checkout.session.completed`, ramal `session.mode === "payment"`:
- Si `producto === "consultas_ia_100"`:
  1. `UPDATE organizations SET consultas_ia_extras = consultas_ia_extras + 100 WHERE id = org_id`.
  2. Insertar registro en `addon_purchases` (igual que los otros addons).
  3. Enviar correo nuevo `consultas-ia-acreditadas` al admin (asunto: "100 consultas IA agregadas a tu cuenta") — plantilla nueva en `_shared/transactional-email-templates/consultas-ia-acreditadas.tsx` + registry. CTA al asistente IA.
- Agregar el mismo manejo en `checkout.session.async_payment_succeeded` para OXXO.

### 4. Edge `chat-asistente` — consumir extras tras agotar plan
Archivo: `supabase/functions/chat-asistente/index.ts`
- En `getOrgContext` agregar `consultas_ia_extras` al SELECT.
- Reemplazar el gate actual:
  ```
  limite_efectivo = limit + extras
  if (limit !== -1 && usage >= limite_efectivo) → 429 limite_alcanzado
  ```
- Después de `bumpUsage`, si `usage_nuevo > limit` (es decir, se consumió una extra) y `limit !== -1`:
  - `UPDATE organizations SET consultas_ia_extras = GREATEST(consultas_ia_extras - 1, 0) WHERE id = org_id`.
- Devolver en la respuesta de error y en el header de stream `usage`, `limit` y `extras` (para que el UI muestre `X / Y (+ Z extras)`).

### 5. UI — AssistantPanel
Archivo: `src/components/AssistantPanel.tsx`
- `refreshUsage`: además de `chat_uso_mensual`, leer `organizations.consultas_ia_extras` (ya disponible vía `org` del contexto; añadir a la query).
- Estado: `{ used, limit, extras }`.
- Contador: `"X / Y consultas este mes (+ Z extras disponibles)"`. Si `extras === 0` ocultar el sufijo.
- En la pantalla de límite alcanzado (la que se implementa en el upgrade self-service), agregar un **tercer botón outline**: `"Comprar 100 consultas — $15 USD"` → `startCheckout(consultasIaPack.priceId)` reutilizando el flujo existente del catálogo. Al volver del checkout, refrescar `usage` automáticamente.

### 6. UI — /precios (sección nueva)
Archivo: `src/pages/Precios.tsx`
- Sección **"Consultas adicionales"** debajo de Addons (o antes, según jerarquía visual).
- Card única: "Pack 100 consultas — $15 USD" con copy especificado y botón "Comprar" → `startCheckout` existente.
- Disponible para cualquier org con suscripción activa o trial (mismo gate que addons actuales).

### 7. Sin cambios necesarios
- RLS de `organizations` ya cubre lectura para miembros, escritura solo admin — la actualización del contador se hace con service role desde edge functions, OK.
- No se requiere reset del campo en webhook de renovación: las extras **no caducan**.

## Detalles técnicos
- **Idempotencia del acreditado**: usar `stripe_session_id` único en `addon_purchases` como evidencia. Antes de incrementar `consultas_ia_extras`, verificar que no exista ya `addon_purchases.stripe_session_id = session.id` (Stripe puede reintentar el webhook).
- **Orden de consumo**: implícito — primero se gasta el cupo del plan (que vive en `chat_uso_mensual`), después se descuenta de `consultas_ia_extras`. El usuario nunca pierde extras mientras tenga cupo del plan.
- **Enterprise (ilimitado)**: si `limit === -1`, la lógica de extras se ignora y el contador UI muestra solo "Ilimitado".
- **Precio ID pendiente**: el usuario debe entregar el `priceId` real de Stripe; lo pongo como placeholder y al recibirlo lo reemplazo en `plans.ts`, `create-checkout` y `stripe-webhook` (una sola edición).
- **Auditoría**: cada incremento queda en `addon_purchases` + `audit_trail` automático del `UPDATE` a `organizations`.

## Entregables en orden
1. Migración: campo `consultas_ia_extras`.
2. `create-checkout`: registrar nuevo `priceId` (placeholder).
3. `stripe-webhook`: acreditar pack + email + idempotencia.
4. Plantilla email `consultas-ia-acreditadas` + registry + deploy.
5. `chat-asistente`: gate efectivo con extras + descuento + payload con `extras`.
6. UI: `plans.ts`, `AssistantPanel` (contador + tercer botón), `Precios` (sección nueva).

## Fuera de alcance
- Packs de distinto tamaño (50/250/1000) — la arquitectura lo soporta agregando entradas en el catálogo, pero hoy solo se entrega el de 100.
- Caducidad de extras.
- Reembolso parcial de extras al cancelar plan.

## Pregunta antes de implementar
- ¿Confirmas **$15 USD** y **100 consultas** por pack y me pasarás el `priceId` real de Stripe para reemplazarlo?
