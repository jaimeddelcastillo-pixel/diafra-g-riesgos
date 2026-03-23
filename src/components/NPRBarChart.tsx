import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getNPRLevel } from "@/hooks/useFolios";
import type { Riesgo } from "@/hooks/useFolios";

const COLORS: Record<string, string> = {
  "Menor": "hsl(152, 60%, 40%)",
  "Mayor": "hsl(38, 92%, 50%)",
  "Crítico": "hsl(0, 72%, 51%)",
};

export function NPRBarChart({ risks }: { risks: Riesgo[] }) {
  const counts = { Menor: 0, Mayor: 0, Crítico: 0 };
  risks.forEach((r) => {
    const npr = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
    const level = getNPRLevel(npr, r.severidad).label;
    counts[level as keyof typeof counts]++;
  });
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
