# C4c — servicio de contexto validado

## Entregado
- Migración: `drizzle/migrations/0048_c4c_contexto_cerebro.sql`.
- Reversión no destructiva: `c4c_down.sql` en la raíz; conserva códigos, vínculos y bitácora histórica.
- Servicio y armado: `_shared/conocimiento-contexto.ts`, `_shared/skills.ts`, `chat-asistente/index.ts`, `chat-insertar-riesgo/index.ts` (bajo `supabase/functions`). Las dos funciones del chat están desplegadas.
- Pantallas: `ComposicionIACard.tsx`, `ConocimientoChat.tsx`, `AssistantPanel.tsx`, `WizardAsistente.tsx`, `ListaConocimiento.tsx`, `ConocimientoUsadoEn.tsx`, `AuditoriaExterna.tsx`, `auditoriaPdf.ts` y `skills-presentacion.ts`.
- Pruebas: `src/test/c4c.test.ts`; 50 pruebas existentes pasan, compilación sin errores.

## Códigos asignados por empresa
| Empresa | Cantidad |
|---|---:|
| DIAFRA | 39 |
| QA Brain adminqa | 17 |
| QA Brain operqa (registro 122c7511…) | 10 |
| QA Brain operqa (registro 5e3e8450…) | 1 |
| QA NOM-059 Sandbox SA de CV | 3 |

Hay dos empresas distintas llamadas QA Brain operqa; no se fusionaron ni corrigieron. El llenado de códigos fue global según lo solicitado; las consultas de prueba fueron exclusivamente en QA, sin modificar conocimiento ni validaciones de DIAFRA.

## Prueba SQL QA Brain adminqa
Consulta `contexto_cerebro` sin folio, texto **«limpieza de equipo»**, límite 12: **0 elementos**, códigos **[]**. La empresa tiene Cerebro y contiene dos conocimientos validados, pero ninguno coincide con esa consulta. Control positivo con **«cuarentena»**: **1 elemento**, **K-0008**, contenido dentro del máximo de 600 caracteres.

SQL ejecutado con contexto service_role (solo consulta; sin cambios de datos):
```sql
WITH configuracion AS MATERIALIZED (
 SELECT set_config('request.jwt.claims','{"role":"service_role"}',true) valor
), contexto AS MATERIALIZED (
 SELECT c.* FROM configuracion x
 CROSS JOIN LATERAL public.contexto_cerebro(
  '3868f88a-fa36-4467-9b31-653143c6ef7d', NULL,
  'limpieza de equipo' || left(x.valor,0), 12
 ) c
)
SELECT count(*) elementos, coalesce(jsonb_agg(codigo),'[]'::jsonb) codigos
FROM contexto;
```

## Pendiente de Jaime y límites
- Todos los interruptores siguen apagados: **0 empresas activadas**.
- `uso_conocimiento_empresa` se agregó sin texto ni versión. Jaime debe pegar `05_uso_conocimiento_empresa_v1.0.txt` como borrador y activar el piloto QA.
- Si hay contexto pero falta esa skill, se conserva el comportamiento previo de composición incompleta: monolítica y aviso en bitácora; nunca se envía conocimiento sin la skill.
- La sección «Usado en» se abre al pulsar el código de conocimiento; los chips llevan a esa ficha. Las referencias se crean en la misma transacción que el riesgo y proceden de la respuesta persistida de la persona, no de códigos enviados por el cliente.
- La reversión no borra columnas ni evidencias históricas; requiere restaurar el código previo a C4c además de ejecutar el SQL.
- Las pruebas de navegador y el flujo real IA → Insertar quedan a cargo de Jaime como se solicitó; no se han verificado extremo a extremo aquí.
- No se incluyen Tendencias, causa raíz ni «requiere revisión» por obsolescencia del conocimiento.