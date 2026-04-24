import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getNPRLevel } from "@/hooks/useFolios";
import type { Riesgo } from "@/hooks/useFolios";

type RiskWithFolio = Riesgo & { folios?: { codigo: string } | null };
type SortKey = "id" | "proceso" | "nprInicial" | "nprResidual" | "reduccion" | "estado" | "accion";

function nprInicial(r: Riesgo) {
  return r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
}

function nprResidual(r: Riesgo) {
  return r.npr_residual ?? r.sev_residual * r.ocu_residual * r.det_residual;
}

function accionRegulatoria(npr: number) {
  if (npr < 60) return "Asumir";
  if (npr < 150) return "Reducir";
  return "Transferir o Evitar";
}

function levelClasses(label: string) {
  if (label === "Crítico") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (label === "Mayor") return "border-npr-high/30 bg-npr-high/10 text-npr-high";
  return "border-success/30 bg-success/10 text-success";
}

function rowEstado(inicial: number, residual: number, criticoResidual: boolean) {
  if (criticoResidual) return { icon: "🚨", label: "Crítico residual", weight: 4 };
  if (residual < inicial) return { icon: "✅", label: "Mejoró", weight: 1 };
  if (residual > inicial) return { icon: "🔴", label: "Empeoró", weight: 3 };
  return { icon: "⚠️", label: "Sin avance", weight: 2 };
}

export function NPRControlTable({ risks, onRiskClick }: { risks: RiskWithFolio[]; onRiskClick?: (folioId: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>("nprResidual");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    return [...risks]
      .map((r) => {
        const inicial = nprInicial(r);
        const residual = nprResidual(r);
        const reduccion = inicial > 0 ? Math.round(((inicial - residual) / inicial) * 100) : 0;
        const criticoResidual = residual >= 150 || r.sev_residual >= 9;
        const estado = rowEstado(inicial, residual, criticoResidual);
        return { r, inicial, residual, reduccion, criticoResidual, estado, accion: accionRegulatoria(residual) };
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        const values: Record<SortKey, [string | number, string | number]> = {
          id: [a.r.numero_id, b.r.numero_id],
          proceso: [a.r.etapa_proceso || a.r.peligro_modo_falla, b.r.etapa_proceso || b.r.peligro_modo_falla],
          nprInicial: [a.inicial, b.inicial],
          nprResidual: [a.residual, b.residual],
          reduccion: [a.reduccion, b.reduccion],
          estado: [a.estado.weight, b.estado.weight],
          accion: [a.accion, b.accion],
        };
        const [av, bv] = values[sortKey];
        return typeof av === "number" && typeof bv === "number"
          ? (av - bv) * dir
          : String(av).localeCompare(String(bv)) * dir;
      });
  }, [risks, sortDir, sortKey]);

  const sort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key.includes("npr") || key === "reduccion" ? "desc" : "asc");
    }
  };

  const SortHeader = ({ label, value }: { label: string; value: SortKey }) => (
    <button className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-primary" onClick={() => sort(value)}>
      {label}<ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs">
            <th className="px-3 py-3"><SortHeader label="ID Riesgo" value="id" /></th>
            <th className="px-3 py-3"><SortHeader label="Proceso/Etapa" value="proceso" /></th>
            <th className="px-3 py-3"><SortHeader label="NPR Inicial" value="nprInicial" /></th>
            <th className="px-3 py-3"><SortHeader label="NPR Residual" value="nprResidual" /></th>
            <th className="px-3 py-3"><SortHeader label="Reducción" value="reduccion" /></th>
            <th className="px-3 py-3"><SortHeader label="Estado" value="estado" /></th>
            <th className="px-3 py-3"><SortHeader label="Acción sugerida" value="accion" /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ r, inicial, residual, reduccion, criticoResidual, estado, accion }) => {
            const levelInicial = getNPRLevel(inicial, r.severidad);
            const levelResidual = getNPRLevel(residual, r.sev_residual);
            return (
              <tr
                key={r.id}
                className={`border-b last:border-0 hover:bg-muted/40 ${criticoResidual ? "bg-destructive/5" : ""} ${onRiskClick ? "cursor-pointer" : ""}`}
                onClick={() => onRiskClick?.(r.folio_id)}
              >
                <td className="px-3 py-3 font-mono text-xs text-primary">R-{String(r.numero_id).padStart(3, "0")}</td>
                <td className="px-3 py-3">
                  <div className="max-w-[260px]">
                    <p className="truncate font-medium">{r.etapa_proceso || "Sin etapa"}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.folios?.codigo || "—"} · {r.peligro_modo_falla || r.peligro || "Sin descripción"}</p>
                  </div>
                </td>
                <td className="px-3 py-3"><NPRBadge value={inicial} label={levelInicial.label} /></td>
                <td className="px-3 py-3"><NPRBadge value={residual} label={levelResidual.label} /></td>
                <td className={`px-3 py-3 font-bold ${reduccion > 0 ? "text-success" : "text-destructive"}`}>{reduccion > 0 ? "↓" : "↑"} {Math.abs(reduccion)}%</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{estado.icon} {estado.label}</span>
                    {criticoResidual && <Badge className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/10">⚠️ Crítico residual</Badge>}
                  </div>
                </td>
                <td className="px-3 py-3 font-medium text-primary">{accion}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Sin riesgos registrados</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function NPRBadge({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-bold tabular-nums">{value}</span>
      <Badge variant="outline" className={levelClasses(label)}>{label}</Badge>
    </div>
  );
}