import { useMemo, useState } from "react";
import type { Riesgo } from "@/hooks/useFolios";

type Mode = "inicial" | "residual";

const occurrenceLabels = ["Rara vez", "Eventualmente", "Puede ocurrir", "Probable", "Muy frecuente"];
const severityLabels = ["Insignificante", "Menor", "Moderado", "Mayor", "Catastrófico"];

function toFivePoint(value: number) {
  return Math.min(5, Math.max(1, Math.ceil(value / 2)));
}

function zone(score: number) {
  if (score <= 3) return { cls: "bg-success/15 border-success/30 text-success", label: "Asumir el riesgo" };
  if (score <= 6) return { cls: "bg-warning/15 border-warning/35 text-warning", label: "Reducir el riesgo" };
  if (score <= 12) return { cls: "bg-npr-high/15 border-npr-high/35 text-npr-high", label: "Compartir o transferir" };
  return { cls: "bg-destructive/15 border-destructive/35 text-destructive", label: "Evitar el riesgo" };
}

export function HeatMap({ risks }: { risks: Riesgo[] }) {
  const [mode, setMode] = useState<Mode>("inicial");

  const grid = useMemo(() => {
    const counts = Array.from({ length: 5 }, () => Array(5).fill(0));
    risks.forEach((risk) => {
      const sev = toFivePoint(mode === "inicial" ? risk.severidad : risk.sev_residual);
      const ocu = toFivePoint(mode === "inicial" ? risk.ocurrencia : risk.ocu_residual);
      counts[sev - 1][ocu - 1]++;
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
          <span className="rounded border border-success/30 bg-success/10 px-2 py-1 text-success">1-3</span>
          <span className="rounded border border-warning/30 bg-warning/10 px-2 py-1 text-warning">4-6</span>
          <span className="rounded border border-npr-high/30 bg-npr-high/10 px-2 py-1 text-npr-high">8-12</span>
          <span className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive">15-25</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[118px_repeat(5,minmax(104px,1fr))] gap-2 text-xs">
            <div />
            {occurrenceLabels.map((label, i) => (
              <div key={label} className="flex h-12 items-center justify-center rounded border bg-card px-2 text-center font-medium text-muted-foreground">
                {i + 1}. {label}
              </div>
            ))}

            {[5, 4, 3, 2, 1].map((sev) => (
              <>
                <div key={`sev-${sev}`} className="flex min-h-24 items-center justify-end rounded border bg-card px-3 text-right font-medium text-muted-foreground">
                  {sev}. {severityLabels[sev - 1]}
                </div>
                {[1, 2, 3, 4, 5].map((ocu) => {
                  const score = sev * ocu;
                  const z = zone(score);
                  const count = grid[sev - 1][ocu - 1];
                  return (
                    <div key={`${sev}-${ocu}`} className={`min-h-24 rounded-md border p-2 ${z.cls}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-semibold opacity-75">S{sev}×O{ocu}</span>
                        {count > 0 && <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-current px-2 text-sm font-bold"><span className="text-primary-foreground">{count}</span></span>}
                      </div>
                      <p className="mt-3 text-[11px] font-semibold leading-tight">{z.label}</p>
                    </div>
                  );
                })}
              </>
            ))}
          </div>
          <div className="mt-3 text-center text-xs font-medium text-muted-foreground">Ocurrencia →</div>
        </div>
      </div>
    </div>
  );
}