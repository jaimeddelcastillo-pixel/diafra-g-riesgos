# Plan: Onboarding guiado para nuevos usuarios

## Resumen
Implementar un flujo de bienvenida de 4 pasos que se dispare la primera vez que un usuario accede tras activar su cuenta, persistido a nivel **organización** y adaptado por norma (NOM-241 / NOM-059 / MULTI).

---

## 1. Base de datos (migración)

Agregar a `public.organizations`:
- `onboarding_completado BOOLEAN NOT NULL DEFAULT false`
- `onboarding_completado_at TIMESTAMPTZ NULL`
- `onboarding_completado_por UUID NULL` (user_id de quien lo cerró)

No requiere nuevas RLS — `organizations` ya permite a admins de la org actualizarla, y al super_admin gestionarlas (para el reset desde `/admin`).

**Nota:** El campo es **por organización**, no por usuario. Esto significa que el onboarding se muestra al primer miembro que entre tras activar la cuenta (típicamente el admin que la creó). Si quieres que cada usuario nuevo vea su propio onboarding, dímelo y lo movemos a `profiles` o a una tabla `user_onboarding`.

---

## 2. Detección de primer acceso

En `useAuth` (o un nuevo hook `useOnboarding`):
- Leer `org.onboarding_completado` del contexto ya cargado.
- Exponer `shouldShowOnboarding = org && !org.onboarding_completado && !isSuperAdmin && !isImpersonating`.
- Función `completarOnboarding()` → `update organizations set onboarding_completado=true, …`.
- Función `saltarOnboarding()` → mismo efecto, pero registrando que fue saltado (campo opcional `onboarding_saltado BOOLEAN`).

El onboarding **NO** se muestra:
- A super_admin
- Durante impersonación (banner amber)
- En rutas públicas (/login, /precios, etc.)
- En `/pago-pendiente` ni `BlockScreen`

---

## 3. Componentes nuevos

```text
src/components/onboarding/
  OnboardingController.tsx     ← orquesta los 4 pasos, montado en AppLayout
  Paso1Bienvenida.tsx          ← Dialog modal Navy
  Paso2Tour.tsx                ← tooltips secuenciales sobre sidebar
  Paso3PrimerFolio.tsx         ← panel con 3 cards
  useOnboardingTextos.ts       ← textos adaptados por norma
```

**Paso 1 — Bienvenida** (`Dialog` shadcn, `max-w-lg`)
- Header Navy (`bg-[#042C53]`) con logo SVG TRACEA actual.
- Título dinámico con `profile.nombre`.
- Subtítulo adaptado por `org.norma_aplicable`.
- Botones: "Comenzar →" (avanza a paso 2) / "Saltar por ahora" (completa y cierra).

**Paso 2 — Tour visual**
- Implementación propia (evitar dependencia nueva): overlay `fixed inset-0 bg-black/50` con un "hole" calculado vía `getBoundingClientRect()` del elemento target.
- 4 targets vía `data-onboarding="folios|capacitacion|recursos|asistente"` añadidos a `AppSidebar` y `FloatingAssistantButton`.
- Tooltip flotante posicionado al lado del elemento, con "Siguiente →" y "Saltar tour".
- Auto-scroll si el target no es visible.

**Paso 3 — Primer folio**
- Panel central sobre overlay semitransparente.
- 3 cards (grid responsive: `grid-cols-1 md:grid-cols-3`):
  - **A – Asistente IA**: ícono `Bot`. Acción → `window.dispatchEvent(new CustomEvent('open-assistant', { detail: { initialMessage: '…' } }))`. Requiere que `FloatingAssistantButton`/`AssistantPanel` escuchen el evento y precarguen el mensaje.
  - **B – Wizard**: ícono `Wand2`. Acción → `navigate('/folios?wizard=1')` y que `Folios.tsx` abra `RiesgoWizardDialog` cuando detecte el query param.
  - **C – Explorar**: ícono `Compass`. Acción → completar y cerrar.
- Al elegir A o B se marca `onboarding_completado=true` antes de redirigir.

**Paso 4 — Confirmación**
- Listener en `useFolios` (o donde se inserte el primer folio): si el folio creado es el primero de la org **y** el onboarding se completó hace <24h vía A/B, mostrar toast 🎉.
- Badge punto verde en sidebar item "Mis Folios": leer `localStorage['onboarding_first_folio_at']` y mostrar dot durante 24h.

---

## 4. Textos adaptados por norma

`useOnboardingTextos.ts` mapea `org.norma_aplicable`:

| Norma | Subtítulo paso 1 | Tooltip Asistente |
|---|---|---|
| NOM-241 | "…conforme a NOM-241 y FEUM listo." | "…sobre GR NOM-241." |
| NOM-059 | "…conforme a NOM-059 y FEUM listo." | "…sobre GR NOM-059." |
| MULTI / null | "…conforme a normativa COFEPRIS listo." | "…sobre GR COFEPRIS." |

---

## 5. Reset desde /admin (super_admin)

En `AdminOrg.tsx` agregar botón "Resetear onboarding" en la tarjeta de la org (solo visible para super_admin) → `update organizations set onboarding_completado=false where id=…`. Útil para demos.

---

## 6. Diseño y UX

- Paleta: Navy `#042C53`, Cobalt `#185FA5` (tokens ya existen en CSS).
- Animación: `data-[state=open]:animate-in fade-in-0 zoom-in-95` (shadcn Dialog ya lo trae).
- "Saltar" siempre visible — nunca bloqueante.
- Accesible: `Escape` cierra (= saltar), focus trap dentro del modal.
- Responsive: en móvil las cards apilan vertical, tooltips del tour se posicionan abajo del header.

---

## 7. Archivos a modificar

- **Crear**: `src/components/onboarding/*` (5 archivos), migración SQL.
- **Editar**:
  - `src/components/AppLayout.tsx` — montar `<OnboardingController />`.
  - `src/components/AppSidebar.tsx` — añadir `data-onboarding` a items.
  - `src/components/FloatingAssistantButton.tsx` — añadir `data-onboarding`, escuchar evento `open-assistant`.
  - `src/components/AssistantPanel.tsx` — aceptar `initialMessage` prop.
  - `src/pages/Folios.tsx` — auto-abrir wizard si `?wizard=1`.
  - `src/pages/AdminOrg.tsx` — botón reset onboarding.
  - `src/hooks/useAuth.tsx` — exponer flag de onboarding (opcional, también puede leerse directo del `org`).

---

## Preguntas antes de implementar

1. **Scope del flag**: ¿onboarding por **organización** (lo plantea tu prompt) o por **usuario**? Si entran 3 personas a la misma org, ¿solo la primera ve el onboarding?
2. **Tour del Paso 2**: ¿implementación propia (sin dependencias) o instalo `driver.js`? Propia toma ~150 líneas pero evita un paquete extra.
3. **Card A (Asistente)**: ¿el AssistantPanel actual ya soporta precarga de un mensaje inicial? Si no, requiere extender su API.

Confirma y procedo con la migración + código.
