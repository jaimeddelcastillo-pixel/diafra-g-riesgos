import { useEffect, useState, useCallback } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Upload, Download, Trash2, CheckCircle2, AlertTriangle, ArrowLeft, FileText, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "tracea-recursos";

interface RecursoFijo {
  path: string;
  titulo: string;
  descripcion: string;
  norma: "NOM-241" | "NOM-059";
}

const RECURSOS_FIJOS: RecursoFijo[] = [
  {
    path: "PNO-AMGR-01.pdf",
    titulo: "PNO-AMGR-01 Gestión de Riesgos",
    descripcion: "Procedimiento Normalizado de Operación · NOM-241 / FEUM Dispositivos Médicos.",
    norma: "NOM-241",
  },
  {
    path: "formato-amgr.pdf",
    titulo: "Formato Archivo Maestro de Riesgos",
    descripcion: "Plantilla oficial TRACEA AMGR · NOM-241 / FEUM Dispositivos Médicos.",
    norma: "NOM-241",
  },
  {
    path: "PNO-AMGR-02.pdf",
    titulo: "PNO-AMGR-02 Gestión de Riesgos · Medicamentos",
    descripcion: "Procedimiento Normalizado de Operación · NOM-059 / FEUM Medicamentos.",
    norma: "NOM-059",
  },
  {
    path: "formato-amgr-med.pdf",
    titulo: "Formato AMGR · Medicamentos",
    descripcion: "Plantilla oficial TRACEA AMGR · NOM-059 / FEUM Medicamentos.",
    norma: "NOM-059",
  },
];

interface FileMeta {
  name: string;
  size: number | null;
  updated_at: string | null;
  exists: boolean;
}

const MAX_MB = 20;

function fmtSize(b: number | null) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminRecursos() {
  const { isSuperAdmin, loading } = useAuth();
  const [files, setFiles] = useState<Record<string, FileMeta>>({});
  const [extras, setExtras] = useState<FileMeta[]>([]);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [extraFile, setExtraFile] = useState<File | null>(null);
  const [extraName, setExtraName] = useState("");
  const [uploadingExtra, setUploadingExtra] = useState(false);

  const cargar = useCallback(async () => {
    setRefreshing(true);
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit: 1000,
      sortBy: { column: "updated_at", order: "desc" },
    });
    if (error) {
      toast.error("Error listando bucket: " + error.message);
      setRefreshing(false);
      return;
    }
    const map: Record<string, FileMeta> = {};
    const fixedPaths = new Set(RECURSOS_FIJOS.map((r) => r.path));
    const extrasArr: FileMeta[] = [];
    for (const item of data ?? []) {
      if (!item.name || item.name.endsWith("/")) continue;
      const meta: FileMeta = {
        name: item.name,
        size: (item.metadata as any)?.size ?? null,
        updated_at: item.updated_at ?? (item.metadata as any)?.lastModified ?? null,
        exists: true,
      };
      if (fixedPaths.has(item.name)) {
        map[item.name] = meta;
      } else {
        extrasArr.push(meta);
      }
    }
    for (const r of RECURSOS_FIJOS) {
      if (!map[r.path]) {
        map[r.path] = { name: r.path, size: null, updated_at: null, exists: false };
      }
    }
    setFiles(map);
    setExtras(extrasArr);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (isSuperAdmin && isSuperAdmin()) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargar]);

  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isSuperAdmin()) return <Navigate to="/" replace />;

  const validar = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "docx"].includes(ext)) {
      toast.error("Solo se aceptan archivos PDF o DOCX");
      return false;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Archivo supera ${MAX_MB} MB`);
      return false;
    }
    return true;
  };

  const reemplazar = async (path: string, file: File) => {
    if (!validar(file)) return;
    setBusyPath(path);
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/pdf",
      upsert: true,
      cacheControl: "0",
    });
    setBusyPath(null);
    if (error) {
      toast.error("Error subiendo: " + error.message);
      return;
    }
    toast.success("Documento actualizado");
    cargar();
  };

  const eliminar = async (path: string) => {
    setBusyPath(path);
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    setBusyPath(null);
    if (error) {
      toast.error("Error eliminando: " + error.message);
      return;
    }
    toast.success("Documento eliminado");
    cargar();
  };

  const descargar = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120);
    if (error || !data) {
      toast.error("No se pudo generar enlace");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const subirExtra = async () => {
    if (!extraFile) return;
    if (!validar(extraFile)) return;
    const baseName = (extraName.trim() || extraFile.name).replace(/[^a-zA-Z0-9._-]/g, "_");
    const finalName = /\.(pdf|docx)$/i.test(baseName)
      ? baseName
      : `${baseName}.${extraFile.name.split(".").pop()}`;
    if (RECURSOS_FIJOS.some((r) => r.path === finalName)) {
      toast.error("Ese nombre está reservado para un recurso oficial. Usa la sección de arriba.");
      return;
    }
    setUploadingExtra(true);
    const { error } = await supabase.storage.from(BUCKET).upload(finalName, extraFile, {
      contentType: extraFile.type || "application/pdf",
      upsert: true,
      cacheControl: "0",
    });
    setUploadingExtra(false);
    if (error) {
      toast.error("Error subiendo: " + error.message);
      return;
    }
    toast.success(`Subido: ${finalName}`);
    setExtraFile(null);
    setExtraName("");
    cargar();
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Panel</Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Recursos públicos TRACEA</h1>
          <p className="text-sm text-muted-foreground">
            Sube o reemplaza los PDF que verán todos los clientes en la sección Recursos. Bucket: <code className="text-xs">{BUCKET}</code>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={cargar} disabled={refreshing}>
          <RefreshCcw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Refrescar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recursos oficiales</CardTitle>
          <CardDescription>
            Estos cuatro archivos están enlazados desde la sección Recursos de cada organización. Reemplazarlos actualiza la versión que descargan todos los clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {RECURSOS_FIJOS.map((r) => {
            const meta = files[r.path];
            const exists = meta?.exists;
            const busy = busyPath === r.path;
            return (
              <div key={r.path} className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium truncate">{r.titulo}</span>
                    <Badge variant="outline" className="text-xs">{r.norma}</Badge>
                    {exists ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Cargado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Falta
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{r.descripcion}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <code className="text-[10px]">{r.path}</code> · {fmtSize(meta?.size ?? null)} · {fmtDate(meta?.updated_at ?? null)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button asChild variant="outline" size="sm" disabled={busy}>
                    <label className="cursor-pointer">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                      {exists ? "Reemplazar" : "Subir"}
                      <input
                        type="file"
                        accept=".pdf,.docx,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) reemplazar(r.path, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </Button>
                  {exists && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => descargar(r.path)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar {r.titulo}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Los clientes dejarán de poder descargar este recurso hasta que vuelvas a subirlo. ¿Continuar?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => eliminar(r.path)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Otros archivos del bucket</CardTitle>
          <CardDescription>
            Anexos, versiones adicionales o materiales complementarios. No se enlazan desde la UI de Recursos automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Archivo (PDF o DOCX, máx {MAX_MB} MB)</Label>
                <Input
                  type="file"
                  accept=".pdf,.docx,application/pdf"
                  onChange={(e) => setExtraFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <Label className="text-xs">Nombre del archivo (opcional)</Label>
                <Input
                  placeholder={extraFile?.name ?? "mi-anexo.pdf"}
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                />
              </div>
            </div>
            <Button size="sm" onClick={subirExtra} disabled={!extraFile || uploadingExtra}>
              {uploadingExtra ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Subir archivo
            </Button>
          </div>

          {extras.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hay archivos adicionales en el bucket.</p>
          ) : (
            <div className="space-y-2">
              {extras.map((f) => {
                const busy = busyPath === f.name;
                return (
                  <div key={f.name} className="border rounded-lg p-3 flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{fmtSize(f.size)} · {fmtDate(f.updated_at)}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => descargar(f.name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive" disabled={busy}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar {f.name}</AlertDialogTitle>
                          <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => eliminar(f.name)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}