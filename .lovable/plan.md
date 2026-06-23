## Cambios al diploma y a la página de verificación

### 1. Logo blanco en la banda azul del diploma
- Tomar el logo `TRACEA Academy` (ícono + texto + tagline) que adjuntaste y recolorearlo a blanco con fondo transparente.
- Subirlo como asset (`tracea-academy-blanco.png`) y reemplazar el logo actual de la cabecera navy en la edge function `emitir-diploma` (`supabase/functions/emitir-diploma/logo.ts` + uso en `index.ts`).
- Ajustar tamaño para que respire dentro de la banda (sin tocar bordes).

### 2. Firma desplazada hacia abajo
- En `emitir-diploma/index.ts` bajar la firma ~10–12 mm para que cubra parcialmente el nombre del instructor ("Jaime Del Castillo"), dejando legible el título "Instructor" y la línea.
- Mantener el tamaño actual (28×32 mm) y el centrado horizontal.

### 3. QR apuntando a `https://tracea.com.mx/diploma/verificar/{hash}`
- Forzar esa URL en la generación del QR (ya está así, pero se valida explícitamente).
- Eliminar cualquier fallback a `*.lovable.app`.

### 4. Eliminar leyenda "Verificación en línea: …"
- Quitar la línea de texto del pie del diploma; el QR queda como único mecanismo de verificación visual.

### 5. Logo limpio en la página de verificación
- Usar el mismo logo `TRACEA Academy` con letras azules en PNG transparente (sin recuadro blanco). Procesar el adjunto para asegurar transparencia real.
- Subir como asset y reemplazar la importación de `tracea-official.png` en `src/pages/DiplomaVerificar.tsx`.
- Eliminar el ícono `GraduationCap` decorativo y dejar solo el logo centrado.

### 6. Botón "Regenerar" en `/mis-diplomas`
- Ya existe. No se toca, pero sirve para que vuelvas a emitir el PDF con el diseño nuevo conservando el mismo folio y QR.

### Detalles técnicos
- Procesado de imágenes con `imagegen--edit_image` (versión blanca) y verificación de transparencia (versión azul).
- Assets vía `lovable-assets` CLI para que las edge functions y el front consuman URLs CDN estables.
- Despliegue de `emitir-diploma` al terminar.
- Sin cambios a tablas, RPCs, ni lógica de calificaciones/cumplimiento.
