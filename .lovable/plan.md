
# Multi-norma TRACEA (NOM-241 + NOM-059): análisis y plan

## 1. Análisis de las dos opciones

### Opción A — Duplicar el proyecto (un app por norma)
**Pros**
- Cambios mínimos por proyecto, menos riesgo de tocar a clientes activos (DIAFRA).
- Aislamiento total: una caída de una versión no afecta a la otra.

**Contras (graves para tu caso)**
- **Doble mantenimiento perpetuo**: cada bug fix, cada feature (Stripe, tickets, auditoría, emails, impersonación, plantillas, dashboards) hay que portarlo dos veces. Acabas de cerrar 4 bloques grandes; multiplicarlo por 2 es insostenible.
- **Dos backends Supabase, dos webhooks Stripe, dos dominios, dos pipelines de email** (Resend), dos colas, dos `customer-portal`, dos `stripe-webhook`. Más superficie operativa y más probabilidad de error que de conflicto regulatorio.
- **Clientes multi-norma quedan fuera** (laboratorios que también fabrican dispositivos). Es justamente el caso del badge "MULTI" en tu prompt.
- **Marca y SEO partidos**: dos URLs que hacen lo mismo confunde al mercado.
- Migrar después a single-tenant multi-norma es más caro que hacerlo bien ahora.

### Opción B — Multi-norma en la misma plataforma (recomendada)
**Pros**
- Un solo código, un solo backend, una sola facturación, una sola base de usuarios.
- **Riesgo regulatorio bajo**: no se mezclan datos entre clientes (RLS por `org_id` ya está implementado y probado), y la norma se elige **a nivel de organización**, no global. Cada folio guarda explícitamente su `norma_folio`, así que la trazabilidad ISO/COFEPRIS queda intacta.
- DIAFRA y cualquier org existente queda en NOM-241 con default — **cero cambio visible** para ellos.
- El esquema de BD casi no cambia: los campos `peligro`, `severidad`, etc. se reutilizan, sólo cambian las **etiquetas en UI** y los **catálogos**.

**Contras (manejables)**
- Refactor moderado en 3 archivos grandes (`RiesgoFormDialog` 889 ln, `FolioDetail` 1454 ln, `generateFolioPDF` 588 ln) para leer terminología de un config.
- Hay que probar el PDF en ambas normas.

### Recomendación
**Opción B (multi-norma en la misma app)**. El riesgo regulatorio es el mismo en ambas opciones (las dos normas requieren trazabilidad por folio, y eso ya lo tienes). El riesgo operativo y comercial de duplicar es mucho mayor que el riesgo técnico de refactorizar etiquetas. Mitigamos con: default `NOM-241` para todas las orgs existentes, badge visible de norma en cada folio, y la norma se **congela en el folio** al crearse (`norma_folio`), de modo que un cambio futuro de norma de la org no reescribe folios históricos.

## 2. Impacto técnico real

| Área | Archivos | Riesgo |
|---|---|---|
| BD | 1 migración aditiva (columnas con default) | Bajo — no rompe lecturas existentes |
| Config normas | `src/config/normas.ts` (nuevo) | Nulo |
| Registro | `src/pages/Register.tsx`, `register-org` edge fn | Bajo |
| Form de riesgo | `RiesgoFormDialog.tsx` | Medio — etiquetas y catálogos dinámicos |
| Detalle folio | `FolioDetail.tsx`, `SeccionDictamen.tsx` | Medio |
| Catálogos UI | `Catalogos.tsx` | Bajo |
| PDF | `generateFolioPDF.ts` | Medio — encabezado, pies, etiquetas |
| Admin | `Admin.tsx` (columna + filtro Norma) | Bajo |
| Precios / FAQ | `Precios.tsx` | Nulo |
| Emails / Stripe / Tickets | — | Nulo |

Lo que **no** cambia: RLS, auth, Stripe, webhooks, impersonación, auditoría, tickets, almacenamiento, lógica de folios/aprobaciones.

## 3. Plan de implementación (6 bloques, 1 commit por bloque)

### Bloque A — Base de datos (migración aditiva)
- `organizations`: `norma_aplicable` ('NOM-241'|'NOM-059'|'MULTI', default 'NOM-241'), `usar_detectabilidad bool default true`, `umbral_npr_alto int default 150`, `umbral_npr_medio int default 60`, `metodologia text default 'AMEF'`. Validación con **trigger** (no CHECK, por inmutabilidad).
- `folios`: `norma_folio text default 'NOM-241'`, `metodologia_folio text default 'AMEF'`. Trigger que copia la norma de la org al insertar (congela la norma del folio).
- `riesgos`: `detectabilidad_aplicable bool default true`.
- Backfill explícito: `UPDATE` para todas las filas existentes a `'NOM-241'` (aunque el default lo cubre, lo hacemos explícito para auditoría).

### Bloque B — Config de normas (`src/config/normas.ts`)
- Exportar `NORMAS_CONFIG` con NOM-241 y NOM-059 según el documento (terminología, catálogos S/O/D, regla crítica S≥9, checklist, badges, fórmula NPR).
- Helper `getNormaConfig(orgNormaOrFolio)` con fallback a NOM-241.
- Tipos TS estrictos (`NormaKey`, `NormaConfig`).

### Bloque C — Selector de norma en registro
- En `Register.tsx` paso 1, agregar bloque "¿Bajo qué norma opera tu empresa?" antes de los planes con 3 tarjetas: NOM-241 (default, Shield/Navy), NOM-059 (FlaskConical/Cobalt), MULTI (Layers/Celeste → muestra mensaje de contacto y deshabilita continuar).
- `register-org` edge function: aceptar y persistir `norma_aplicable` + `metodologia` derivada.
- Extender `OrgInfo` y `useAuth` para exponer `org.norma_aplicable`.

### Bloque D — Adaptación de formulario, detalle, catálogos y PDF
- `RiesgoFormDialog.tsx`: leer `folio.norma_folio` (no de la org, para consistencia histórica), aplicar labels desde `NORMAS_CONFIG[norma].terminologia`, cargar catálogos S/O/D dinámicos, badge crítico cuando S≥`umbralSeveridad`.
- `FolioDetail.tsx`: badge de norma en header (Navy "ISO 14971" / Cobalt "ICH Q9"), checklist correcto, texto del dictamen con la terminología de la norma.
- `SeccionDictamen.tsx`: etiquetas dinámicas (Beneficio Clínico vs Beneficio Terapéutico, Responsable Sanitario vs Director Técnico).
- `Catalogos.tsx`: tabs con catálogos según `org.norma_aplicable`; si la org es MULTI muestra un toggle NOM-241/NOM-059.
- `generateFolioPDF.ts`: encabezado ("FOR-SGC-11-01" para NOM-241, código equivalente para NOM-059), pie con normativa correcta, todas las etiquetas desde el config. Mantener layout landscape y formato existente.

### Bloque E — Panel super admin
- `Admin.tsx`: columna "Norma" con badge (Navy/Cobalt/Celeste), filtro por norma, dropdown en `AdminOrg` para cambiar norma manualmente (con confirmación: "Sólo afecta folios futuros, los históricos conservan su norma").
- Métricas separadas por norma en el resumen.

### Bloque F — Página de precios y FAQ
- Actualizar pregunta 10 del FAQ en `Precios.tsx` con el texto del documento.
- Mención breve en hero/sección de planes: "Compatible con NOM-241 y NOM-059".

## 4. Garantías de no impacto a clientes existentes

1. Todas las columnas nuevas tienen **DEFAULT NOM-241** y son nullable-safe.
2. Trigger que copia `norma_org → norma_folio` sólo se dispara en INSERT, los folios existentes no se tocan.
3. Si `org.norma_aplicable` es null → fallback a NOM-241 en el config helper.
4. Los catálogos en pantalla "Catálogos" sólo cambian si la org no es NOM-241.
5. PDFs existentes ya generados no cambian; los nuevos respetan `folio.norma_folio`.
6. Stripe, emails, auditoría y tickets no se tocan en ningún bloque.

## 5. Entrega
- 6 commits, uno por bloque, con pausas para que valides cada uno (igual que la última tanda).
- Al final: smoke test creando una org NOM-059 de prueba y verificando registro → folio → PDF.

¿Apruebas este plan para arrancar con el Bloque A?
