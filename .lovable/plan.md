## Sistema de Comunicación del Comité Técnico — Plan

Implementación de votación formal + discusión por folio antes del dictamen del Responsable Sanitario (RS), como evidencia regulatoria COFEPRIS.

---

### 1. Base de datos (1 migración)

**Tablas nuevas:**

`comite_votos`
- `id`, `folio_id`, `user_id`, `org_id`, `voto` (`aprueba|rechaza|aprueba_con_observaciones`), `comentario`, `created_at`, `updated_at`
- `UNIQUE(folio_id, user_id)`
- Trigger CHECK: comentario obligatorio si voto ≠ `aprueba`
- Trigger `set_updated_at`
- Trigger `audit_trigger_func` (evidencia regulatoria)

`comite_comentarios`
- `id`, `folio_id`, `user_id`, `org_id`, `contenido`, `tipo` (`comentario|observacion|resolucion`), `resuelto`, `resuelto_por`, `resuelto_en`, `created_at`
- Trigger de auditoría

**RLS (ambas tablas):**
- SELECT: `org_id = get_user_org_id() OR is_super_admin()`
- INSERT/UPDATE: `user_id = auth.uid() AND org_id = get_user_org_id()`
- UPDATE de `resuelto`: autor del comentario, admin o RS
- DELETE: solo admin/super_admin

**Realtime:** habilitar en ambas tablas para refresco automático de la pestaña.

---

### 2. Componentes nuevos

```text
src/components/comite/
  ├── ComiteTab.tsx              ← layout 2 columnas (desktop) / stack (móvil)
  ├── PanelVotacion.tsx          ← progreso, lista miembros, botones voto
  ├── PanelComentarios.tsx       ← feed + nuevo comentario
  └── ResumenConsenso.tsx        ← semáforo para RS (🟢🟡🔴⏳)
```

- Hooks con React Query (`useComiteVotos`, `useComiteComentarios`) + subscripción realtime.
- Visibles solo para miembros con rol `comite_tecnico`, `responsable_sanitario`, `admin`, `super_admin`.
- `PanelVotacion` cruza `folio_comite` (miembros) con `comite_votos` para mostrar estado por miembro.
- Voto modificable solo mientras el folio esté en `Borrador`.
- Tipografía/colores: tokens semánticos existentes; los acentos verde/naranja/rojo se añaden como tokens HSL en `index.css` y `tailwind.config.ts` (no hex en componentes).

---

### 3. Integración en FolioDetail

`src/pages/FolioDetail.tsx`:
- Añadir un bloque de pestañas (shadcn `Tabs`) envolviendo las secciones actuales: **Folio | Riesgos | Comité | Dictamen | Evidencias | Historial**. Mantengo el contenido actual, solo agrupo en `TabsContent`.
- Tab **Comité** = `<ComiteTab folio={folio} comite={comite} />`.

### 4. Bloqueos en flujo de firma

En el handler "Enviar a Firma" de `FolioDetail.tsx` (no existe `FolioFirma.tsx` separado; la transición vive en `folio-workflow` + UI del detalle):
- Consultar `comite_votos` del folio.
- **Rojo (bloqueo):** rechazos activos → toast destructivo, abort.
- **Naranja (confirm):** observaciones sin resolver → `AlertDialog` confirmación.
- **Amarillo (confirm):** miembros sin votar → `AlertDialog` confirmación.
- Sin issues → continúa como hoy.

### 5. Notificaciones in-app

- No existe sistema de notificaciones in-app. Para no inflar el scope, **dejo fuera** la creación de un sistema de notificaciones nuevo y en su lugar:
  - Realtime refresh de la pestaña Comité para todos los miembros conectados.
  - Toast local al autor del voto/comentario.
- Marco `// TODO notificación in-app` en los puntos de inserción para cuando exista el módulo de notificaciones.
- ⚠️ Confírmame si prefieres que cree ahora una tabla `notificaciones` mínima + bell en el header — añade ~1 archivo más.

### 6. PDF del dictamen

`src/lib/generateFolioPDF.ts`: añadir sección **"Votación del Comité Técnico"** con tabla `Nombre | Cargo | Voto | Fecha | Observaciones`, leyendo `comite_votos` + `folio_comite` antes de generar. Si no hay votos, sección omitida con nota "Sin votación registrada".

---

### Detalles técnicos

- Validación cliente con `zod` (comentario requerido si voto ≠ `aprueba`, máx 2000 chars).
- Optimistic update + invalidación de `["comite-votos", folioId]` y `["comite-comentarios", folioId]`.
- Animación de entrada de comentario nuevo con `transition-all` + `animate-in fade-in slide-in-from-top-2` (Tailwind).
- Avatar con iniciales desde `profiles.nombre`.

### Archivos finales

**Nuevos (5):**
- `supabase/migrations/<timestamp>_comite_votacion.sql`
- `src/components/comite/ComiteTab.tsx`
- `src/components/comite/PanelVotacion.tsx`
- `src/components/comite/PanelComentarios.tsx`
- `src/components/comite/ResumenConsenso.tsx`

**Modificados (3):**
- `src/pages/FolioDetail.tsx` (pestañas + bloqueos pre-firma)
- `src/lib/generateFolioPDF.ts` (sección votación)
- `src/index.css` + `tailwind.config.ts` (tokens HSL vote-approve/observe/reject)

---

### Preguntas antes de codear

1. **Notificaciones in-app**: ¿creo módulo mínimo ahora o dejo `TODO`?
2. **Voto modificable**: ¿solo en `Borrador` (mi propuesta) o también en `En Firma` hasta que el RS firme?
3. **¿Quién puede comentar?** ¿Solo comité + RS, o también admin/operador del folio?
