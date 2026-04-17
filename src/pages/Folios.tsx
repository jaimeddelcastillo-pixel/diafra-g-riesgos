import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, ChevronRight, FileDown, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Constants } from "@/integrations/supabase/types";
import { useFolios, useAllRiesgos, getEstadoStyle, getNPRLevel } from "@/hooks/useFolios";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Exportar a CSV (abre en Excel sin instalar librerías extra) ───────────────
function exportarCSV(folios: any[], riesgosMap: Map<string, any[]>) {
  const filas: string[][] = [];

  filas.push([
    "Folio",
    "Proceso / Equipo",
    "Origen",
    "Estado",
    "Conclusion",
    "Fecha Inicio",
    "Fecha Cierre",
    "Total Riesgos",
    "Riesgos Criticos",
    "NPR Maximo",
    "Nivel NPR",
    "Acciones Sin Definir",
    "Sin Responsable",
    "Sin Evidencia",
  ]);

  folios.forEach((f) => {
    const riesgos = riesgosMap.get(f.id) || [];
    const criticos = riesgos.filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9).length;
    const nprMax = riesgos.length ? Math.max(...riesgos.map((r) => r.npr ?? 0)) : 0;
    const nivel = getNPRLevel(nprMax);
    const nivelTexto = nivel.label === "Crítico" ? "CRITICO" : nivel.label === "Mayor" ? "MAYOR" : "Menor";
    const accionesSinDefinir = riesgos.filter(
      (r) => ((r.npr ?? 0) > 150 || r.severidad >= 9) && !r.accion_propuesta,
    ).length;
    const sinResponsable = riesgos.filter((r) => r.accion_propuesta && !r.responsable).length;
    const sinEvidencia = riesgos.filter(
      (r) =>
        ((r.npr ?? 0) > 150 || r.severidad >= 9) &&
        r.accion_propuesta &&
        (!(r as any).anexos || (r as any).anexos.length === 0),
    ).length;

    filas.push([
      f.codigo,
      f.proceso_equipo,
      f.origen,
      f.estado,
      f.conclusion || "Pendiente",
      f.fecha_inicio,
      f.fecha_cierre || "",
      String(riesgos.length),
      String(criticos),
      String(nprMax),
      nivelTexto,
      accionesSinDefinir > 0 ? `PENDIENTE (${accionesSinDefinir})` : "OK",
      sinResponsable > 0 ? `SIN ASIGNAR (${sinResponsable})` : "OK",
      sinEvidencia > 0 ? `FALTA (${sinEvidencia})` : "OK",
    ]);
  });

  const bom = "\uFEFF";
  const csv = bom + filas.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `TRACEA_Listado_Folios_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Exportar a PDF ────────────────────────────────────────────────────────────
async function exportarPDF(folios: any[], riesgosMap: Map<string, any[]>) {
  // A4 landscape — 297mm × 210mm — más espacio que letter para 13 columnas
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;

  // Cargar logo desde carpeta pública
  let logoData: string | null = null;
  try {
    const resp = await fetch("/logo-tracea.png");
    if (resp.ok) {
      const blob = await resp.blob();
      logoData = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    /* continúa sin logo */
  }

  // ─── Encabezado y pie reutilizables ────────────────────────────────────────
  function addHeader(pageIndex: number, totalPages: number) {
    // Marco encabezado
    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.rect(margin, 4, pageW - 2 * margin, 18);
    doc.setLineWidth(0.3);
    doc.line(margin + 28, 4, margin + 28, 22);
    doc.line(pageW - margin - 32, 4, pageW - margin - 32, 22);

    // Logo
    if (logoData) {
      doc.addImage(logoData, "PNG", margin + 1, 5.5, 24, 13);
    } else {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 31, 61);
      doc.text("TRACEA", margin + 3, 11);
      doc.setTextColor(0);
    }

    // Título central
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("TRACEA", pageW / 2, 10, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text("FORMATO — DEPARTAMENTO: SISTEMA DE GESTIÓN DE CALIDAD", pageW / 2, 15, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("LISTADO DE FOLIOS — SISTEMA DE GESTIÓN DE RIESGOS", pageW / 2, 20, { align: "center" });

    // Código y página (derecha)
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("FOR-SGC-11-01 (02)", pageW - margin - 16, 11, { align: "center" });
    doc.text(`Página ${pageIndex} de ${totalPages}`, pageW - margin - 16, 17, { align: "center" });
  }

  function addFooter() {
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(80);
    doc.text(
      `Documento confidencial propiedad de Diafra S.A. de C.V. — FOR-SGC-11-01  |  Generado: ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}`,
      pageW / 2,
      pageH - 3,
      { align: "center" },
    );
    doc.setTextColor(0);
  }

  // ─── Resumen ejecutivo ──────────────────────────────────────────────────────
  const totalFolios = folios.length;
  const todosRiesgos = Array.from(riesgosMap.values()).flat();
  const totalRiesgos = todosRiesgos.length;
  const totalCriticos = todosRiesgos.filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9).length;
  const aprobados = folios.filter((f) => f.conclusion === "Aprobado").length;
  const enFirma = folios.filter((f) => f.estado === "En Firma").length;
  const borradores = folios.filter((f) => f.estado === "Borrador").length;

  // ─── Filas de datos ─────────────────────────────────────────────────────────
  const rows = folios.map((f) => {
    const riesgos = riesgosMap.get(f.id) || [];
    const criticos = riesgos.filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9).length;
    const nprMax = riesgos.length ? Math.max(...riesgos.map((r) => r.npr ?? 0)) : 0;
    const nivel = getNPRLevel(nprMax);
    const nivelTexto = nivel.label === "Crítico" ? "CRITICO" : nivel.label === "Mayor" ? "MAYOR" : "Menor";
    const accionesSinDefinir = riesgos.filter(
      (r) => ((r.npr ?? 0) > 150 || r.severidad >= 9) && !r.accion_propuesta,
    ).length;
    const sinResponsable = riesgos.filter((r) => r.accion_propuesta && !r.responsable).length;
    const sinEvidencia = riesgos.filter(
      (r) =>
        ((r.npr ?? 0) > 150 || r.severidad >= 9) &&
        r.accion_propuesta &&
        (!(r as any).anexos || (r as any).anexos.length === 0),
    ).length;

    return [
      f.codigo,
      f.proceso_equipo,
      f.origen,
      f.estado,
      f.conclusion || "Pendiente",
      f.fecha_inicio,
      f.fecha_cierre || "",
      String(riesgos.length),
      String(criticos),
      `${nprMax}\n${nivelTexto}`,
      accionesSinDefinir > 0 ? `PEND.\n(${accionesSinDefinir})` : "OK",
      sinResponsable > 0 ? `S/ASIG\n(${sinResponsable})` : "OK",
      sinEvidencia > 0 ? `FALTA\n(${sinEvidencia})` : "OK",
    ];
  });

  // ─── Generar tabla (primera página) ────────────────────────────────────────
  addFooter();

  // Fila de resumen ejecutivo encima de la tabla
  const startY = 28;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 245);
  doc.rect(margin, startY - 1, pageW - 2 * margin, 6, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(margin, startY - 1, pageW - 2 * margin, 6);
  doc.text(
    `Resumen:   ${totalFolios} folios   ·   ${totalRiesgos} riesgos totales   ·   ${totalCriticos} críticos   ·   ${aprobados} aprobados   ·   ${enFirma} en firma   ·   ${borradores} en borrador`,
    pageW / 2,
    startY + 3.5,
    { align: "center" },
  );

  autoTable(doc, {
    startY: startY + 7,
    head: [
      [
        "Folio",
        "Proceso / Equipo",
        "Origen",
        "Estado",
        "Conclusión",
        "F. Inicio",
        "F. Cierre",
        "Total\nRiesgos",
        "Críticos",
        "NPR\nMáx.",
        "Acc.\nS/Definir",
        "Resp.\nS/Asignar",
        "Evid.\nPendiente",
      ],
    ],
    body: rows,
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, overflow: "linebreak" },
    headStyles: {
      fillColor: [15, 31, 61],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.5,
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold" },
      1: { cellWidth: 52 },
      2: { cellWidth: 22 },
      3: { cellWidth: 18 },
      4: { cellWidth: 20 },
      5: { cellWidth: 20 },
      6: { cellWidth: 20 },
      7: { cellWidth: 14, halign: "center" },
      8: { cellWidth: 14, halign: "center" },
      9: { cellWidth: 22, halign: "center" },
      10: { cellWidth: 20, halign: "center" },
      11: { cellWidth: 20, halign: "center" },
      12: { cellWidth: 20, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.column.index === 3 && data.section === "body") {
        const e = data.cell.raw as string;
        if (e === "Aprobado") data.cell.styles.textColor = [15, 110, 86];
        if (e === "Borrador") data.cell.styles.textColor = [100, 100, 100];
        if (e === "En Firma") data.cell.styles.textColor = [30, 100, 200];
        if (e === "Rechazado") data.cell.styles.textColor = [180, 0, 0];
      }
      if (data.column.index === 8 && data.section === "body") {
        if (parseInt(data.cell.raw as string) > 0) data.cell.styles.textColor = [180, 0, 0];
      }
      if ([10, 11, 12].includes(data.column.index) && data.section === "body") {
        const val = data.cell.raw as string;
        if (val === "OK") data.cell.styles.textColor = [15, 110, 86];
        else data.cell.styles.textColor = [180, 0, 0];
      }
      // Fondo suave para filas alternas
      if (data.section === "body" && data.row.index % 2 === 1) {
        data.cell.styles.fillColor = [250, 250, 252];
      }
    },
    // Agregar encabezado y pie en cada página adicional
    didDrawPage: (data) => {
      addFooter();
    },
    margin: { left: margin, right: margin },
  });

  // Renderizar encabezados con total de páginas correcto
  const totalPgs = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPgs; i++) {
    doc.setPage(i);
    addHeader(i, totalPgs);
  }

  doc.save(`TRACEA_Listado_Folios_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Formulario nuevo folio ───────────────────────────────────────────────────
function NuevoFolioDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    proceso_equipo: "",
    origen: "Diseño" as string,
    desviacion_id: "",
    control_cambios_id: "",
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_cierre: "",
    alcance: "",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleGuardar = async () => {
    if (!form.proceso_equipo.trim()) {
      toast({ title: "Campo requerido", description: "El Proceso / Equipo es obligatorio.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: codigoData, error: cErr } = await supabase.rpc("next_folio_code");
      if (cErr) throw cErr;

      const { data: folio, error: fErr } = await supabase
        .from("folios")
        .insert({
          codigo: codigoData as string,
          proceso_equipo: form.proceso_equipo.trim(),
          origen: form.origen as any,
          desviacion_id: form.desviacion_id.trim(),
          control_cambios_id: form.control_cambios_id.trim(),
          fecha_inicio: form.fecha_inicio,
          fecha_cierre: form.fecha_cierre || null,
          alcance: form.alcance.trim(),
          created_by: user?.id,
          estado: "Borrador",
        })
        .select()
        .single();

      if (fErr) throw fErr;

      toast({ title: `✅ Folio ${codigoData} creado` });
      queryClient.invalidateQueries({ queryKey: ["folios"] });
      onClose();
      navigate(`/folios/${folio.id}`);
    } catch (err: any) {
      toast({ title: "Error al crear folio", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm({
      proceso_equipo: "",
      origen: "Diseño",
      desviacion_id: "",
      control_cambios_id: "",
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_cierre: "",
      alcance: "",
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Folio de Gestión de Riesgos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            El código se genera automáticamente (GR-{new Date().getFullYear()}-XXX)
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Proceso / Equipo Analizado *</Label>
            <Input
              value={form.proceso_equipo}
              onChange={(e) => update("proceso_equipo", e.target.value)}
              placeholder="Ej: Calificación de Áreas o Instalaciones"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Origen del Riesgo *</Label>
            <Select value={form.origen} onValueChange={(v) => update("origen", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Constants.public.Enums.origen_riesgo.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha Inicio</Label>
              <Input type="date" value={form.fecha_inicio} onChange={(e) => update("fecha_inicio", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha Cierre Estimada</Label>
              <Input type="date" value={form.fecha_cierre} onChange={(e) => update("fecha_cierre", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">ID Desviación (opcional)</Label>
              <Input
                value={form.desviacion_id}
                onChange={(e) => update("desviacion_id", e.target.value)}
                placeholder="DES-2026-XXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Control de Cambios (opcional)</Label>
              <Input
                value={form.control_cambios_id}
                onChange={(e) => update("control_cambios_id", e.target.value)}
                placeholder="CC-2026-XXX"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Alcance</Label>
            <Textarea
              value={form.alcance}
              onChange={(e) => update("alcance", e.target.value)}
              rows={3}
              placeholder="Describe el alcance del análisis de riesgos..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={saving}>
            {saving ? "Creando..." : "Crear Folio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function Folios() {
  const navigate = useNavigate();
  const [nuevoOpen, setNuevoOpen] = useState(false);
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
          <Button className="gap-2" onClick={() => setNuevoOpen(true)}>
            <Plus className="h-4 w-4" /> Nuevo Folio
          </Button>
        </div>
      </div>

      <NuevoFolioDialog open={nuevoOpen} onClose={() => setNuevoOpen(false)} />

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
