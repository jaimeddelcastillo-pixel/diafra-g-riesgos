## Objetivo

Cambiar el folio de diploma de `DIP-YYYY-NNN` (global TRACEA) a `DIP-YYYY-{SLUG_EMPRESA}-NNN`, con numeración independiente por empresa y año.

Ejemplos:
- QA NOM-059 Sandbox (slug `qa-nom059`) → `DIP-2026-QA-NOM059-001`
- Diafra (slug `diafra`) → `DIP-2026-DIAFRA-001`

Cada empresa tendrá su propio contador desde 001, igual que ya hacemos con los tickets (`TKT-{SLUG}-YYYY-NNN`).

## Cambios

**1. Base de datos**

- Ampliar `diploma_sequence` para llevar contador por `(org_id, year)` en lugar de solo `year`.
  - Migrar la fila actual (`2026 → 2`) como contador histórico de TRACEA para no perder consistencia.
- Reescribir la función `next_diploma_folio(p_org_id uuid)`:
  - Toma el slug de la organización (UPPER, sin espacios).
  - Inserta/incrementa el contador para `(org_id, year)`.
  - Devuelve `DIP-YYYY-{SLUG}-NNN`.
- Mantener compatibilidad: los diplomas ya emitidos (`DIP-2026-001`, `DIP-2026-002`) conservan su folio actual — solo cambian los nuevos.

**2. Edge Function `emitir-diploma`**

- Pasar `org_id` al llamar `next_diploma_folio`.
- Actualizar el comentario de cabecera con el nuevo formato.

**3. Verificación**

El QR y la página `/diploma/verificar/:hash` usan `hash_verificacion`, no el folio, así que no requieren cambios.

## Detalle técnico

```sql
ALTER TABLE public.diploma_sequence ADD COLUMN org_id uuid;
-- nueva PK compuesta (org_id, year); NULL = histórico TRACEA
```

`next_diploma_folio(p_org_id uuid)` arma el folio con:
```
'DIP-' || year || '-' || UPPER(REPLACE(slug,'-','')) || '-' || LPAD(num,3,'0')
```

## Fuera de alcance

- No se renumeran ni renombran diplomas ya emitidos.
- No se cambia el diseño del PDF ni el flujo de aprobación del examen.
