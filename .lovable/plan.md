## Problema

El Dashboard sigue mostrando riesgos "capturados" después de cancelar los folios que los contenían. La auditoría NOM-241 / NOM-059 exige que un folio cancelado deje de aportar a las métricas operativas, y hoy un riesgo huérfano (cuyo folio está en estado `Cancelado`) sigue sumando en críticos, acciones pendientes, sin responsable, etc.

## Causa raíz

En `src/pages/Index.tsx`, los folios sí se filtran (`foliosVigentes = fols.filter(f => f.estado !== "Cancelado")`), pero los **riesgos** (`risks = allRisks || []`) se usan directos. `useAllRiesgos` trae todos los riesgos de la organización sin importar el estado del folio padre, así que un folio cancelado conserva sus riesgos en todos los conteos del dashboard.

## Cambio propuesto (solo frontend, una sola página)

En `src/pages/Index.tsx`:

1. Crear un derivado `risksVigentes` que excluya cualquier riesgo cuyo `folio_id` pertenezca a un folio cancelado:
   ```ts
   const idsCancelados = new Set(cancelados.map(f => f.id));
   const risksVigentes = risks.filter(r => !idsCancelados.has(r.folio_id));
   ```
2. Reemplazar todos los usos de `risks` por `risksVigentes` en los cálculos KPI: `critical`, `accionesPendientes`, `sinResponsable`, `criticosSinEvidencia`, `criticalResidual`, `riesgosMejoraron`, `riesgosSinMitigacionEfectiva`, `foliosConRiesgo`, `puntosAMEF` y el Top‑5 NPR / HeatMap / NPRControlTable.
3. Mantener `risks` original sólo si hace falta para mostrar un sub-total histórico (no se requiere ahora; los cancelados ya tienen su propio KPI separado).

## Fuera de alcance

- No se tocan `Folios.tsx`, `Auditoria.tsx` ni la edge function. La auditoría de cambios (audit_trail) sigue conservando el historial completo del riesgo y del folio cancelado, así que no hay pérdida regulatoria.
- No se borran riesgos de la base de datos: quedan ligados al folio cancelado para trazabilidad NOM-241.
