## Diagnóstico

**1. Capacitación no aparece en orgs trial**
En la BD las orgs trial tienen `subscription_status = 'trial'` (no `'trialing'`).
En `src/pages/Capacitacion.tsx` (línea 218) el chequeo solo acepta `["active","trialing","past_due"]`, así que `planActivo = false` y `tieneCurso = false` → al usuario trial se le muestra el bloque de "comprar curso" en lugar del curso.

**2. Faltan bloqueos de descarga en trial**
- Guías técnicas y lecciones tipo descarga → ya bloqueadas (tooltip + guard en `handleLeccionClick`).
- **Manual de Usuario** y **Glosario** (RECURSOS_TRACEA, líneas 634-651) → NO tienen guard `isTrial`, se pueden descargar libremente.
- Otras páginas con descargas: `Recursos.tsx`, `MisProtocolos.tsx`, `MisDiplomas.tsx`, `AdminRecursos.tsx`. Confirmar alcance antes de tocar.

## Cambios propuestos

### A. `src/pages/Capacitacion.tsx` — corregir acceso trial

Ampliar el set de status válidos para incluir `'trial'`:

```ts
const SUB_STATUS_ACTIVOS = ["", "active", "trialing", "trial", "past_due"];
const planActivo =
  PLANES_CON_CURSO.includes(planLower) &&
  SUB_STATUS_ACTIVOS.includes(subStatus);
```

Con esto, orgs `plan=trial` + `subscription_status=trial` verán el curso (con Módulo 1 desbloqueado y resto con candado, como ya está implementado).

### B. `src/pages/Capacitacion.tsx` — bloquear Manual y Glosario en trial

Aplicar el mismo patrón de `renderGuiaCard` (botón deshabilitado + tooltip `TRIAL_DOWNLOAD_TOOLTIP` + link a `/precios`) al bloque "Manual y Glosario" (líneas 634-651).

### C. Confirmar alcance del bloqueo de descargas

Antes de tocar más archivos, necesito saber si "ningún documento" incluye también:
- **Recursos** (`/recursos`): PNOs, formatos oficiales (ya tienen guard parcial — verificar).
- **Mis Protocolos** (`/mis-protocolos`): solo accesible si la org compró el addon — el trial no debería tenerlo, pero por defensa se puede bloquear igual.
- **Mis Diplomas**: descarga del diploma propio del usuario.

Mi recomendación: bloquear PNOs/formatos/manuales/glosarios/protocolos en trial, **pero permitir descargar el diploma propio** si el usuario trial llegara a obtenerlo (no aplica hoy porque trial no tiene acceso a evaluación, pero conviene no romperlo).

## Fuera de alcance
- Sin migraciones ni cambios en BD.
- Sin tocar `useCurso`, checkout, ni el bloqueo por módulos ya existente.
- Sin cambios en el límite de 10 consultas IA del trial (ya implementado).

¿Confirmas que aplique A+B y extienda C a Recursos.tsx también?