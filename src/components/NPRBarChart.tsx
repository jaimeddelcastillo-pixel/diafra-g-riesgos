import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { getNPRLevel } from "@/hooks/useFolios";
import type { Riesgo } from "@/hooks/useFolios";

const COLORS_INICIAL: Record<string, string> = {
  "Menor": "hsl(152, 60%, 40%)",
  "Mayor": "hsl(38, 92%, 50%)",
  "Crítico": "hsl(0, 72%, 51%)",
};

const COLORS_RESIDUAL: Record<string, string> = {
  "Menor": "hsl(152, 60%, 65%)",
  "Mayor": "hsl(38, 92%, 72%)",
  "Crítico": "hsl(0, 72%, 72%)",
};

export function NPRBarChart({ risks }: { risks: Riesgo[] }) {
  const inicial = { Menor: 0, Mayor: 0, Crítico: 0 };
  const residual = { Menor: 0, Mayor: 0, Crítico: 0 };

  risks.forEach((r) => {
    const nprInicial = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
    const levelInicial = getNPRLevel(nprInicial, r.severidad).label;
    inicial[levelInicial as keyof typeof inicial]++;

    const nprResidual = r.npr_residual ?? r.sev_residual * r.ocu_residual * r.det_residual;
    const levelResidual = getNPRLevel(nprResidual, r.sev_residual).label;
    residual[levelResidual as keyof typeof residual]++;
  });

  const data = (["Menor", "Mayor", "Crítico"] as const).map((name) => ({
    name,
    inicial: inicial[name],
    residual: residual[name],
    colorInicial: COLORS_INICIAL[name],
    colorResidual: COLORS_RESIDUAL[name],
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: number, name: string) => [
            value,
            name === "inicial" ? "Inicial" : "Residual",
          ]}
        />
        <Legend
          formatter={(value: string) => (value === "inicial" ? "Inicial" : "Residual")}
        />
        <Bar dataKey="inicial" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={`ini-${entry.name}`} fill={entry.colorInicial} />
          ))}
        </Bar>
        <Bar dataKey="residual" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={`res-${entry.name}`} fill={entry.colorResidual} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
