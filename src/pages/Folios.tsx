import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, FileDown, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFolios, useAllRiesgos, getEstadoStyle, getNPRLevel } from "@/hooks/useFolios";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Exportar a CSV (abre en Excel sin instalar librerías extra) ───────────────
function exportarCSV(folios: any[], riesgosMap: Map<string, any[]>) {
  const filas: string[][] = [];

  // Encabezado
  filas.push([
    "Folio",
    "Proceso / Equipo",
    "Origen",
    "Estado",
    "Conclusión",
    "Fecha Inicio",
    "Fecha Cierre",
    "Total Riesgos",
    "Riesgos Críticos",
    "NPR Máximo",
    "Acciones Pendientes",
  ]);

  folios.forEach((f) => {
    const riesgos = riesgosMap.get(f.id) || [];
    const criticos = riesgos.filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9).length;
    const nprMax = riesgos.length ? Math.max(...riesgos.map((r) => r.npr ?? 0)) : 0;
    const accionesPendientes = riesgos.filter((r) => r.requiere_accion && !r.accion_implementada).length;

    filas.push([
      f.codigo,
      f.proceso_equipo,
      f.origen,
      f.estado,
      f.conclusion || "Pendiente",
      f.fecha_inicio,
      f.fecha_cierre || "—",
      String(riesgos.length),
      String(criticos),
      String(nprMax),
      String(accionesPendientes),
    ]);
  });

  // Construir contenido CSV con BOM para que Excel abra bien en español
  const bom = "\uFEFF";
  const csv = bom + filas.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `DIAFRA_Listado_Folios_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Exportar a PDF ────────────────────────────────────────────────────────────
function exportarPDF(folios: any[], riesgosMap: Map<string, any[]>) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;

  // Encabezado
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("DIAFRA S.A. DE C.V.", pageW / 2, 12, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("LISTADO DE FOLIOS — SISTEMA DE GESTIÓN DE RIESGOS FOR-SGC-11-01", pageW / 2, 18, { align: "center" });
  doc.setFontSize(7);
  doc.text(
    `Generado: ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}`,
    pageW / 2,
    23,
    { align: "center" },
  );
  doc.line(margin, 25, pageW - margin, 25);

  // Resumen ejecutivo
  const totalFolios = folios.length;
  const totalRiesgos = Array.from(riesgosMap.values()).flat().length;
  const totalCriticos = Array.from(riesgosMap.values())
    .flat()
    .filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9).length;
  const aprobados = folios.filter((f) => f.conclusion === "Aprobado").length;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Resumen: ${totalFolios} folios · ${totalRiesgos} riesgos totales · ${totalCriticos} críticos · ${aprobados} aprobados`,
    pageW / 2,
    30,
    { align: "center" },
  );

  // Tabla principal
  const rows = folios.map((f) => {
    const riesgos = riesgosMap.get(f.id) || [];
    const criticos = riesgos.filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9).length;
    const nprMax = riesgos.length ? Math.max(...riesgos.map((r) => r.npr ?? 0)) : 0;
    const nivel = getNPRLevel(nprMax);
    const accionesPendientes = riesgos.filter((r) => r.requiere_accion && !r.accion_implementada).length;

    return [
      f.codigo,
      f.proceso_equipo,
      f.origen,
      f.estado,
      f.conclusion || "Pendiente",
      f.fecha_inicio,
      f.fecha_cierre || "—",
      String(riesgos.length),
      String(criticos),
      `${nivel.dot} ${nprMax}`,
      accionesPendientes > 0 ? `⚠ ${accionesPendientes}` : "✓",
    ];
  });

  autoTable(doc, {
    startY: 34,
    head: [
      [
        "Folio",
        "Proceso / Equipo",
        "Origen",
        "Estado",
        "Conclusión",
        "F. Inicio",
        "F. Cierre",
        "Riesgos",
        "Críticos",
        "NPR Máx.",
        "Acc. Pend.",
      ],
    ],
    body: rows,
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [30, 30, 60], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      1: { cellWidth: 55 },
      2: { cellWidth: 28 },
      3: { cellWidth: 20 },
      4: { cellWidth: 22 },
      5: { cellWidth: 20 },
      6: { cellWidth: 20 },
      7: { cellWidth: 14, halign: "center" },
      8: { cellWidth: 14, halign: "center" },
      9: { cellWidth: 18, halign: "center" },
      10: { cellWidth: 18, halign: "center" },
    },
    didParseCell: (data) => {
      // Colorear por estado
      if (data.column.index === 3 && data.section === "body") {
        const estado = data.cell.raw as string;
        if (estado === "Aprobado") data.cell.styles.textColor = [15, 110, 86];
        if (estado === "Borrador") data.cell.styles.textColor = [100, 100, 100];
        if (estado === "En Firma") data.cell.styles.textColor = [30, 100, 200];
        if (estado === "Cerrado") data.cell.styles.textColor = [60, 60, 60];
      }
      // Resaltar críticos
      if (data.column.index === 8 && data.section === "body") {
        const val = parseInt(data.cell.raw as string);
        if (val > 0) data.cell.styles.textColor = [180, 0, 0];
      }
      // Acciones pendientes
      if (data.column.index === 10 && data.section === "body") {
        const val = data.cell.raw as string;
        if (val.startsWith("⚠")) data.cell.styles.textColor = [180, 80, 0];
        if (val === "✓") data.cell.styles.textColor = [15, 110, 86];
      }
    },
    margin: { left: margin, right: margin },
  });

  // Pie de página
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(6);
  doc.setFont("helvetica", "italic");
  doc.text("Documento confidencial propiedad de Diafra S.A. de C.V. — FOR-SGC-11-01", pageW / 2, pageH - 6, {
    align: "center",
  });

  doc.save(`DIAFRA_Listado_Folios_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function Folios() {
  const navigate = useNavigate();
  const { data: folios, isLoading } = useFolios();
  const { data: allRiesgos, isLoading: loadingRiesgos } = useAllRiesgos();

  // Agrupar riesgos por folio_id para acceso rápido
  const riesgosMap = new Map<string, any[]>();
  (allRiesgos || []).forEach((r) => {
    if (!riesgosMap.has(r.folio_id)) riesgosMap.set(r.folio_id, []);
    riesgosMap.get(r.folio_id)!.push(r);
  });

  const cargando = isLoading || loadingRiesgos;
  const lista = folios || [];

  const handleExportCSV = () => exportarCSV(lista, riesgosMap);
  const handleExportPDF = () => exportarPDF(lista, riesgosMap);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Folios</h1>
          <p className="text-sm text-muted-foreground">Archivos Maestros de Gestión de Riesgos — FOR-SGC-11-01</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botones de exportación — solo visibles cuando hay folios */}
          {lista.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExportCSV}
                title="Exportar listado a Excel (CSV)"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExportPDF}
                title="Exportar listado a PDF"
              >
                <FileDown className="h-4 w-4" />
                PDF
              </Button>
            </>
          )}
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo Folio
          </Button>
        </div>
      </div>

      {/* Resumen rápido */}
      {!cargando && lista.length > 0 && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{lista.length} folios</span>
          <span>·</span>
          <span>{lista.filter((f) => f.estado !== "Cerrado").length} activos</span>
          <span>·</span>
          <span>{lista.filter((f) => f.conclusion === "Aprobado").length} aprobados</span>
          <span>·</span>
          <span className="text-destructive font-medium">
            {
              Array.from(riesgosMap.values())
                .flat()
                .filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9).length
            }{" "}
            riesgos críticos
          </span>
        </div>
      )}

      <div className="grid gap-4">
        {cargando &&
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}

        {lista.map((folio) => {
          const riesgos = riesgosMap.get(folio.id) || [];
          const criticos = riesgos.filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9).length;
          const accionesPendientes = riesgos.filter((r) => r.requiere_accion && !r.accion_implementada).length;

          return (
            <Card
              key={folio.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/folios/${folio.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="font-mono text-sm font-bold text-primary whitespace-nowrap">{folio.codigo}</div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{folio.proceso_equipo}</p>
                      <p className="text-xs text-muted-foreground">
                        Origen: {folio.origen} · Inicio: {folio.fecha_inicio}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Indicadores inline */}
                    {criticos > 0 && (
                      <span className="text-xs text-destructive font-medium">
                        🔴 {criticos} crítico{criticos > 1 ? "s" : ""}
                      </span>
                    )}
                    {accionesPendientes > 0 && (
                      <span className="text-xs text-amber-600 font-medium">⚠ {accionesPendientes} acc.</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {riesgos.length} riesgo{riesgos.length !== 1 ? "s" : ""}
                    </span>
                    <Badge className={`text-[10px] ${getEstadoStyle(folio.estado)}`}>{folio.estado}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {!cargando && lista.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No hay folios registrados aún.</p>
        )}
      </div>
    </div>
  );
}
