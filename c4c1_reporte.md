# C4c.1 — búsqueda y diagnóstico

## Causa confirmada
Adminqa tiene el interruptor encendido, composición `bloques_borrador`, acceso a Cerebro y K-0008 validado. La búsqueda anterior usaba `websearch_to_tsquery`: AND implícito y ningún tratamiento explícito de códigos K. La consulta de contexto devolvía cero elementos.

## Archivos cambiados
- `drizzle/migrations/0049_c4c1_busqueda_contexto_cerebro.sql`: OR sobre lexemas españoles sin palabras vacías, códigos explícitos primero, ts_rank y fallback máximo de cinco conocimientos relacionados por proceso/área del folio; conserva autorización, validación, máximo de 12 y presupuesto de 6000 caracteres.
- `supabase/functions/_shared/conocimiento-contexto.ts`: texto de búsqueda con proceso, etapa actual y mensaje; tipo y constructor del diagnóstico.
- `supabase/functions/_shared/skills.ts`: diagnóstico por interruptor, módulo, coincidencias y skill sin versión; no envía conocimiento sin la skill.
- `supabase/functions/chat-asistente/index.ts`: entrada de búsqueda, diagnóstico en SSE y persistido junto a contexto_detalle. Función desplegada.
- `src/lib/skills-presentacion.ts`, `src/components/InformacionRespuestaIA.tsx`: contexto en el control exclusivo de super_admin; respuestas antiguas sin diagnóstico muestran «Sin registro», no un motivo inventado.
- `src/components/AssistantPanel.tsx`, `src/components/wizard/WizardAsistente.tsx`: diagnóstico en mensajes actuales y restaurados; el asistente del formulario envía la etapa actual también en turnos posteriores.
- `src/components/ConocimientoChat.tsx`: chips compactos dentro del renglón y evita volver a transformar chips anidados en Markdown.
- `src/test/c4c.test.ts`, `AGENTS.md`, `docs/reglas-detalle.md`, `roadmap.md`: pruebas y reglas actualizadas.

## Dos comprobaciones SQL — solo adminqa
Se ejecutó la selección equivalente al núcleo de búsqueda de la función aplicada, sobre conocimientos validados y no sustituidos de adminqa:

| Texto | Códigos devueltos |
|---|---|
| Recepción y cuarentena de materia prima, liberación sin aprobación de calidad | K-0008, K-0011 |
| ¿Qué dice K-0008? | K-0008 |

La llamada directa a contexto_cerebro desde la herramienta SQL fue rechazada por sus permisos restringidos. No se ampliaron permisos para sortearlo. La sesión disponible tampoco estaba dentro de adminqa; no se cambió su empresa ni se ejecutó IA fuera de QA. Por tanto estas comprobaciones verifican el núcleo SQL, no una llamada completa a la función bajo la sesión de adminqa.

## Verificación
13 pruebas automáticas C4c/C4b.2 pasan; compilación sin errores. Migración aplicada y chat-asistente desplegado. No se cambiaron configuración de empresas, versiones de skills ni datos de DIAFRA.

Pendiente de Jaime: comprobar en adminqa las dos preguntas en el chat y el diagnóstico del ⓘ, incluida su conservación al reabrir la conversación. El flujo de IA en navegador y la geometría visual de chips no se verificaron aquí, conforme a la delegación de pruebas de navegador.