# Sidebar declarativo con navigationConfig

Un solo commit. Reemplaza la navegación hardcodeada por una configuración declarativa con grupos colapsables, sin tocar rutas, módulos, edge functions ni lógica de negocio.

## Qué cambia para el usuario

- Menú lateral reorganizado en tres secciones: **NÚCLEO**, **MÓDULOS**, **ADMINISTRACIÓN**.
- Cerebro Institucional y Gestión de Riesgos / Capacitación pasan a ser grupos plegables; solo uno abierto a la vez y el que contiene la página actual se abre solo.
- La preferencia de qué grupo está abierto se recuerda entre visitas.
- Si la organización no tiene el módulo de Cerebro, ese grupo no aparece.
- En móvil se sigue usando el panel deslizable existente (sin segundo sistema de navegación).

## Archivos

### Nuevo: `src/config/navigation.ts`
Exporta `navigationConfig: NavItem[]`, con:

```text
NavItem = {
  id, label, icon,
  route?, children?,
  section: "nucleo" | "modulos" | "admin",
  feature?, roles?, plans?, status?
}
```

Contenido:
- nucleo: `Cerebro Institucional` (feature `institutional_brain`) con Panorama, Entrevistas, Conocimiento, Validación, Documentos, Contradicciones, Brechas, Exportar.
- modulos: `Gestión de Riesgos` (Dashboard `/`, Mis Folios, Catálogos, Mis Protocolos, Cumplimiento[roles admin/responsable_sanitario], Auditoría, Recursos) y `Capacitación` (Capacitación, Mis Diplomas).
- admin: Configuración `/configuracion`, Ayuda `/soporte` (roles admin/responsable_sanitario).
- Se mantiene aparte la lista de navegación de super admin (Panel TRACEA, Tickets, Agentes IA, etc.) como `adminNavigationConfig` en el mismo archivo, sección `admin`, sin cambios funcionales.

### Nuevo: `src/hooks/useNavigationItems.ts`
Filtra `navigationConfig` (solo UX, sin reemplazar enforcement backend):
- `feature`: usa `useCerebroAcceso().tieneCerebro` para `institutional_brain`; genérico vía consulta ya existente.
- `roles`: `hasRole` / `isSuperAdmin` de `useAuth`.
- `plans`: `org.plan`.
- Elimina grupos que quedan sin hijos visibles.
- Devuelve las secciones ya agrupadas y ordenadas, o la lista de super admin cuando corresponde (`isSuperAdmin() && !isImpersonating`).

### Nuevo: `src/components/sidebar/NavGroup.tsx`
Grupo colapsable con `Collapsible` de shadcn dentro de `SidebarMenu`:
- Apertura exclusiva: el padre controla `openId` (un solo grupo abierto).
- `useLocation()` abre automáticamente el grupo que contiene la ruta activa.
- Persistencia en `localStorage` (`tracea_sidebar_open_group`), con la ruta activa teniendo prioridad.
- En estado colapsado (icon mode) muestra solo iconos; los hijos se muestran al expandir la barra.
- Ítems hoja renderizados con el `NavLink` existente y `activeClassName`, conservando `end` para `/`, `/admin` y `/cerebro`.

### Modificado: `src/components/AppSidebar.tsx`
- Se eliminan los arrays hardcodeados y los condicionales de rol/feature.
- Queda: header (logo/org), render de las tres secciones con `SidebarGroupLabel` + `NavGroup`/ítems simples, y el bloque existente "Salir de empresa" durante impersonación.
- Objetivo ~80 líneas.

## Detalles visuales
- `NÚCLEO`: label con tono de acento sutil (token `sidebar-primary` a baja opacidad) frente al gris de `MÓDULOS`/`ADMINISTRACIÓN`.
- Icono del Cerebro con un fondo redondeado tenue para diferenciarlo, sin destacar en exceso.
- Solo tokens semánticos del design system, sin colores hardcodeados.
- Se conserva el badge verde de "Mis Folios" y el atributo `data-onboarding` de los ítems del onboarding.

## Verificación posterior
- Rutas existentes marcan estado activo correctamente (incluidas `/` y `/cerebro`).
- Comportamiento con roles admin, operador y responsable sanitario.
- Org sin `institutional_brain`: el grupo Cerebro no aparece.
- Vista móvil usando el drawer existente.

## No se toca
Rutas en `App.tsx`, módulos existentes, edge functions, lógica de negocio.
