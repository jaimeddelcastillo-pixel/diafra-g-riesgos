import type { Riesgo } from "@/hooks/useFolios";

function getCellColor(sev: number, ocu: number): string {
  const val = sev * ocu;
  if (val <= 6) return "bg-success/20 text-success";
  if (val <= 15) return "bg-warning/20 text-warning";
  if (val <= 30) return "bg-npr-high/20 text-npr-high";
  return "bg-destructive/20 text-destructive";
}

export function HeatMap({ risks }: { risks: Riesgo[] }) {
  const grid: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
  risks.forEach((r) => {
    const s = Math.min(r.severidad, 10) - 1;
    const o = Math.min(r.ocurrencia, 10) - 1;
    grid[s][o]++;
  });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[400px]">
        <div className="flex items-end mb-1 ml-8">
          <span className="text-[10px] text-muted-foreground font-medium tracking-wide w-full text-center">OCURRENCIA →</span>
        </div>
        <div className="flex">
          <div className="flex flex-col items-center justify-center mr-1">
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>SEVERIDAD →</span>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-[auto_repeat(10,1fr)] gap-[2px]">
              <div />
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="text-center text-[10px] text-muted-foreground font-mono pb-1">{i + 1}</div>
              ))}
              {Array.from({ length: 10 }, (_, sIdx) => {
                const sev = 10 - sIdx;
                return [
                  <div key={`label-${sev}`} className="text-right text-[10px] text-muted-foreground font-mono pr-1 flex items-center justify-end">{sev}</div>,
                  ...Array.from({ length: 10 }, (_, oIdx) => {
                    const count = grid[sev - 1][oIdx];
                    return (
                      <div key={`${sev}-${oIdx}`} className={`aspect-square rounded-sm flex items-center justify-center text-[10px] font-bold ${count > 0 ? getCellColor(sev, oIdx + 1) : "bg-muted/50"}`}>
                        {count > 0 ? count : ""}
                      </div>
                    );
                  }),
                ];
              }).flat()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
