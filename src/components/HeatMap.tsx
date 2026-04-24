import { Fragment, useMemo, useState } from "react";
import type { Riesgo } from "@/hooks/useFolios";

type Mode = "inicial" | "residual";

const occurrenceLabels: Record<number, string> = {
  10: "Muy frecuente / más del 50% lotes",
  9: "Casi siempre / 1 de cada 3 lotes",
  8: "Recurrente / semanal",
  7: "Frecuente / mensual",
  6: "Ocasional / cada 6 meses",
  5: "Ocasional / cada 6 meses",
  4: "Aislada / 1 vez al año",
  3: "Aislada / 1 vez al año",
  2: "Rara vez / Históricamente no presentado",
  1: "Rara vez / Históricamente no presentado",
};

const severityLabels: Record<number, string> = {
  10: "Catastrófico / Muerte o Recall Clase I",
  9: "Muy Alta / Lesión permanente",
  8: "Alta / Lesión grave",
  7: "Moderadamente Alta / Lesión temporal",
  6: "Moderada / Molestia menor",
  5: "Moderada / Molestia menor",
  4: "Baja / Insignificante",
  3: "Baja / Insignificante",
  2: "Remota / Sin efecto perceptible",
  1: "Remota / Sin efecto perceptible",
};

function toTraceaScale(value: number) {
  return Math.min(10, Math.max(1, Math.round(value || 1)));
}

function zone(npr: number, severity: number) {
  if (npr >= 300 || severity >= 9) return { cls: "bg-destructive/15 border-destructive/35 text-destructive", label: "Evitar / acción obligatoria", icon: severity >= 9 ? "⚠️" : "" };
  if (npr >= 150) return { cls: "bg-npr-high/15 border-npr-high/35 text-npr-high", label: "Compartir o transferir", icon: "" };
  if (npr >= 60) return { cls: "bg-warning/15 border-warning/35 text-warning", label: "Reducir el riesgo", icon: "" };
  if (severity >= 9) return { cls: "bg-warning/15 border-warning/35 text-warning", label: "Supervisión permanente", icon: "⚠️" };
  if (npr >= 0) return { cls: "bg-success/15 border-success/30 text-success", label: "Asumir el riesgo", icon: "" };
  return { cls: "bg-destructive/15 border-destructive/35 text-destructive", label: "Evitar el riesgo" };
}

export function HeatMap({ risks }: { risks: Riesgo[] }) {
  const [mode, setMode] = useState<Mode>("inicial");

  const grid = useMemo(() => {
    const counts = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => ({ count: 0, maxNpr: 0 })));
    risks.forEach((risk) => {
      const sev = toTraceaScale(mode === "inicial" ? risk.severidad : risk.sev_residual);
      const ocu = toTraceaScale(mode === "inicial" ? risk.ocurrencia : risk.ocu_residual);
      const det = toTraceaScale(mode === "inicial" ? risk.deteccion : risk.det_residual);
      const npr = sev * ocu * det;
      counts[sev - 1][ocu - 1].count++;
      counts[sev - 1][ocu - 1].maxNpr = Math.max(counts[sev - 1][ocu - 1].maxNpr, npr);
    });
    return counts;
  }, [mode, risks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border bg-muted/40 p-1">
          {(["inicial", "residual"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${mode === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
            >
              {item === "inicial" ? "Inicial" : "Residual"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span className="rounded border border-success/30 bg-success/10 px-2 py-1 text-success">NPR &lt;60</span>
          <span className="rounded border border-warning/30 bg-warning/10 px-2 py-1 text-warning">60-149</span>
          <span className="rounded border border-npr-high/30 bg-npr-high/10 px-2 py-1 text-npr-high">150-299</span>
          <span className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive">≥300 o S≥9</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1280px]">
          <div className="grid grid-cols-[150px_repeat(10,minmax(104px,1fr))] gap-2 text-xs">
            <div />
            {Array.from({ length: 10 }, (_, i) => i + 1).map((ocu) => (
              <div key={ocu} className="flex h-14 items-center justify-center rounded border bg-card px-2 text-center font-medium leading-tight text-muted-foreground">
                {ocu}. {occurrenceLabels[ocu]}
              </div>
            ))}

            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((sev) => (
              <Fragment key={sev}>
                <div className={`flex min-h-24 items-center justify-end rounded border bg-card px-3 text-right font-medium leading-tight text-muted-foreground ${sev >= 9 ? "border-l-4 border-l-npr-high" : ""}`}>
                  <div>
                    <div>{sev}. {severityLabels[sev]}</div>
                    {sev >= 9 && <div className="mt-1 text-[10px] font-bold text-npr-high">Zona S≥9 — Supervisión permanente</div>}
                  </div>
                </div>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((ocu) => {
                  const cell = grid[sev - 1][ocu - 1];
                  const z = zone(cell.maxNpr || sev * ocu, sev);
                  return (
                    <div key={`${sev}-${ocu}`} className={`min-h-24 rounded-md border p-2 ${z.cls} ${sev >= 9 ? "border-l-4 border-l-npr-high" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-semibold opacity-75">{z.icon} S{sev}×O{ocu}</span>
                        {cell.count > 0 && <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-current px-2 text-sm font-bold"><span className="text-primary-foreground">{cell.count}</span></span>}
                      </div>
                      <p className="mt-3 text-[11px] font-semibold leading-tight">{z.label}</p>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
          <div className="mt-3 text-center text-xs font-medium text-muted-foreground">Ocurrencia →</div>
          <div className="mt-3 rounded-md border border-npr-high/30 bg-npr-high/10 px-3 py-2 text-xs font-medium text-npr-high">
            ⚠️ Riesgos con S≥9 requieren Dictamen de Beneficio-Riesgo aunque el NPR residual sea bajo — ISO 14971 §8
          </div>
        </div>
      </div>
    </div>
  );
}