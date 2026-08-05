import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, ChevronRight, FileDown, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchOrgLogoDataUrl } from "@/lib/orgLogo";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFolios, useAllRiesgos, getEstadoStyle, getNPRLevel } from "@/hooks/useFolios";
import { OrigenAnalisisSelect } from "@/components/OrigenAnalisisSelect";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getMotivoLabel } from "@/config/motivos-cancelacion";
import { getTipoLabel } from "@/config/tipos-folio";
import { useOrgTiposFolio } from "@/hooks/useOrgTiposFolio";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Exportar a CSV (abre en Excel sin instalar librerías extra) ───────────────
function exportarCSV(folios: any[], riesgosMap: Map<string, any[]>) {
  const filas: string[][] = [];

  filas.push([
    "Folio",
    "Tipo",
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
      getTipoLabel(f.tipo_folio),
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
async function exportarPDF(
  folios: any[],
  riesgosMap: Map<string, any[]>,
  org?: {
    nombre?: string | null;
    logo_url?: string | null;
    codigo_formato?: string | null;
    version_formato?: string | null;
  } | null,
) {
  // A4 landscape — 297mm × 210mm — más espacio que letter para 13 columnas
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;

  // Cargar logo de la organización (si existe)
  const orgLogo = await fetchOrgLogoDataUrl(org?.logo_url);
  const orgNombre = (org?.nombre || "").trim();
  const orgNombreUpper = (orgNombre || "ORGANIZACIÓN").toUpperCase();
  const codigoFormato = (org?.codigo_formato || "").trim();
  const versionFormato = (org?.version_formato || "").trim();
  const codigoLabel = codigoFormato
    ? versionFormato
      ? `${codigoFormato} (${versionFormato})`
      : codigoFormato
    : "";

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
    if (orgLogo) {
      doc.addImage(orgLogo.dataUrl, orgLogo.format, margin + 1, 5.5, 24, 13);
    } else {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 31, 61);
      doc.text(orgNombreUpper.slice(0, 18), margin + 1.5, 12);
      doc.setTextColor(0);
    }

    // Título central
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(orgNombreUpper, pageW / 2, 10, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text("FORMATO — DEPARTAMENTO: SISTEMA DE GESTIÓN DE CALIDAD", pageW / 2, 15, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("LISTADO DE FOLIOS — SISTEMA DE GESTIÓN DE RIESGOS", pageW / 2, 20, { align: "center" });

    // Código y página (derecha)
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    if (codigoLabel) {
      doc.text(codigoLabel, pageW - margin - 16, 11, { align: "center" });
      doc.text(`Página ${pageIndex} de ${totalPages}`, pageW - margin - 16, 17, { align: "center" });
    } else {
      doc.text(`Página ${pageIndex} de ${totalPages}`, pageW - margin - 16, 14, { align: "center" });
    }
  }

  function addFooter() {
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(80);
    doc.text(
      `Documento confidencial propiedad de ${orgNombre || "la organización"}  |  Generado: ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}`,
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
      getTipoLabel(f.tipo_folio),
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
        "Tipo",
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
      1: { cellWidth: 14, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 46 },
      3: { cellWidth: 20 },
      4: { cellWidth: 16 },
      5: { cellWidth: 18 },
      6: { cellWidth: 18 },
      7: { cellWidth: 18 },
      8: { cellWidth: 14, halign: "center" },
      9: { cellWidth: 14, halign: "center" },
      10: { cellWidth: 20, halign: "center" },
      11: { cellWidth: 18, halign: "center" },
      12: { cellWidth: 18, halign: "center" },
      13: { cellWidth: 18, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.section === "body") {
        const e = data.cell.raw as string;
        if (e === "Aprobado") data.cell.styles.textColor = [15, 110, 86];
        if (e === "Borrador") data.cell.styles.textColor = [100, 100, 100];
        if (e === "En Firma") data.cell.styles.textColor = [30, 100, 200];
        if (e === "Rechazado") data.cell.styles.textColor = [180, 0, 0];
      }
      if (data.column.index === 9 && data.section === "body") {
        if (parseInt(data.cell.raw as string) > 0) data.cell.styles.textColor = [180, 0, 0];
      }
      if ([11, 12, 13].includes(data.column.index) && data.section === "body") {
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
  const { user, org } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    tipo: "",
    proceso_equipo: "",
    origen: "Diseño y Desarrollo" as string,
    desviacion_id: "",
    control_cambios_id: "",
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_cierre: "",
    alcance: "",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const { data: tiposDisponibles = [] } = useOrgTiposFolio(true);

  const handleGuardar = async () => {
    if (!form.tipo) {
      toast({ title: "Tipo requerido", description: "Selecciona el tipo de análisis.", variant: "destructive" });
      return;
    }
    if (!form.proceso_equipo.trim()) {
      toast({ title: "Campo requerido", description: "El Proceso / Equipo es obligatorio.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: codigoData, error: cErr } = await supabase.rpc(
        "next_folio_code" as any,
        { p_tipo: form.tipo },
      );
      if (cErr) throw cErr;

      const { data: folio, error: fErr } = await supabase
        .from("folios")
        .insert({
          codigo: codigoData as string,
          tipo_folio: form.tipo,
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
      tipo: "",
      proceso_equipo: "",
      origen: "Diseño y Desarrollo",
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
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de análisis *</Label>
            <Select value={form.tipo} onValueChange={(v) => update("tipo", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo de análisis" />
              </SelectTrigger>
              <SelectContent>
                {tiposDisponibles.map((t) => (
                  <SelectItem key={t.codigo} value={t.codigo}>
                    {t.codigo} — {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {form.tipo
                ? `Tu folio será: ${previewCodigo(
                    (org as any)?.folio_prefijo ?? "GR",
                    form.tipo,
                    ((org as any)?.folio_formato_periodo ?? "anio_completo") as any,
                    (org as any)?.folio_digitos_consecutivo ?? 3,
                  ).replace(/\d+$/, "XXX")} (el número se asigna al guardar)`
                : "El código se genera automáticamente al guardar."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Proceso / Producto / Equipo / Sistema Analizado *</Label>
            <Input
              value={form.proceso_equipo}
              onChange={(e) => update("proceso_equipo", e.target.value)}
              placeholder="Ej: Calificación de Áreas o Instalaciones"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Origen del Riesgo *</Label>
            <OrigenAnalisisSelect
              norma={(org as any)?.norma_aplicable}
              value={form.origen}
              onChange={(v) => update("origen", v)}
            />
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
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [mostrarCancelados, setMostrarCancelados] = useState(false);
  const { data: folios, isLoading } = useFolios();
  const { data: allRiesgos, isLoading: loadingRiesgos } = useAllRiesgos();

  // Auto-abrir diálogo de nuevo folio si viene ?wizard=1 (desde onboarding)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("wizard") === "1") {
      setNuevoOpen(true);
      // Limpiar query param sin recargar
      const url = new URL(window.location.href);
      url.searchParams.delete("wizard");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Agrupar riesgos por folio_id para acceso rápido
  const riesgosMap = new Map<string, any[]>();
  (allRiesgos || []).forEach((r) => {
    if (!riesgosMap.has(r.folio_id)) riesgosMap.set(r.folio_id, []);
    riesgosMap.get(r.folio_id)!.push(r);
  });

  const cargando = isLoading || loadingRiesgos;
  const todosRaw = folios || [];
  const totalCancelados = todosRaw.filter((f) => f.estado === "Cancelado").length;
  const todos = mostrarCancelados
    ? todosRaw
    : todosRaw.filter((f) => f.estado !== "Cancelado");

  const { org, hasRole, isSuperAdmin } = useAuth();
  const puedeVerCancelados =
    hasRole("admin") || hasRole("responsable_sanitario") || isSuperAdmin();
  const tiposDisponibles = getTiposDisponibles((org as any)?.norma_aplicable);

  const lista =
    tipoFiltro === "todos"
      ? todos
      : tipoFiltro === "_historico"
        ? todos.filter((f) => !f.tipo_folio)
        : todos.filter((f) => f.tipo_folio === tipoFiltro);

  const hayHistorico = todos.some((f) => !f.tipo_folio);

  const handleExportCSV = () => exportarCSV(lista, riesgosMap);
  const handleExportPDF = () => exportarPDF(lista, riesgosMap, org);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Folios</h1>
          <p className="text-sm text-muted-foreground">Archivos Maestros de Gestión de Riesgos</p>
        </div>
        <div className="flex items-center gap-2">
          {totalCancelados > 0 && puedeVerCancelados && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => navigate("/admin/folios-cancelados")}
              title="Ver panel completo de folios cancelados"
            >
              Panel de cancelados →
            </Button>
          )}
          {totalCancelados > 0 && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
              <Switch
                checked={mostrarCancelados}
                onCheckedChange={setMostrarCancelados}
              />
              Mostrar cancelados ({totalCancelados})
            </label>
          )}
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

      {/* Filtros por tipo */}
      {!cargando && todos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTipoFiltro("todos")}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              tipoFiltro === "todos"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            Todos ({todos.length})
          </button>
          {tiposDisponibles.map((t) => {
            const count = todos.filter((f) => f.tipo_folio === t.key).length;
            return (
              <button
                key={t.key}
                onClick={() => setTipoFiltro(t.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  tipoFiltro === t.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
                title={t.descripcion}
              >
                {t.short} ({count})
              </button>
            );
          })}
          {hayHistorico && (
            <button
              onClick={() => setTipoFiltro("_historico")}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                tipoFiltro === "_historico"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
              title="Folios creados antes de la codificación por tipo"
            >
              Sin tipo ({todos.filter((f) => !f.tipo_folio).length})
            </button>
          )}
        </div>
      )}

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
          const esCancelado = folio.estado === "Cancelado";

          return (
            <Card
              key={folio.id}
              className={`hover:shadow-md transition-shadow cursor-pointer ${
                esCancelado ? "opacity-70 border-dashed" : ""
              }`}
              onClick={() => navigate(`/folios/${folio.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="font-mono text-sm font-bold text-primary whitespace-nowrap">{folio.codigo}</div>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono"
                      title={folio.tipo_folio ? undefined : "Folio histórico (anterior a la codificación por tipo)"}
                    >
                      {getTipoLabel(folio.tipo_folio)}
                    </Badge>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{folio.proceso_equipo}</p>
                      <p className="text-xs text-muted-foreground">
                        Origen: {folio.origen} · Inicio: {folio.fecha_inicio}
                      </p>
                      {esCancelado && (
                        <p className="text-[11px] text-destructive mt-0.5 truncate">
                          Cancelado: {getMotivoLabel((folio as any).motivo_cancelacion_codigo)}
                          {(folio as any).motivo_cancelacion ? ` — ${(folio as any).motivo_cancelacion}` : ""}
                          {(folio as any).cancelado_en
                            ? ` · ${new Date((folio as any).cancelado_en).toLocaleDateString("es-MX")}`
                            : ""}
                        </p>
                      )}
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
