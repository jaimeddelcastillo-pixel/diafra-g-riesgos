import { CATEGORIAS_6M, type Categoria6M } from "@/config/wizard-content";

interface Props {
  peligro: string;
  causas: Record<Categoria6M, string[]>;
}

/**
 * Diagrama Ishikawa SVG simple: espina horizontal + 6 ramas (3 arriba / 3 abajo).
 * Cada categoría con causas se pinta en color primario, vacía en muted.
 */
export function IshikawaDiagram({ peligro, causas }: Props) {
  const VB_W = 800;
  const VB_H = 320;
  const spineY = VB_H / 2;
  const spineX1 = 40;
  const spineX2 = VB_W - 160;

  // 3 arriba / 3 abajo, distribuidas
  const positions = [
    { x: 140, dir: -1 }, // mano_obra (top-left)
    { x: 320, dir: -1 }, // metodo (top-mid)
    { x: 500, dir: -1 }, // medio_ambiente (top-right)
    { x: 140, dir: 1 }, // maquina (bot-left)
    { x: 320, dir: 1 }, // material (bot-mid)
    { x: 500, dir: 1 }, // medicion (bot-right)
  ];

  const order: Categoria6M[] = [
    "mano_obra",
    "metodo",
    "medio_ambiente",
    "maquina",
    "material",
    "medicion",
  ];

  const truncar = (t: string, max = 22) =>
    t.length > max ? t.slice(0, max - 1) + "…" : t;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-auto rounded-md border bg-muted/20"
      role="img"
      aria-label="Diagrama Ishikawa"
    >
      {/* Espina principal */}
      <line
        x1={spineX1}
        y1={spineY}
        x2={spineX2}
        y2={spineY}
        stroke="hsl(var(--primary))"
        strokeWidth={3}
      />
      {/* Cabeza con peligro */}
      <polygon
        points={`${spineX2},${spineY - 14} ${spineX2 + 22},${spineY} ${spineX2},${spineY + 14}`}
        fill="hsl(var(--primary))"
      />
      <rect
        x={spineX2 + 26}
        y={spineY - 22}
        width={130}
        height={44}
        rx={6}
        fill="hsl(var(--primary))"
        opacity={0.95}
      />
      <foreignObject x={spineX2 + 28} y={spineY - 20} width={126} height={40}>
        <div
          style={{
            color: "hsl(var(--primary-foreground))",
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.1,
            display: "flex",
            alignItems: "center",
            height: "100%",
            padding: "0 4px",
            wordBreak: "break-word",
          }}
        >
          {peligro || "Peligro"}
        </div>
      </foreignObject>

      {order.map((cat, i) => {
        const { x, dir } = positions[i];
        const tieneCausas = (causas[cat] || []).length > 0;
        const color = tieneCausas ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";
        const opacity = tieneCausas ? 1 : 0.45;
        const endY = spineY + dir * 110;
        const labelY = dir < 0 ? endY - 10 : endY + 16;
        const meta = CATEGORIAS_6M.find((c) => c.key === cat)!;
        const lista = causas[cat] || [];
        return (
          <g key={cat} opacity={opacity}>
            {/* Rama diagonal */}
            <line
              x1={x + 60}
              y1={spineY}
              x2={x}
              y2={endY}
              stroke={color}
              strokeWidth={2}
            />
            <text
              x={x}
              y={labelY}
              fontSize={12}
              fontWeight={700}
              fill={color}
              textAnchor="middle"
            >
              {meta.titulo}
            </text>
            {/* Sub-ramas (hasta 4 causas) */}
            {lista.slice(0, 4).map((c, j) => {
              const subY = dir < 0
                ? spineY + dir * (35 + j * 18)
                : spineY + dir * (35 + j * 18);
              const subStartX = x + 60 - (j + 1) * 12;
              const subEndX = subStartX - 50;
              return (
                <g key={j}>
                  <line
                    x1={subStartX}
                    y1={subY}
                    x2={subEndX}
                    y2={subY}
                    stroke={color}
                    strokeWidth={1}
                  />
                  <text
                    x={subEndX - 4}
                    y={subY + 3}
                    fontSize={9}
                    fill={color}
                    textAnchor="end"
                  >
                    <title>{c}</title>
                    {truncar(c, 18)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}