import { useRef, useEffect, useState } from "react";
import type { Riesgo } from "@/hooks/useFolios";

const GRID = 10;
const CELL = 36;
const GAP = 2;
const LABEL_W = 20;
const LABEL_H = 16;
const PAD = 4;

function getCellBg(sev: number, ocu: number): string {
  const val = sev * ocu;
  if (val <= 6) return "hsl(var(--success) / 0.15)";
  if (val <= 15) return "hsl(var(--warning) / 0.15)";
  if (val <= 30) return "hsl(var(--npr-high) / 0.15)";
  return "hsl(var(--destructive) / 0.15)";
}

function getDotColor(sev: number, ocu: number): string {
  const val = sev * ocu;
  if (val <= 6) return "hsl(var(--success))";
  if (val <= 15) return "hsl(var(--warning))";
  if (val <= 30) return "hsl(var(--npr-high))";
  return "hsl(var(--destructive))";
}

/** Convert grid indices (0-based) to SVG pixel center */
function cellCenter(col: number, row: number) {
  return {
    x: LABEL_W + PAD + col * (CELL + GAP) + CELL / 2,
    y: LABEL_H + PAD + row * (CELL + GAP) + CELL / 2,
  };
}

interface Migration {
  fromSev: number;
  fromOcu: number;
  toSev: number;
  toOcu: number;
}

export function HeatMap({ risks }: { risks: Riesgo[] }) {
  const migrations: Migration[] = risks
    .filter((r) => r.sev_residual !== undefined && r.ocu_residual !== undefined)
    .map((r) => ({
      fromSev: Math.min(r.severidad, 10),
      fromOcu: Math.min(r.ocurrencia, 10),
      toSev: Math.min(r.sev_residual, 10),
      toOcu: Math.min(r.ocu_residual, 10),
    }));

  // Count initial hits per cell
  const initialGrid: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
  // Count residual hits per cell
  const residualGrid: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));

  migrations.forEach((m) => {
    initialGrid[m.fromSev - 1][m.fromOcu - 1]++;
    residualGrid[m.toSev - 1][m.toOcu - 1]++;
  });

  const totalW = LABEL_W + PAD + GRID * (CELL + GAP) - GAP;
  const totalH = LABEL_H + PAD + GRID * (CELL + GAP) - GAP;

  // Deduplicate arrows (group by from→to)
  const arrowMap = new Map<string, { from: Migration; count: number }>();
  migrations.forEach((m) => {
    if (m.fromSev === m.toSev && m.fromOcu === m.toOcu) return; // no movement
    const key = `${m.fromSev},${m.fromOcu}-${m.toSev},${m.toOcu}`;
    const existing = arrowMap.get(key);
    if (existing) existing.count++;
    else arrowMap.set(key, { from: m, count: 1 });
  });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[420px]">
        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-foreground/60 bg-transparent" />
            Inicial
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-foreground/60" />
            Residual
          </span>
          <span className="flex items-center gap-1">
            <svg width="18" height="10"><line x1="0" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1.5" /><polygon points="14,2 18,5 14,8" fill="currentColor" /></svg>
            Migración
          </span>
        </div>

        <div className="flex items-end mb-1" style={{ paddingLeft: LABEL_W + PAD }}>
          <span className="text-[10px] text-muted-foreground font-medium tracking-wide w-full text-center">
            OCURRENCIA →
          </span>
        </div>

        <div className="flex">
          <div className="flex flex-col items-center justify-center" style={{ width: LABEL_W }}>
            <span
              className="text-[10px] text-muted-foreground font-medium tracking-wide"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              SEVERIDAD →
            </span>
          </div>

          <div className="relative">
            <svg
              width={totalW}
              height={totalH}
              viewBox={`0 0 ${totalW} ${totalH}`}
              className="block"
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="6"
                  markerHeight="4"
                  refX="5"
                  refY="2"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 6 2, 0 4"
                    fill="hsl(var(--foreground) / 0.5)"
                  />
                </marker>
              </defs>

              {/* Column labels */}
              {Array.from({ length: 10 }, (_, i) => {
                const x = LABEL_W + PAD + i * (CELL + GAP) + CELL / 2;
                return (
                  <text
                    key={`cl-${i}`}
                    x={x}
                    y={LABEL_H - 4}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {i + 1}
                  </text>
                );
              })}

              {/* Row labels + cells */}
              {Array.from({ length: 10 }, (_, rowIdx) => {
                const sev = 10 - rowIdx;
                const y = LABEL_H + PAD + rowIdx * (CELL + GAP);
                return (
                  <g key={`row-${sev}`}>
                    <text
                      x={LABEL_W - 2}
                      y={y + CELL / 2 + 4}
                      textAnchor="end"
                      className="fill-muted-foreground"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {sev}
                    </text>

                    {Array.from({ length: 10 }, (_, colIdx) => {
                      const ocu = colIdx + 1;
                      const cx = LABEL_W + PAD + colIdx * (CELL + GAP);
                      const iCount = initialGrid[sev - 1][colIdx];
                      const rCount = residualGrid[sev - 1][colIdx];
                      return (
                        <g key={`${sev}-${ocu}`}>
                          <rect
                            x={cx}
                            y={y}
                            width={CELL}
                            height={CELL}
                            rx={3}
                            fill={getCellBg(sev, ocu)}
                          />
                          {/* Initial count — hollow circle */}
                          {iCount > 0 && (
                            <>
                              <circle
                                cx={cx + CELL / 2 - (rCount > 0 ? 6 : 0)}
                                cy={y + CELL / 2}
                                r={8}
                                fill="transparent"
                                stroke={getDotColor(sev, ocu)}
                                strokeWidth={2}
                              />
                              <text
                                x={cx + CELL / 2 - (rCount > 0 ? 6 : 0)}
                                y={y + CELL / 2 + 3.5}
                                textAnchor="middle"
                                fontSize="9"
                                fontWeight="bold"
                                fill={getDotColor(sev, ocu)}
                              >
                                {iCount}
                              </text>
                            </>
                          )}
                          {/* Residual count — filled circle */}
                          {rCount > 0 && (
                            <>
                              <circle
                                cx={cx + CELL / 2 + (iCount > 0 ? 6 : 0)}
                                cy={y + CELL / 2}
                                r={6}
                                fill={getDotColor(sev, ocu)}
                                opacity={0.8}
                              />
                              <text
                                x={cx + CELL / 2 + (iCount > 0 ? 6 : 0)}
                                y={y + CELL / 2 + 3}
                                textAnchor="middle"
                                fontSize="8"
                                fontWeight="bold"
                                fill="white"
                              >
                                {rCount}
                              </text>
                            </>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Migration arrows */}
              {Array.from(arrowMap.values()).map(({ from: m, count }, i) => {
                const fromRow = 10 - m.fromSev;
                const fromCol = m.fromOcu - 1;
                const toRow = 10 - m.toSev;
                const toCol = m.toOcu - 1;
                const start = cellCenter(fromCol, fromRow);
                const end = cellCenter(toCol, toRow);

                // Shorten arrow so it doesn't overlap circles
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len === 0) return null;
                const ux = dx / len;
                const uy = dy / len;
                const s = { x: start.x + ux * 10, y: start.y + uy * 10 };
                const e = { x: end.x - ux * 8, y: end.y - uy * 8 };

                return (
                  <line
                    key={`arrow-${i}`}
                    x1={s.x}
                    y1={s.y}
                    x2={e.x}
                    y2={e.y}
                    stroke="hsl(var(--foreground) / 0.35)"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
