# Restricciones de plan Trial

## Objetivo
Durante los 14 días de prueba, el cliente prueba la plataforma (AMEF + Asistente IA). En el curso solo accede a **Introducción + Módulo 1 completo**; el resto bloqueado.

## 1. Capacitación — solo Introducción + Módulo 1

**Archivo:** `src/pages/Capacitacion.tsx`

- `tieneCurso` se mantiene `true` para trial (entran al curso).
- `isTrial` ya existe (`useIsTrial`).
- Regla de desbloqueo: en trial, solo desbloquear los **dos primeros módulos** por orden (Introducción = orden 0/1, Módulo 1 = siguiente). Implementación:
  ```ts
  const moduloDesbloqueado = (idx: number) => !isTrial || idx < 2;
  ```
  *(Se basa en el índice ordenado del array `curso.modulos`, que ya viene ordenado por `orden` desde `useCurso`.)*
- En `renderCurso`, al mapear módulos:
  - Si el módulo está bloqueado: render del `AccordionItem` con ícono candado en el trigger, badge "Disponible con plan activo" y al expandir mostrar un mensaje + CTA en lugar de las lecciones.
  - Si está desbloqueado: comportamiento actual.
- Mensaje del bloqueo (componente reutilizable dentro del archivo):
  > "Este módulo está disponible en planes activos. Tu prueba gratuita incluye acceso completo a la plataforma de gestión de riesgos y a la Introducción + Módulo 1 del curso — el curso completo se activa con cualquier plan desde $85 USD/mes."
  - Botón "Ver planes" → `navigate("/precios")`.
- Ocultar el bloque "Evaluación final + diploma" cuando `isTrial` (no completaron el curso real).

## 2. Asistente IA — límite trial = 10

**Backend** (`supabase/functions/chat-asistente/index.ts`):
- Cambiar `PLAN_LIMITS.trial` de `30` a `10`.
- Deploy de la edge function.

**Frontend** (`src/components/AssistantPanel.tsx`):
- `PLAN_LIMITS.trial = 10` (espejo para el contador del header).
- Cuando `org.plan === 'trial'`:
  - Header: `${used}/10 consultas de prueba`.
  - Si `agotado` (used ≥ 10): reemplazar el CTA "comprar pack" por:
    > "Agotaste tus consultas de prueba. Activa tu plan para continuar con el Asistente IA."
    Botón "Ver planes desde $85 USD/mes" → `/precios`.
- No tocar packs ni lógica de planes pagados.

## Fuera de alcance
- Sin migraciones ni cambios en BD.
- Sin tocar `useCurso`, checkout, ni packs IA de planes pagados.
