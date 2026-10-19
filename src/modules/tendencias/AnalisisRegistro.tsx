// Copia de TempHRAnalysis / PresionAnalysis (atdiafra): tarjeta de análisis del registro al pie de la captura.
// Adaptado: límites del registro (tend_registros) y periodo elegido; motor estadístico intacto.
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, ReferenceLine, ReferenceArea,
  XAxis, YAxis, Tooltip, CartesianGrid, Scatter, Legend,
} from "recharts";
import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { descriptive, capability, westernElectric, fmt } from "./lib/statistics";
import { flattenLecturas, type Registro, type Semana } from "./lib/semanas";
import { recortarSemanasPorFecha } from "./lib/fechas-lectura";

interface VarConfig {
  campo: "lecturas" | "lecturas_hr";
  label: string;
  unit: string;
  LSL: number | null;
  USL: number | null;
  color: string;
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "bad" }) {
  const toneClass =
    tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function AnalysisBlock({ semanas, cfg }: { semanas: Semana[]; cfg: VarConfig }) {
  const series = useMemo(() => flattenLecturas(semanas, cfg.campo), [semanas, cfg.campo]);
  const values = series.map((s) => s.value);
  const stats = descriptive(values);
  const cap = capability(values, cfg.LSL, cfg.USL);
  const we = stats ? westernElectric(values, stats.mean, stats.stdev) : [];
  const sigma = stats?.stdev ?? 0;
  const mean = stats?.mean ?? 0;

  const enriched = series.map((s) => {
    const oos = (cfg.LSL != null && s.value < cfg.LSL) || (cfg.USL != null && s.value > cfg.USL);
    const ooc = sigma ? Math.abs(s.value - mean) > 3 * sigma : false;
    return { ...s, oos, ooc };
  });
  const outliers = enriched.filter((d) => d.oos || d.ooc);
  const editados = enriched.filter((d) => d.edited);

  if (!stats) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Sin datos suficientes para analizar {cfg.label.toLowerCase()}.
      </div>
    );
  }

  const cpkTone: "ok" | "warn" | "bad" = cap.Cpk == null ? "warn" : cap.Cpk >= 1.33 ? "ok" : "warn";
  const oosTone: "ok" | "warn" | "bad" = cap.withinSpec >= 100 ? "ok" : cap.withinSpec >= 95 ? "warn" : "bad";
  const hayOOS = outliers.some((d) => d.oos);
  const spec = `${cfg.LSL ?? "—"}–${cfg.USL ?? "—"} ${cfg.unit}`;
  const lo = cfg.LSL ?? Infinity;
  const hi = cfg.USL ?? -Infinity;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{cfg.label}</h3>
          <p className="text-xs text-muted-foreground">Especificación: {spec} · n = {stats.n}</p>
        </div>
        {we.length === 0 && outliers.length === 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Bajo control
          </span>
        ) : hayOOS ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> Fuera de spec · {outliers.filter((d) => d.oos).length}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> En observación · {we.length} señal(es)
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          <StatCard label="Media" value={`${fmt(stats.mean)} ${cfg.unit}`} />
          <StatCard label="σ (s)" value={fmt(stats.stdev, 3)} />
          <StatCard label="Mín / Máx" value={`${fmt(stats.min)} / ${fmt(stats.max)}`} />
          <StatCard label="P5 / P95" value={`${fmt(stats.p5)} / ${fmt(stats.p95)}`} />
          <StatCard label="Cpk / Ppk" value={`${fmt(cap.Cpk)} / ${fmt(cap.Ppk)}`} tone={cpkTone}
            sub={cap.Cp != null ? `Cp ${fmt(cap.Cp)}` : undefined} />
          <StatCard label="Dentro de spec" value={`${fmt(cap.withinSpec, 1)} %`} tone={oosTone} />
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={enriched} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]}
                tickFormatter={(v) => new Date(v).toLocaleDateString()} fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[
                  (dataMin: number) => Math.min(dataMin, lo) - sigma,
                  (dataMax: number) => Math.max(dataMax, hi) + sigma,
                ]} fontSize={11} stroke="hsl(var(--muted-foreground))" width={40} />
              <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleString()}
                formatter={(val) => [`${fmt(Number(val))} ${cfg.unit}`, cfg.label]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              <ReferenceArea y1={mean - sigma} y2={mean + sigma} fill="hsl(var(--success))" fillOpacity={0.06} />
              <ReferenceArea y1={mean - 2 * sigma} y2={mean - sigma} fill="hsl(var(--warning))" fillOpacity={0.07} />
              <ReferenceArea y1={mean + sigma} y2={mean + 2 * sigma} fill="hsl(var(--warning))" fillOpacity={0.07} />

              <ReferenceLine y={mean} stroke="hsl(var(--primary))" strokeDasharray="4 4" label={{ value: "X̄", position: "right", fontSize: 11 }} />
              <ReferenceLine y={mean + 2 * sigma} stroke="hsl(var(--warning))" strokeDasharray="2 4" />
              <ReferenceLine y={mean - 2 * sigma} stroke="hsl(var(--warning))" strokeDasharray="2 4" />
              <ReferenceLine y={mean + 3 * sigma} stroke="hsl(var(--destructive))" strokeDasharray="2 2" label={{ value: "+3σ", position: "right", fontSize: 11 }} />
              <ReferenceLine y={mean - 3 * sigma} stroke="hsl(var(--destructive))" strokeDasharray="2 2" label={{ value: "-3σ", position: "right", fontSize: 11 }} />

              {cfg.USL != null && <ReferenceLine y={cfg.USL} stroke="hsl(var(--destructive))" label={{ value: `LSE ${cfg.USL}`, position: "insideTopRight", fontSize: 11, fill: "hsl(var(--destructive))" }} />}
              {cfg.LSL != null && <ReferenceLine y={cfg.LSL} stroke="hsl(var(--destructive))" label={{ value: `LIE ${cfg.LSL}`, position: "insideBottomRight", fontSize: 11, fill: "hsl(var(--destructive))" }} />}

              <Line type="monotone" dataKey="value" name={cfg.label} stroke={cfg.color} strokeWidth={2}
                dot={{ r: 3, fill: cfg.color }} activeDot={{ r: 5 }} isAnimationActive={false} />
              <Scatter data={outliers} dataKey="value" fill="hsl(var(--destructive))" name="Fuera de spec / 3σ" />
              <Scatter data={editados} dataKey="value" fill="hsl(var(--warning))" shape="triangle" name="Editado manualmente" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {we.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-warning" />
              <p className="text-sm font-semibold text-foreground">Reglas Western Electric activadas</p>
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {we.slice(-6).map((h, i) => (
                <li key={i}>
                  <span className="inline-block min-w-12 font-medium text-foreground">Regla {h.rule}</span>
                  · punto #{h.index + 1} ({enriched[h.index]?.label}) — {h.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalisisRegistro({ registro, unidad }: { registro: Registro; unidad: string }) {
  const [desde, setDesde] = useState(`${new Date().getFullYear()}-01-01`);
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10));
  const semanas = useMemo(
    () => (desde && hasta && desde <= hasta ? recortarSemanasPorFecha(registro.semanas, desde, hasta) : registro.semanas),
    [registro.semanas, desde, hasta],
  );
  const esTHR = registro.modulo === "temphr";
  const configs: VarConfig[] = esTHR
    ? [
        { campo: "lecturas", label: "Temperatura", unit: "°C", LSL: registro.lie_t ?? registro.lie ?? null, USL: registro.lse_t ?? registro.lse ?? null, color: "hsl(var(--primary))" },
        { campo: "lecturas_hr", label: "Humedad Relativa", unit: "%", LSL: registro.lie_hr ?? null, USL: registro.lse_hr ?? null, color: "hsl(var(--accent-foreground))" },
      ]
    : [{ campo: "lecturas", label: registro.modulo === "presiones" ? "Presión diferencial" : "Lectura", unit, LSL: registro.lie ?? null, USL: registro.lse ?? null, color: "hsl(var(--primary))" }];
  return (
    <section className="space-y-5 border-t pt-4" aria-label="Análisis del registro">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-semibold">Análisis del registro</h3>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1"><Label htmlFor="analisis-desde" className="text-xs">Desde</Label><Input id="analisis-desde" type="date" className="h-9" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="analisis-hasta" className="text-xs">Hasta</Label><Input id="analisis-hasta" type="date" className="h-9" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} /></div>
        </div>
      </div>
      {configs.map((c) => <AnalysisBlock key={c.campo} semanas={semanas} cfg={c} />)}
    </section>
  );
}
