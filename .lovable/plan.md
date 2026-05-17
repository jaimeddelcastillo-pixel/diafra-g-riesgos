# Plan — Módulo Capacitación

## 1. Navegación y ruta
- Agregar entrada **Capacitación** (`GraduationCap`, ruta `/capacitacion`) en `src/components/AppSidebar.tsx`, entre *Recursos* y *Auditoría*.
- Registrar la ruta en `src/App.tsx` dentro del `AppLayout` (protegida igual que el resto del shell autenticado).

## 2. Página `src/pages/Capacitacion.tsx`
Layout con header Navy (`bg-primary` token TRACEA) + título "Capacitación" + subtítulo. Dos secciones:

### Sección 1 — Biblioteca de Conocimiento (visible para todos)
- **Subsección A — Guías Técnicas** (4 tarjetas):
  1. Guía Técnica S≥9 — Dispositivos Médicos · badge NOM-241 (Cobalt) · PDF
  2. Guía Técnica S≥9 — Medicamentos · badge NOM-059 (Orange) · PDF
  3. PNO-AMGR-01 · badge NOM-241 · Word
  4. PNO-AMGR-02 · badge NOM-059 · Word
  - Cada tarjeta usa `signed URL` o `getPublicUrl` desde el bucket `tracea-recursos`. Los archivos se asumen subidos en ese bucket (rutas: `guia-s9-dm.pdf`, `guia-s9-med.pdf`, `PNO-AMGR-01.docx`, `PNO-AMGR-02.docx`). Si alguno falta, mostrar toast.
- **Subsección B — Próximamente** (3 tarjetas grises con candado): Manual TRACEA, Glosario, Checklist COFEPRIS.

### Sección 2 — Curso de Certificación
Header con badge dinámico según acceso.
- Lógica de acceso: `tieneCurso = ["curso","starter","professional","enterprise"].includes(org.plan)`. Si `plan` es `null`/`trial`/`pendiente` → bloqueada.
- **Sin acceso**: banner CTA "Adquirir Curso — $450 USD" → `/precios`, tarjetas de curso con overlay candado.
- **Con acceso**: 
  - Curso 1 — NOM-241 (activo): 4 módulos con lecciones. Progreso = % lecciones completadas leídas desde `capacitacion_progreso`. Lecciones "video" muestran thumbnail gris + Play + "Próximamente". Lecciones tipo download enlazan a la guía/PNO correspondiente y marcan completado al click. Lección 3.2 enlaza al chat (botón flotante existente).
  - Curso 2 — NOM-059: tarjeta bloqueada "Próximamente".

## 3. Componentes auxiliares (mismo archivo o `src/components/capacitacion/`)
- `GuiaCard` (título, descripción, badge, botón descarga, ícono).
- `LeccionItem` (estado: disponible ✅ / próximamente / link).
- `ModuloAccordion` usando `Accordion` shadcn.
- `CursoBloqueadoCard` con overlay candado.

## 4. Base de datos (migración)
Nueva tabla `public.capacitacion_progreso`:
- `id uuid pk default gen_random_uuid()`
- `org_id uuid not null` (default `get_user_org_id()`)
- `user_id uuid not null default auth.uid()`
- `curso_id text not null` ("nom241" | "nom059")
- `leccion_id text not null`
- `completado boolean default false`
- `completado_en timestamptz`
- `created_at timestamptz default now()`
- UNIQUE (`org_id`,`user_id`,`curso_id`,`leccion_id`)
- RLS habilitado:
  - SELECT/INSERT/UPDATE: `org_id = get_user_org_id() AND user_id = auth.uid()` (+ `is_super_admin()` para soporte).
  - Sin DELETE para usuarios.

## 5. Diseño
- Tokens semánticos existentes: `bg-primary`, `text-primary-foreground`, `border`, `bg-card`. Badges via `Badge` shadcn con `className` que mapea Cobalt (`bg-[hsl(var(--primary))]`) y Orange (token existente o `bg-accent`).
- Grid `grid-cols-1 md:grid-cols-2 gap-4`.
- Barra de progreso: componente `Progress` shadcn.
- Candado: ícono `Lock` de lucide sobre overlay `bg-muted/60 backdrop-blur-sm`.

## 6. Hooks/datos
- `useAuth()` → `org.plan` para gating.
- `supabase.storage.from('tracea-recursos').createSignedUrl(...)` al pulsar descargar (los PDFs de guía y los Word PNO).
- Para PNO-AMGR-01 ya existe `storagePath: "PNO-AMGR-01.pdf"` en `Recursos.tsx`; reutilizar nombre. Para los demás archivos, si aún no están en el bucket, dejar el botón con toast "Documento no disponible, contacte soporte" (el usuario podrá subirlos luego).

## 7. Entregables / orden de ejecución
1. Migración `capacitacion_progreso` + RLS.
2. Agregar ítem sidebar + ruta.
3. Crear `src/pages/Capacitacion.tsx` con ambas secciones.
4. Implementar carga de progreso y marcado de lección completada (downloads).
5. QA visual en preview (desktop + 634px viewport actual).

## Notas técnicas
- No tocar `client.ts` ni `types.ts` (autogenerados).
- No mover lógica de planes; reusar `org.plan` ya expuesto en `useAuth`.
- `modulos_activos` no existe aún en `organizations` → no se agrega ahora (queda para Fase 2 cuando se necesite control granular).
