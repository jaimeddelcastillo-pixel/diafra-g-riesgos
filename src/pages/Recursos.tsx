import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, LayoutTemplate, Bot, Sparkles, Upload, Download, Trash2,
  FileText, Eye, Inbox, RotateCcw, Shield, History, Copy, CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

type DocTipo =
  | "PNO"
  | "Formato interno"
  | "Política de calidad"
  | "Manual de calidad"
  | "Instrucción de trabajo"
  | "Otro";

interface OrgDocumento {
  id: string;
  org_id: string;
  nombre: string;
  tipo: string;
  version: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  usar_en_ia: boolean;
  creado_por: string | null;
  created_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  sha256?: string | null;
  version_num?: number;
  parent_doc_id?: string | null;
  es_version_actual?: boolean;
}

interface ReferenciaDoc {
  id: "pno" | "formato" | "guia";
  icon: typeof ClipboardList;
  iconClass: string;
  titulo: string;
  descripcion: string;
  badgeText: string;
  badgeClass: string;
  storagePath: string;
  buttonLabel: string;
  preview: { titulo: string; cuerpo: string[] };
}

const REFERENCIAS: ReferenciaDoc[] = [
  {
    id: "pno",
    icon: ClipboardList,
    iconClass: "text-[hsl(var(--primary))]",
    titulo: "PNO-AMGR-01 Gestión de Riesgos",
    descripcion:
      "Procedimiento Normalizado de Operación bajo NOM-241 / ISO 14971. Úsalo como guía para crear o actualizar el PNO de tu organización.",
    badgeText: "Documento de referencia",
    badgeClass: "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30",
    storagePath: "PNO-AMGR-01.pdf",
    buttonLabel: "Descargar PDF",
    preview: {
      titulo: "PNO-AMGR-01 — Gestión de Riesgos",
      cuerpo: [
        "Procedimiento alineado a NOM-241-SSA1-2025 e ISO 14971:2019.",
        "Define alcance, responsabilidades y criterios de aceptabilidad.",
        "Incluye flujo de identificación, evaluación, control y verificación de riesgos.",
        "Sirve como base editable para tu propio PNO interno.",
      ],
    },
  },
  {
    id: "formato",
    icon: LayoutTemplate,
    iconClass: "text-emerald-500",
    titulo: "Formato Archivo Maestro de Riesgos",
    descripcion:
      "Plantilla oficial TRACEA para análisis AMEF. Compatible con el sistema de firmas electrónicas y checklist NOM-241 de la plataforma.",
    badgeText: "Formato oficial",
    badgeClass: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
    storagePath: "formato-amgr.pdf",
    buttonLabel: "Descargar PDF",
    preview: {
      titulo: "Formato Archivo Maestro de Gestión de Riesgos",
      cuerpo: [
        "Plantilla AMEF con secciones I a VII.",
        "Compatible con la matriz NPR (Severidad × Ocurrencia × Detectabilidad).",
        "Incluye sección de Comité Técnico y Dictamen del Responsable Sanitario.",
        "Pensada para diligenciar antes de cargarla al sistema o adaptar a tu proceso.",
      ],
    },
  },
  {
    id: "guia",
    icon: Bot,
    iconClass: "text-[#8587E8]",
    titulo: "Guía: Agente IA TRACEA Risk Manager",
    descripcion:
      "Configura tu asistente de IA en Gemini, ChatGPT o Claude. Incluye el System Prompt listo para usar con el protocolo NOM-241.",
    badgeText: "Bonus exclusivo",
    badgeClass: "bg-[#8587E8]/15 text-[#8587E8] border-[#8587E8]/30",
    storagePath: "guia-agente-ia.pdf",
    buttonLabel: "Descargar PDF",
    preview: {
      titulo: "Guía del Agente IA TRACEA Risk Manager",
      cuerpo: [
        "Paso a paso para configurar el agente en Gemini, ChatGPT o Claude.",
        "Incluye System Prompt completo alineado a NOM-241 e ISO 14971.",
        "Recomendaciones para alimentar el agente con tus documentos internos.",
        "Buenas prácticas para validación y uso responsable de IA.",
      ],
    },
  },
];

const TIPOS_DOC: DocTipo[] = [
  "PNO",
  "Formato interno",
  "Política de calidad",
  "Manual de calidad",
  "Instrucción de trabajo",
  "Otro",
];

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

/** Calcula el hash SHA-256 de un archivo en hex (64 chars). */
async function sha256OfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Días restantes hasta la purga automática (30 días desde el borrado). */
function diasParaPurga(deletedAt: string): number {
  const ms = new Date(deletedAt).getTime() + 30 * 86400000 - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export default function Recursos() {
  const { org, user, hasRole } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<OrgDocumento[]>([]);
  const [docsPapelera, setDocsPapelera] = useState<OrgDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ReferenciaDoc | null>(null);
  const [verPapelera, setVerPapelera] = useState(false);

  // Form upload state
  const [file, setFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<DocTipo>("PNO");
  const [version, setVersion] = useState("1.0");
  const [usarEnIa, setUsarEnIa] = useState(true);
  const [uploading, setUploading] = useState(false);
  /** Si está definido, la subida se hace como nueva versión del documento padre. */
  const [parentDocId, setParentDocId] = useState<string | null>(null);

  const puedeEliminar = hasRole("admin");

  const cargarDocs = async () => {
    if (!org?.id) return;
    setLoading(true);
    // Activos: cast a any para evitar inferencia profunda en filtros sobre columnas
    // recientemente agregadas (deleted_at, es_version_actual).
    const sb = supabase as any;
    const { data: activos, error: errA } = await sb
      .from("org_documentos")
      .select("*")
      .eq("org_id", org.id)
      .is("deleted_at", null)
      .eq("es_version_actual", true)
      .order("created_at", { ascending: false });
    if (errA) {
      toast({ title: "Error", description: errA.message, variant: "destructive" });
    } else {
      setDocs((activos ?? []) as OrgDocumento[]);
    }
    // Papelera (solo admins por RLS)
    if (puedeEliminar) {
      const { data: trash } = await sb
        .from("org_documentos")
        .select("*")
        .eq("org_id", org.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      setDocsPapelera((trash ?? []) as OrgDocumento[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    cargarDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id, puedeEliminar]);

  const handleDescargarReferencia = async (ref: ReferenciaDoc) => {
    const { data, error } = await supabase.storage
      .from("tracea-recursos")
      .createSignedUrl(ref.storagePath, 60);
    if (error || !data) {
      // Fallback a URL pública
      const { data: pub } = supabase.storage.from("tracea-recursos").getPublicUrl(ref.storagePath);
      if (pub?.publicUrl) {
        window.open(pub.publicUrl, "_blank");
        return;
      }
      toast({
        title: "Documento no disponible",
        description: "Este recurso aún no ha sido cargado por el equipo TRACEA.",
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleUpload = async () => {
    if (!file || !org?.id || !user) return;
    if (!nombre.trim()) {
      toast({ title: "Falta el nombre del documento", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "docx"].includes(ext)) {
      toast({ title: "Solo se aceptan archivos PDF o DOCX", variant: "destructive" });
      return;
    }

    setUploading(true);
    const safeName = nombre.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${org.id}/${Date.now()}-${safeName}.${ext}`;

    // Hash SHA-256 para garantía de integridad ISO 14971 / COFEPRIS
    let hash: string | null = null;
    try {
      hash = await sha256OfFile(file);
    } catch {
      // Si el navegador no soporta WebCrypto seguimos sin hash
      hash = null;
    }

    const { error: upErr } = await supabase.storage
      .from("org-documentos")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (upErr) {
      setUploading(false);
      toast({ title: "Error subiendo archivo", description: upErr.message, variant: "destructive" });
      return;
    }

    const { error: dbErr } = await supabase.from("org_documentos").insert({
      org_id: org.id,
      nombre: nombre.trim(),
      tipo,
      version: version.trim() || "1.0",
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      usar_en_ia: usarEnIa,
      creado_por: user.id,
      sha256: hash,
      parent_doc_id: parentDocId,
    } as any);

    setUploading(false);

    if (dbErr) {
      toast({ title: "Error registrando documento", description: dbErr.message, variant: "destructive" });
      // limpiar archivo huérfano
      await supabase.storage.from("org-documentos").remove([path]);
      return;
    }

    toast({
      title: parentDocId ? "Nueva versión registrada" : "Documento subido",
      description: hash
        ? `${nombre.trim()} · SHA-256: ${hash.slice(0, 12)}…`
        : nombre.trim(),
    });
    setUploadOpen(false);
    setFile(null);
    setNombre("");
    setTipo("PNO");
    setVersion("1.0");
    setUsarEnIa(true);
    setParentDocId(null);
    cargarDocs();
  };

  const handleDescargarDoc = async (doc: OrgDocumento) => {
    const { data, error } = await supabase.storage
      .from("org-documentos")
      .createSignedUrl(doc.storage_path, 120);
    if (error || !data) {
      toast({ title: "No se pudo generar enlace", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  /** Soft delete: marca el documento como eliminado. Se purga automáticamente a los 30 días. */
  const handleEliminarDoc = async (doc: OrgDocumento) => {
    const { error } = await supabase
      .from("org_documentos")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id ?? null,
      } as any)
      .eq("id", doc.id);
    if (error) {
      toast({ title: "Error eliminando documento", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Documento enviado a la papelera",
      description: "Permanecerá 30 días recuperable antes del borrado definitivo.",
    });
    cargarDocs();
  };

  /** Restaura un documento desde la papelera. */
  const handleRestaurarDoc = async (doc: OrgDocumento) => {
    const { error } = await supabase.rpc("restaurar_documento" as any, { p_doc_id: doc.id });
    if (error) {
      toast({ title: "Error restaurando", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Documento restaurado", description: doc.nombre });
    cargarDocs();
  };

  /**
   * Eliminación permanente: ejecuta la RPC SECURITY DEFINER que valida permisos,
   * borra el registro y devuelve el storage_path para limpiar el bucket.
   */
  const handleEliminarPermanente = async (doc: OrgDocumento) => {
    const { data: path, error } = await supabase.rpc(
      "eliminar_documento_permanente" as any,
      { p_doc_id: doc.id },
    );
    if (error) {
      toast({
        title: "Error eliminando definitivamente",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    if (path && typeof path === "string") {
      await supabase.storage.from("org-documentos").remove([path]);
    }
    toast({
      title: "Documento eliminado permanentemente",
      description: `${doc.nombre} fue borrado del sistema.`,
    });
    cargarDocs();
  };

  /** Abre el dialog en modo "subir nueva versión" pre-rellenando datos. */
  const subirNuevaVersion = (doc: OrgDocumento) => {
    setParentDocId(doc.parent_doc_id || doc.id);
    setNombre(doc.nombre);
    setTipo(doc.tipo as DocTipo);
    const [maj, min] = (doc.version || "1.0").split(".");
    const nextMin = (parseInt(min || "0", 10) + 1).toString();
    setVersion(`${maj || "1"}.${nextMin}`);
    setUsarEnIa(doc.usar_en_ia);
    setFile(null);
    setUploadOpen(true);
  };

  const scrollToGuia = () => {
    const el = document.getElementById("ref-guia");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-8">
      <TooltipProvider>
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Centro de Recursos TRACEA</h1>
        <p className="text-muted-foreground mt-1">
          Documentos de referencia y archivos de tu organización
        </p>
      </div>

      {/* SECCIÓN 1 — Documentos TRACEA */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg md:text-xl font-semibold">Documentos TRACEA</h2>
          <Badge className="bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30 hover:bg-[hsl(var(--primary))]/15">
            Referencia oficial
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Usa estos documentos como base para adaptar los tuyos
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REFERENCIAS.map((ref) => {
            const Icon = ref.icon;
            return (
              <Card
                key={ref.id}
                id={`ref-${ref.id}`}
                className="hover:shadow-md transition-shadow flex flex-col"
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="rounded-lg bg-muted p-2.5">
                      <Icon className={`h-6 w-6 ${ref.iconClass}`} />
                    </div>
                    <Badge variant="outline" className={ref.badgeClass}>
                      {ref.badgeText}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">{ref.titulo}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {ref.descripcion}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0 flex flex-col gap-2">
                  <Button onClick={() => handleDescargarReferencia(ref)} className="w-full">
                    <Download className="h-4 w-4" />
                    {ref.buttonLabel}
                  </Button>
                  <Button variant="outline" onClick={() => setPreviewDoc(ref)} className="w-full">
                    <Eye className="h-4 w-4" />
                    Vista previa
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* SECCIÓN 2 — Mis Documentos */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg md:text-xl font-semibold">Mis Documentos</h2>
            {org?.nombre && (
              <Badge variant="secondary" className="font-normal">
                {org.nombre}
              </Badge>
            )}
            {puedeEliminar && docsPapelera.length > 0 && (
              <Button
                size="sm"
                variant={verPapelera ? "default" : "outline"}
                onClick={() => setVerPapelera((v) => !v)}
                className="gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Papelera ({docsPapelera.length})
              </Button>
            )}
          </div>
          <Dialog open={uploadOpen} onOpenChange={(o) => {
            setUploadOpen(o);
            if (!o) setParentDocId(null);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4" />
                Subir documento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {parentDocId ? "Subir nueva versión" : "Subir documento"}
                </DialogTitle>
                <DialogDescription>
                  {parentDocId
                    ? "La versión anterior se conservará en el historial. Se calculará un hash SHA-256 para auditoría."
                    : "Acepta archivos PDF y DOCX. Se calcula un hash SHA-256 para garantizar integridad."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">Archivo</Label>
                  <label
                    htmlFor="file"
                    className="mt-1 flex flex-col items-center justify-center rounded-md border border-dashed border-input p-6 cursor-pointer hover:bg-muted/50 transition-colors text-center"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium">
                      {file ? file.name : "Arrastra o selecciona un archivo"}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">PDF o DOCX</span>
                    <input
                      id="file"
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                <div>
                  <Label htmlFor="nombre">Nombre del documento</Label>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. PNO Gestión de Riesgos"
                  />
                </div>
                <div>
                  <Label htmlFor="tipo">Tipo de documento</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as DocTipo)}>
                    <SelectTrigger id="tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_DOC.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="version">Versión</Label>
                  <Input
                    id="version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="ia"
                    checked={usarEnIa}
                    onCheckedChange={(c) => setUsarEnIa(c === true)}
                  />
                  <Label htmlFor="ia" className="text-sm leading-snug cursor-pointer">
                    Usar como contexto para el Asistente IA
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
                  Cancelar
                </Button>
                <Button onClick={handleUpload} disabled={uploading || !file}>
                  {uploading ? "Subiendo..." : "Subir documento"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-sm text-muted-foreground">
          Sube los documentos propios de tu organización. Se garantiza la integridad de cada archivo
          con un hash SHA-256, las versiones anteriores se conservan en el historial, y los documentos
          eliminados permanecen 30 días en la papelera antes de su borrado definitivo.
        </p>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Cargando...</div>
            ) : verPapelera && puedeEliminar ? (
              docsPapelera.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  La papelera está vacía.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="hidden md:table-cell">Eliminado</TableHead>
                      <TableHead>Días restantes</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docsPapelera.map((doc) => {
                      const dias = diasParaPurga(doc.deleted_at!);
                      return (
                        <TableRow key={doc.id} className="opacity-75">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <div className="truncate">{doc.nombre}</div>
                                <div className="text-xs text-muted-foreground">
                                  {doc.tipo} · v{doc.version}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {formatDate(doc.deleted_at!)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                dias <= 5
                                  ? "border-destructive/40 text-destructive"
                                  : "border-warning/40"
                              }
                            >
                              {dias} días
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestaurarDoc(doc)}
                              className="gap-1"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restaurar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground max-w-sm">
                  Tu organización aún no ha subido documentos. Comienza subiendo tu PNO.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">Fecha</TableHead>
                    <TableHead>Versión</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="truncate">{doc.nombre}</div>
                            <div className="text-xs text-muted-foreground md:hidden">
                              {doc.tipo} · {formatDate(doc.created_at)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatBytes(doc.size_bytes)}
                              {doc.usar_en_ia && (
                                <span className="ml-2 text-[hsl(var(--primary))]">· IA</span>
                              )}
                              {doc.sha256 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="ml-2 inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                      <Shield className="h-3 w-3" /> SHA-256
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-xs font-mono break-all">{doc.sha256}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      Huella inmutable de integridad (ISO 14971).
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">{doc.tipo}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatDate(doc.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        v{doc.version}
                        {(doc.version_num ?? 1) > 1 && (
                          <Badge variant="outline" className="ml-1.5 text-[10px]">
                            rev {doc.version_num}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDescargarDoc(doc)}
                            title="Descargar"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {puedeEliminar && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => subirNuevaVersion(doc)}
                              title="Subir nueva versión"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          )}
                          {puedeEliminar && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  title="Enviar a papelera"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Enviar a la papelera?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    "{doc.nombre}" se enviará a la papelera y permanecerá recuperable
                                    durante <strong>30 días</strong> antes de su borrado definitivo.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleEliminarDoc(doc)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Enviar a papelera
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* SECCIÓN 3 — Banner Agente IA */}
      <section>
        <div
          className="rounded-lg p-6 md:p-8 text-white"
          style={{ backgroundColor: "#042C53" }}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
            <div className="rounded-full bg-white/10 p-3 shrink-0">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg md:text-xl font-semibold">
                ¿Listo para configurar tu Agente IA?
              </h3>
              <p className="text-sm md:text-base text-white/80 mt-1">
                Con tus documentos subidos, tu asistente conocerá exactamente tus criterios de
                aceptabilidad, tu escala NPR y tus responsables. Análisis más precisos desde el
                primer día.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={scrollToGuia}
              className="bg-white text-[#042C53] hover:bg-white/90 shrink-0"
            >
              Ver Guía del Agente IA
            </Button>
          </div>
        </div>
      </section>

      {/* Modal Vista previa */}
      <Dialog open={previewDoc !== null} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewDoc?.preview.titulo}</DialogTitle>
            <DialogDescription>Resumen del contenido del documento</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {previewDoc?.preview.cuerpo.map((linea, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[hsl(var(--primary))] mt-1">•</span>
                <span>{linea}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            {previewDoc && (
              <Button onClick={() => { handleDescargarReferencia(previewDoc); setPreviewDoc(null); }}>
                <Download className="h-4 w-4" />
                {previewDoc.buttonLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </TooltipProvider>
    </div>
  );
}
