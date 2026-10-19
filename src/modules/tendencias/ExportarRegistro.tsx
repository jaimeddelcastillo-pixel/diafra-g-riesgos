// Copia del popover «Exportar PDF» de modulo.$slug (atdiafra); el Excel de datos crudos va en la misma ventana.
import { useState } from "react";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { analizarRegistro, type Periodo } from "./lib/normativo";
import { exportarNormativoPDF } from "./lib/export-normativo";
import { exportarCrudo } from "./lib/export-crudo";
import { cargarConfiguracion } from "./lib/persistencia";
import type { Registro } from "./lib/semanas";

export default function ExportarRegistro({ registro }: { registro: Registro }) {
  const today = new Date().toISOString().slice(0, 10);
  const [exportDesde, setExportDesde] = useState(`${new Date().getFullYear()}-01-01`);
  const [exportHasta, setExportHasta] = useState(today);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "crudo" | null>(null);
  const valido = !!exportDesde && !!exportHasta && exportDesde <= exportHasta;

  const pdf = async () => {
    if (!valido) { toast.error("Rango de fechas inválido"); return; }
    setBusy("pdf");
    const t = toast.loading("Generando PDF normativo…");
    try {
      const periodo: Periodo = { tipo: "custom", desde: exportDesde, hasta: exportHasta };
      const config = await cargarConfiguracion("", null);
      exportarNormativoPDF([analizarRegistro(registro, periodo)], "registro",
        { areas: new Map(), hvac: new Map(), formato: config.formato, empresa: config.formato.identidad?.nombre, logo: config.formato.logo } as Parameters<typeof exportarNormativoPDF>[2],
        { incluirGraficas: true });
      toast.success("PDF generado", { id: t });
      setOpen(false);
    } catch (e) {
      toast.error("No se pudo exportar: " + (e instanceof Error ? e.message : String(e)), { id: t });
    } finally { setBusy(null); }
  };
  const crudo = async () => {
    if (!valido) { toast.error("Rango de fechas inválido"); return; }
    setBusy("crudo");
    try { await exportarCrudo(registro, exportDesde, exportHasta); toast.success("Excel de datos crudos descargado"); setOpen(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><FileText className="h-4 w-4" /> Exportar PDF</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div>
          <h4 className="text-sm font-semibold">PDF normativo</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Solo este registro, en el rango que elijas.</p>
        </div>
        <div className="space-y-2">
          <div>
            <label htmlFor="exp-desde" className="text-xs font-medium text-muted-foreground">Desde</label>
            <input id="exp-desde" type="date" value={exportDesde} max={exportHasta} onChange={(e) => setExportDesde(e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm h-9" />
          </div>
          <div>
            <label htmlFor="exp-hasta" className="text-xs font-medium text-muted-foreground">Hasta</label>
            <input id="exp-hasta" type="date" value={exportHasta} min={exportDesde} onChange={(e) => setExportHasta(e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm h-9" />
          </div>
        </div>
        <Button size="sm" onClick={() => void pdf()} disabled={!!busy || !valido} className="w-full gap-1">
          <FileText className="h-4 w-4" /> {busy === "pdf" ? "Generando…" : "Generar PDF"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => void crudo()} disabled={!!busy || !valido} className="w-full gap-1">
          <Download className="h-4 w-4" /> {busy === "crudo" ? "Exportando…" : "Excel de datos crudos"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
