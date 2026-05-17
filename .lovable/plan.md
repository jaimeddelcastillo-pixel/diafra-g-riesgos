## Cambios en `src/pages/Capacitacion.tsx`

### 1. Filtrar por norma de la organización
Leer `org.norma_aplicable` (`'NOM-241' | 'NOM-059' | 'MULTI' | null`). Definir:
```ts
const norma = org?.norma_aplicable ?? "MULTI";
const showDM  = norma === "NOM-241" || norma === "MULTI" || !org?.norma_aplicable;
const showMed = norma === "NOM-059" || norma === "MULTI" || !org?.norma_aplicable;
```

**Sección 1 – Biblioteca:**
- Anotar cada guía con `norma: "NOM-241" | "NOM-059"` (ya existe `badge`, lo reutilizo).
- Filtrar `GUIAS` según `showDM` / `showMed`.
- Cuando es MULTI/null: agrupar visualmente con dos subtítulos ("Dispositivos Médicos · NOM-241" y "Medicamentos · NOM-059") como separador. En caso de norma única, no mostrar separador (solo "Guías Técnicas").

**Sección 2 – Cursos:**
- Renderizar Curso NOM-241 solo si `showDM`.
- Renderizar Curso NOM-059 (Próximamente) solo si `showMed`.
- Si por norma queda solo el de Medicamentos, ese se ve como tarjeta "Próximamente" (no hay curso activo aún) — mantener mismo card bloqueado.

### 2. Acceso al curso para plan trial
Actualizar lógica:
```ts
const tieneCurso =
  !!org?.plan &&
  (PLANES_CON_CURSO.includes(org.plan.toLowerCase()) || org.plan.toLowerCase() === "trial");
```
Esto da acceso completo a la Sección 2 a cuentas trial activadas manualmente por super_admin.

### 3. No requiere cambios de código (informativo)
Sobre la corrección 3: el super_admin puede ajustar `organizations.plan` desde `/admin`; no se toca código de Capacitación.

### Archivos tocados
- `src/pages/Capacitacion.tsx` (único).
- Sin migraciones, sin cambios en sidebar/rutas, sin nuevas dependencias.

### QA
- Verificar visual con `norma = NOM-241` (solo DM), `NOM-059` (solo Med), y `MULTI` (ambos con separadores).
- Verificar que plan `trial` muestra curso desbloqueado.
