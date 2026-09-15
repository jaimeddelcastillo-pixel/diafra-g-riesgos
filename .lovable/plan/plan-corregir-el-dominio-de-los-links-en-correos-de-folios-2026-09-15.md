# Plan: Corregir el dominio de los links en correos de folios

## Diagnóstico (confirmado)

El correo de votación/firma usa el link viejo `https://diafra-g-riesgos.lovable.app` porque:

- `supabase/functions/folio-workflow/index.ts` (línea 18) construye los links con la variable de entorno `APP_URL`.
- Esa variable quedó guardada con el dominio viejo de un despliegue anterior (`diafra-g-riesgos.lovable.app`), y el fallback del código es un placeholder (`https://tu-app.lovable.app`).
- Otros módulos (bienvenida, diplomas, DC-3) ya resolvieron esto fijando `https://tracea.com.mx` directo en el código, ignorando la variable heredada. `folio-workflow` nunca se actualizó igual.

## Cambio propuesto

1. **`supabase/functions/folio-workflow/index.ts`**: fijar el dominio productivo igual que `send-welcome-email` y `emitir-diploma`:
   ```ts
   // Forzamos el dominio productivo ignorando cualquier APP_URL heredado
   const APP_URL = "https://tracea.com.mx";
   ```
   Esto cubre los 5 puntos donde se genera link (votación, envío a firma, dictamen, recordatorios).

2. **Barrido de consistencia (opcional pero recomendado)**: aplicar el mismo ajuste a las funciones que aún dependen de `APP_URL` y pueden heredar el valor viejo:
   - `ticket-notify`, `stripe-webhook`, `org-action`, `customer-portal`, `check-folios-revision`, `check-trial-expiry`, `check-curso-expiry`, `create-checkout`, `chat-asistente`, `public-demo-signup`.
   - Nota: varias ya tienen fallback correcto a `tracea.com.mx`; el riesgo real es solo si `APP_URL` está definida con el valor viejo (que es lo que pasa hoy, confirmado por el correo recibido).

3. **Actualizar la variable `APP_URL`** en los secretos del backend al valor correcto `https://tracea.com.mx`, para que cualquier función futura que la lea ya traiga el dominio bueno.

4. **Redespliegue** de las funciones modificadas y prueba: solicitar votación de un folio en borrador y verificar que el link del correo apunte a `https://tracea.com.mx/folios/...`.

## Detalles técnicos

- Sin cambios de base de datos ni de esquema.
- Sin cambios en plantillas de correo (ya reciben `link` como prop).
- Riesgo: ninguno; el dominio `tracea.com.mx` ya es el primario publicado.
