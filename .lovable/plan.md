## Objetivo
Añadir opción de facturación **Anual** (además de Mensual) para los 3 planes, con la misma UX de la landing: toggle, equivalente mensual grande y leyenda "Facturado $X/año · Ahorras 2 meses".

## Price IDs anuales confirmados
- Starter Anual: `price_1TomoLKfwzAg4OKvmI0g6yJ4` — $850 USD/año ($70.83/mes)
- Professional Anual: `price_1TomrAKfwzAg4OKvbEgQq9f3` — $2,250 USD/año ($187.50/mes)
- Enterprise Anual: `price_1TompOKfwzAg4OKvr8GGv5XJ` — $4,750 USD/año ($395.83/mes)

Los mensuales existentes (`price_1TQ7jK...`, `price_1TQ7jF...`, `price_1TQ7jK...jXcDjzgn`) se conservan intactos.

## Cambios

### 1. Catálogo de planes (`src/config/plans.ts`)
Ampliar `Plan` con `priceIdAnnual`, `precioAnual` (total facturado) y `precioMensualEquivalente`. Poblar los 3 planes con los IDs y montos anuales. `findPriceConfig` reconocerá también los anuales.

### 2. UI de precios (`src/pages/Precios.tsx` y `src/components/PlanSubscriptionCard.tsx`)
- Toggle **Mensual / Anual** (ToggleGroup) arriba de las tarjetas.
- En modo Anual: mostrar precio grande = equivalente mensual, subtexto "Facturado $X USD/año · Ahorras 2 meses".
- El botón "Contratar" envía al checkout el `priceId` correspondiente al intervalo activo.
- Badge "Ahorra 2 meses" visible cuando el toggle está en Anual.

### 3. Checkout (`supabase/functions/create-checkout/index.ts`)
Registrar los 3 nuevos Price IDs en `PRICE_CATALOG` con `mode: "subscription"` y producto `starter|professional|enterprise` (mismo producto lógico; el intervalo lo determina Stripe). Sin cambios de lógica: ya recibe `priceId` desde el cliente.

### 4. Guardar intervalo en BD (migración)
- Añadir columna `billing_interval TEXT` en `public.organizations` (valores `'month' | 'year'`, default NULL).
- Actualizar desde `stripe-webhook` (`customer.subscription.created` y `.updated`) leyendo `subscription.items.data[0].price.recurring.interval`. Guardar también en `checkout.session.completed` cuando aplique.

### 5. Webhook (`supabase/functions/stripe-webhook/index.ts`)
En los handlers de suscripción, extraer `interval` y persistir en `organizations.billing_interval`. Además, mapear `price.id` → `plan` usando lookup por producto (permite ignorar cuál ID específico fue).

### 6. Mostrar ciclo al cliente (`src/components/PlanSubscriptionCard.tsx` / panel de suscripción)
Renderizar "Plan Pro · Anual · Renueva el DD/MM/AAAA" usando `billing_interval` + `current_period_end` ya disponible.

### 7. Cambio de plan (upgrade/downgrade/switch anual↔mensual)
La lógica `action: "change_plan"` en `create-checkout` ya soporta cualquier `priceId` de suscripción; funciona sin cambios para migrar entre intervalos con proration automática.

## Fuera de alcance
- No se migran suscripciones existentes en mensual (siguen igual hasta que el cliente pida cambio).
- No se tocan addons ni el pack de consultas IA.

## Verificación
- Toggle cambia precio mostrado y `priceId` enviado.
- Checkout test con `4242 4242 4242 4242` para los 3 planes anuales.
- Webhook guarda `billing_interval='year'` en `organizations`.
- Panel del cliente muestra "· Anual · Renueva el …".
