import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBrainAreas, useBrainDocuments, useBrainProcesses } from "@/hooks/useBrain";
import { MapeoColumnasTable } from "./MapeoColumnasTable";
import { PreviewImportacion, type PropuestaUI } from "./PreviewImportacion";
import { parseArchivo } from "@/lib/listado-maestro/parse-archivo";
import { aplicarMapeo, areasDetectadas, mapeoValido, procesosCandidatos, proponerMapeo } from "@/lib/listado-maestro/mapeo";
import { clasificarRegistros, resumenClasificacion } from "@/lib/listado-maestro/duplicados";
import { normalizar } from "@/lib/listado-maestro/parse";
import type { FormatoImport, MapeoColumna, ParseFail, TablaCruda } from "@/lib/listado-maestro/tipos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ImportarListadoDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { orgId } = useAuth();
  const { data: docs = [] } = useBrainDocuments();
  const { data: areasExistentes = [] } = useBrainAreas();
  const { data: procesosExistentes = [] } = useBrainProcesses();

  const [paso, setPaso] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [formato, setFormato] = useState<FormatoImport | null>(null);
  const [tabla, setTabla] = useState<TablaCruda | null>(null);
  const [mapeo, setMapeo] = useState<MapeoColumna[]>([]);
  const [fallo, setFallo] = useState<ParseFail | null>(null);
  const [areas, setAreas] = useState<PropuestaUI[]>([]);
  const [procesos, setProcesos] = useState<PropuestaUI[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [revisado, setRevisado] = useState(false);

  const reset = () => {
    setPaso(1); setFile(null); setFormato(null); setTabla(null);
    setMapeo([]); setFallo(null); setAreas([]); setProcesos([]); setRevisado(false);
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  const registros = useMemo(() => {
    if (!tabla || !mapeoValido(mapeo)) return [];
    return clasificarRegistros(
      aplicarMapeo(tabla, mapeo),
      (docs as any[]).map((d) => ({ id: d.id, nombre: d.nombre, codigo: d.codigo, revision: d.revision })),
    );
  }, [tabla, mapeo, docs]);

  const resumen = useMemo(() => resumenClasificacion(registros), [registros]);

  const elegirArchivo = async (f: File) => {
    setFile(f); setFallo(null); setTabla(null); setProcesando(true);
    const res = await parseArchivo(f);
    setProcesando(false);
    if (!res.ok) { setFallo(res as ParseFail); setPaso(2); return; }
    setFormato(res.formato);
    setTabla(res.tabla);
    setMapeo(proponerMapeo(res.tabla));
    setPaso(2);
  };

  const irAPreview = () => {
    if (!tabla) return;
    const regs = aplicarMapeo(tabla, mapeo);
    const existentesArea = new Set((areasExistentes as any[]).map((a) => normalizar(a.nombre)));
    setAreas(
      areasDetectadas(regs).map((n) => ({
        nombre: n,
        nivel_confianza: "explicito" as const,
        decision: existentesArea.has(normalizar(n)) ? ("vincular" as const) : ("crear" as const),
        vinculo_id: (areasExistentes as any[]).find((a) => normalizar(a.nombre) === normalizar(n))?.id,
      })),
    );
    setProcesos(
      procesosCandidatos(regs).map((p) => ({
        nombre: p.nombre,
        evidencia: p.evidencia,
        nivel_confianza: "inferido" as const,
        decision: "pendiente" as const,
      })),
    );
    setRevisado(true);
    setPaso(3);
  };

  const puedeConfirmar =
    !!tabla && !!file && !!formato && mapeoValido(mapeo) && registros.length > 0 && revisado && !procesando && !!orgId;

  const confirmar = async () => {
    if (!puedeConfirmar || !file || !formato) return;
    setProcesando(true);
    try {
      const mapeoPlano = Object.fromEntries(mapeo.filter((m) => m.campo).map((m) => [m.origen, m.campo!]));

      const { data: prep, error: prepErr } = await supabase.functions.invoke("brain-import-listado", {
        body: { accion: "preparar", org_id: orgId, nombre_archivo: file.name, formato, total_filas: registros.length, mapeo: mapeoPlano },
      });
      if (prepErr || !prep?.batch_id) throw new Error(prepErr?.message ?? "No se pudo iniciar la importación.");

      if (prep.upload?.token) {
        await supabase.storage.from("brain-imports")
          .uploadToSignedUrl(prep.storage_path, prep.upload.token, file);
      }

      const areasACrear = areas.filter((a) => a.decision === "crear").map((a) => ({ nombre: a.nombre }));
      const procesosACrear = procesos.filter((p) => p.decision === "crear").map((p) => ({ nombre: p.nombre, evidencia: p.evidencia }));
      const pendientes = [
        ...areas.filter((a) => a.decision === "pendiente").map((a) => ({ tipo: "area", nombre: a.nombre, evidencia: a.evidencia, nivel_confianza: a.nivel_confianza })),
        ...procesos.filter((p) => p.decision === "pendiente").map((p) => ({ tipo: "proceso", nombre: p.nombre, evidencia: p.evidencia, nivel_confianza: p.nivel_confianza })),
      ];

      const { data, error } = await supabase.functions.invoke("brain-import-listado", {
        body: {
          accion: "importar",
          org_id: orgId,
          batch_id: prep.batch_id,
          mapeo: mapeoPlano,
          registros: registros.filter((r) => r.clasificacion !== "posible_duplicado"),
          areas_a_crear: areasACrear,
          procesos_a_crear: procesosACrear,
          propuestas_pendientes: pendientes,
        },
      });
      if (error) throw new Error(error.message);

      qc.invalidateQueries({ queryKey: ["brain"] });
      toast.success(
        data?.estado === "parcial"
          ? `Importación parcial: ${data.importados} documentos importados, con errores registrados.`
          : `Importación completada: ${data?.importados ?? 0} documentos.`,
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message?.includes("sin_permiso")
        ? "No tienes permisos para importar el Listado Maestro."
        : "No se pudo completar la importación.");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Listado Maestro de Documentos</DialogTitle>
          <DialogDescription>
            También llamado Lista Maestra, Índice Maestro o Control Maestro de Documentos. Paso {paso} de 4.
          </DialogDescription>
        </DialogHeader>

        {paso === 1 && (
          <div className="space-y-3">
            <Label htmlFor="archivo">Archivo</Label>
            <Input
              id="archivo"
              type="file"
              accept=".xlsx,.csv,.txt,.md,.docx,.pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) elegirArchivo(f); }}
            />
            <p className="text-xs text-muted-foreground">
              Formatos aceptados: Excel (.xlsx), CSV, TXT, Markdown, Word (.docx) y PDF con texto seleccionable.
              Máximo 10 MB, 2,000 filas y 40 columnas por importación.
            </p>
            {procesando && <p className="text-sm text-muted-foreground">Procesando archivo…</p>}
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-3">
            {fallo ? (
              <div className="space-y-3">
                <p className="text-sm">{fallo.message}</p>
                {fallo.diagnostico && (
                  <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
                    {fallo.diagnostico}
                  </pre>
                )}
              </div>
            ) : tabla ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Revisa el mapeo propuesto. Solo el campo "Nombre del documento" es obligatorio.
                </p>
                <MapeoColumnasTable tabla={tabla} mapeo={mapeo} onChange={setMapeo} />
                {!mapeoValido(mapeo) && (
                  <p className="text-xs text-destructive">Asigna una columna al campo "Nombre del documento" para continuar.</p>
                )}
              </>
            ) : null}
          </div>
        )}

        {paso === 3 && (
          <PreviewImportacion
            registros={registros}
            areas={areas}
            procesos={procesos}
            areasExistentes={(areasExistentes as any[]).map((a) => ({ id: a.id, nombre: a.nombre }))}
            procesosExistentes={(procesosExistentes as any[]).map((p) => ({ id: p.id, nombre: p.nombre }))}
            onAreas={setAreas}
            onProcesos={setProcesos}
          />
        )}

        {paso === 4 && (
          <div className="space-y-2 text-sm">
            <p><strong>{resumen.nuevos}</strong> nuevos · <strong>{resumen.actualizaciones}</strong> posibles actualizaciones · <strong>{resumen.duplicados}</strong> duplicados (se omiten) · <strong>{resumen.revision}</strong> requieren revisión</p>
            <p className="text-muted-foreground">
              Áreas a crear: {areas.filter((a) => a.decision === "crear").length} ·
              Procesos a crear: {procesos.filter((p) => p.decision === "crear").length} ·
              Propuestas pendientes: {[...areas, ...procesos].filter((x) => x.decision === "pendiente").length}
            </p>
            <p className="text-xs text-muted-foreground">
              El Listado Maestro se registra como fuente documental. No genera conocimiento validado del Cerebro.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {paso > 1 && <Button variant="outline" onClick={() => setPaso(paso - 1)}>Atrás</Button>}
          {paso === 2 && !fallo && (
            <Button onClick={irAPreview} disabled={!tabla || !mapeoValido(mapeo)}>Continuar</Button>
          )}
          {paso === 3 && <Button onClick={() => setPaso(4)}>Continuar</Button>}
          {paso === 4 && (
            <Button onClick={confirmar} disabled={!puedeConfirmar || procesando}>
              {procesando ? "Importando…" : "Confirmar importación"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
