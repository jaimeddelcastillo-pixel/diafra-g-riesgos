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
  ClipboardList, LayoutTemplate, Upload, Download, Trash2,
  FileText, Eye, Inbox, RotateCcw, Shield, History, Copy, CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsTrial, TRIAL_DOWNLOAD_TOOLTIP } from "@/lib/trialRestrictions";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { descargarArchivoStorage } from "@/lib/descargarArchivo";

interface OrgDocumento {
  id: string;
  org_id: string;
  nombre: string;
  tipo: string;
  tipo_clave?: string | null;
  clasificacion?: string | null;
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
  sha256_servidor?: string | null;
  version_num?: number;
  parent_doc_id?: string | null;
  es_version_actual?: boolean;
}

interface ReferenciaDoc {
  id: "pno" | "pno-med" | "formato" | "formato-med";
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

const REFERENCIAS_NOM241: ReferenciaDoc[] = [
  {
    id: "pno",
    icon: ClipboardList,
    iconClass: "text-[hsl(var(--primary))]",
    titulo: "PNO-AMGR-01 Gestión de Riesgos",
    descripcion:
      "Procedimiento Normalizado de Operación de Gestión de Riesgos NOM-241 y FEUM. Úsalo como guía para crear o actualizar el PNO de tu organización.",
    badgeText: "Documento de referencia",
    badgeClass: "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30",
    storagePath: "PNO-AMGR-01.pdf",
    buttonLabel: "Descargar PDF",
    preview: {
      titulo: "PNO-AMGR-01 — Gestión de Riesgos",
      cuerpo: [
        "Procedimiento alineado a la Gestión de Riesgos NOM-241 y FEUM.",
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
      "Plantilla oficial TRACEA para análisis de Gestión de Riesgos NOM-241 y FEUM. Compatible con el sistema de firmas electrónicas y checklist NOM-241-SSA1-2025 de la plataforma.",
    badgeText: "Formato oficial",
    badgeClass: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
    storagePath: "formato-amgr.pdf",
    buttonLabel: "Descargar PDF",
    preview: {
      titulo: "Formato Archivo Maestro de Gestión de Riesgos",
      cuerpo: [
        "Plantilla de Gestión de Riesgos NOM-241 y FEUM con secciones I a VII.",
        "Compatible con la matriz NPR (Severidad × Ocurrencia × Detectabilidad).",
        "Incluye sección de Comité Técnico y Dictamen del Responsable Sanitario.",
        "Pensada para diligenciar antes de cargarla al sistema o adaptar a tu proceso.",
      ],
    },
  },
];

const REFERENCIAS_NOM059: ReferenciaDoc[] = [
  {
    id: "pno-med",
    icon: ClipboardList,
    iconClass: "text-[hsl(var(--primary))]",
    titulo: "PNO-AMGR-02 Gestión de Riesgos_Medicamentos",
    descripcion:
      "Procedimiento Normalizado de Operación de Gestión de Riesgos de Calidad NOM-059 y FEUM. Úsalo como guía para crear o actualizar el PNO de gestión de riesgos de medicamentos de tu organización.",
    badgeText: "Documento de referencia",
    badgeClass: "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30",
    storagePath: "PNO-AMGR-02.pdf",
    buttonLabel: "Descargar PDF",
    preview: {
      titulo: "PNO-AMGR-02 — Gestión de Riesgos_Medicamentos",
      cuerpo: [
        "Procedimiento alineado a la Gestión de Riesgos de Calidad NOM-059 y FEUM.",
        "Define alcance, responsabilidades y criterios de aceptabilidad para medicamentos.",
        "Incluye flujo de identificación, evaluación, control y verificación de riesgos de calidad.",
        "Sirve como base editable para tu propio PNO interno de fabricación farmacéutica.",
      ],
    },
  },
  {
    id: "formato-med",
    icon: LayoutTemplate,
    iconClass: "text-emerald-500",
    titulo: "Formato Archivo Maestro de Riesgos — Medicamentos",
    descripcion:
      "Plantilla oficial TRACEA para análisis de Gestión de Riesgos de Calidad NOM-059 y FEUM. Compatible con el sistema de firmas electrónicas y checklist NOM-059-SSA1-2015 de la plataforma.",
    badgeText: "Formato oficial",
    badgeClass: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
    storagePath: "formato-amgr-med.pdf",
    buttonLabel: "Descargar PDF",
    preview: {
      titulo: "Formato Archivo Maestro de Gestión de Riesgos — Medicamentos",
      cuerpo: [
        "Plantilla de Gestión de Riesgos de Calidad NOM-059 y FEUM con secciones I a VII.",
        "Compatible con la matriz NPR (Severidad × Ocurrencia × Detectabilidad).",
        "Incluye sección de Comité Técnico y Dictamen del Director Técnico.",
        "Pensada para diligenciar antes de cargarla al sistema o adaptar a tu proceso.",
      ],
    },
  },
];

type Clasificacion = "controlado" | "trabajo" | "referencia";

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
  const isTrial = useIsTrial();
  const { toast } = useToast();
  const [docs, setDocs] = useState<OrgDocumento[]>([]);
  const [docsPapelera, setDocsPapelera] = useState<OrgDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ReferenciaDoc | null>(null);
  const [verPapelera, setVerPapelera] = useState(false);

  /** Documento para el cual se muestra el historial de versiones (modal). */
  const [historialDoc, setHistorialDoc] = useState<OrgDocumento | null>(null);
  const [historialVersiones, setHistorialVersiones] = useState<OrgDocumento[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);

  /** Estado de verificación de integridad por documento (id -> resultado). */
  const [verificando, setVerificando] = useState<string | null>(null);
  const [verificacion, setVerificacion] = useState<Record<string, "ok" | "fail">>({});

  // Form upload state
  const [file, setFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [clasificacion, setClasificacion] = useState<Clasificacion>("trabajo");
  const [catalogo, setCatalogo] = useState<{ clave: string; nombre: string }[]>([]);
  const [version, setVersion] = useState("1.0");
  const [usarEnIa, setUsarEnIa] = useState(true);

  // Catálogo de tipos de la empresa activa (núcleo, no depende de Cerebro).
  useEffect(() => {
    if (!org?.id) return;
    (supabase as any)
      .from("documento_tipos")
      .select("clave, nombre, orden")
      .eq("org_id", org.id)
      .eq("activo", true)
      .order("orden")
      .then(({ data }: any) => {
        const lista = (data ?? []) as { clave: string; nombre: string }[];
        setCatalogo(lista);
        setTipo((t) => t || lista.find((x) => x.clave === "pno")?.clave || lista[0]?.clave || "");
      });
  }, [org?.id]);
  const [uploading, setUploading] = useState(false);
  /** Si está definido, la subida se hace como nueva versión del documento padre. */
  const [parentDocId, setParentDocId] = useState<string | null>(null);

  const puedeEliminar = hasRole("admin");

  /** Selección de referencias según la norma aplicable de la organización. */
  const norma = org?.norma_aplicable ?? "NOM-241";
  const REFERENCIAS: ReferenciaDoc[] =
    norma === "NOM-059"
      ? REFERENCIAS_NOM059
      : norma === "MULTI"
      ? [...REFERENCIAS_NOM241, ...REFERENCIAS_NOM059]
      : REFERENCIAS_NOM241;

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
    if (isTrial) {
      toast({
        title: "Descarga restringida en prueba gratuita",
        description: TRIAL_DOWNLOAD_TOOLTIP,
        variant: "destructive",
      });
      return;
    }
    const ok = await descargarArchivoStorage("tracea-recursos", ref.storagePath);
    if (!ok) {
      toast({
        title: "Documento no disponible",
        description: "Este recurso aún no ha sido cargado por el equipo TRACEA.",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!file || !org?.id || !user) return;
    if (!nombre.trim()) {
      toast({ title: "Falta el nombre del documento", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "docx"].includes(ext)) {
      toast({
        title: "Formato no aceptado",
        description: "Solo se aceptan PDF (con texto o escaneado) y Word (.docx).",
        variant: "destructive",
      });
      return;
    }
    const tipoSel = catalogo.find((t) => t.clave === tipo);
    if (!tipoSel) {
      toast({ title: "Selecciona el tipo de documento", variant: "destructive" });
      return;
    }

    setUploading(true);
    const safeName = nombre.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${org.id}/${Date.now()}-${safeName}.${ext}`;

    // Huella SHA-256 en el navegador; el servidor la vuelve a calcular y la guarda.
    let hash: string | null = null;
    try {
      hash = await sha256OfFile(file);
    } catch {
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

    const { data: nuevo, error: dbErr } = await supabase.from("org_documentos").insert({
      org_id: org.id,
      nombre: nombre.trim(),
      tipo: tipoSel.nombre,
      tipo_clave: tipoSel.clave,
      clasificacion,
      version: version.trim() || "1.0",
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      usar_en_ia: usarEnIa,
      creado_por: user.id,
      sha256: hash,
      parent_doc_id: parentDocId,
    } as any).select("id").single();

    if (dbErr || !nuevo) {
      setUploading(false);
      toast({ title: "Error registrando documento", description: dbErr?.message, variant: "destructive" });
      await supabase.storage.from("org-documentos").remove([path]);
      return;
    }

    const { data: huella, error: hErr } = await supabase.functions.invoke("org-documento-huella", {
      body: { doc_id: (nuevo as any).id },
    });
    setUploading(false);

    if (hErr || !huella?.sha256_servidor) {
      toast({
        title: "Documento subido",
        description: "No se pudo confirmar la huella en el servidor. Se reintentará al extraer.",
      });
    } else if (huella.coincide === false) {
      toast({
        title: "La huella no coincide",
        description: "El archivo recibido es distinto al que se calculó en tu equipo. Quedó registrado en la bitácora.",
        variant: "destructive",
      });
    } else {
      toast({
        title: parentDocId ? "Nueva versión registrada" : "Documento subido",
        description: `${nombre.trim()} · SHA-256 verificado en servidor: ${String(huella.sha256_servidor).slice(0, 12)}…`,
      });
    }
    setUploadOpen(false);
    setFile(null);
    setNombre("");
    setTipo(catalogo.find((t) => t.clave === "pno")?.clave ?? catalogo[0]?.clave ?? "");
    setClasificacion("trabajo");
    setVersion("1.0");
    setUsarEnIa(true);
    setParentDocId(null);
    cargarDocs();
  };

  const handleDescargarDoc = async (doc: OrgDocumento) => {
    if (isTrial) {
      toast({
        title: "Descarga restringida en prueba gratuita",
        description: TRIAL_DOWNLOAD_TOOLTIP,
        variant: "destructive",
      });
      return;
    }
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
    setTipo(doc.tipo_clave ?? "");
    setClasificacion((doc.clasificacion as Clasificacion) ?? "trabajo");
    const [maj, min] = (doc.version || "1.0").split(".");
    const nextMin = (parseInt(min || "0", 10) + 1).toString();
    setVersion(`${maj || "1"}.${nextMin}`);
    setUsarEnIa(doc.usar_en_ia);
    setFile(null);
    setUploadOpen(true);
  };

  /** Carga todas las versiones de un documento (versión actual + anteriores). */
  const abrirHistorial = async (doc: OrgDocumento) => {
    setHistorialDoc(doc);
    setHistorialLoading(true);
    const rootId = doc.parent_doc_id || doc.id;
    const sb = supabase as any;
    const { data, error } = await sb
      .from("org_documentos")
      .select("*")
      .eq("org_id", org!.id)
      .or(`id.eq.${rootId},parent_doc_id.eq.${rootId}`)
      .is("deleted_at", null)
      .order("version_num", { ascending: false });
    if (error) {
      toast({ title: "Error cargando historial", description: error.message, variant: "destructive" });
      setHistorialVersiones([]);
    } else {
      setHistorialVersiones((data ?? []) as OrgDocumento[]);
    }
    setHistorialLoading(false);
  };

  /** Copia el hash SHA-256 completo al portapapeles. */
  const copiarHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      toast({
        title: "Hash copiado",
        description: "SHA-256 copiado al portapapeles. Úsalo como evidencia ante COFEPRIS.",
      });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  /**
   * Verifica la integridad del documento: descarga el archivo, recalcula SHA-256
   * en el navegador y lo compara contra el hash registrado en la base de datos.
   */
  const verificarIntegridad = async (doc: OrgDocumento) => {
    if (!doc.sha256) {
      toast({
        title: "Sin hash registrado",
        description: "Este documento se subió antes de la integración SHA-256.",
        variant: "destructive",
      });
      return;
    }
    setVerificando(doc.id);
    try {
      const { data, error } = await supabase.storage
        .from("org-documentos")
        .download(doc.storage_path);
      if (error || !data) throw new Error(error?.message || "No se pudo descargar el archivo");

      const buf = await data.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hashCalculado = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (hashCalculado === doc.sha256) {
        setVerificacion((prev) => ({ ...prev, [doc.id]: "ok" }));
        toast({
          title: "✅ Documento íntegro",
          description: "El hash coincide — el archivo no ha sido modificado.",
        });
      } else {
        setVerificacion((prev) => ({ ...prev, [doc.id]: "fail" }));
        toast({
          title: "❌ Alerta de integridad",
          description: "El documento puede haber sido modificado. Hash no coincide.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Error verificando integridad",
        description: e?.message ?? "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setVerificando(null);
    }
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
                  {isTrial ? (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="w-full">
                            <Button disabled className="w-full" aria-disabled>
                              <Lock className="h-4 w-4" />
                              {ref.buttonLabel}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          {TRIAL_DOWNLOAD_TOOLTIP}{" "}
                          <Link to="/precios" className="underline font-medium">
                            Ver planes
                          </Link>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Button onClick={() => handleDescargarReferencia(ref)} className="w-full">
                      <Download className="h-4 w-4" />
                      {ref.buttonLabel}
                    </Button>
                  )}
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
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger id="tipo">
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogo.map((t) => (
                        <SelectItem key={t.clave} value={t.clave}>{t.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="clasificacion">Clasificación</Label>
                  <Select value={clasificacion} onValueChange={(v) => setClasificacion(v as Clasificacion)}>
                    <SelectTrigger id="clasificacion">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="controlado">Controlado</SelectItem>
                      <SelectItem value="trabajo">De trabajo</SelectItem>
                      <SelectItem value="referencia">Referencia</SelectItem>
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
                    Usar en IA
                    <span className="block text-xs text-muted-foreground font-normal">
                      Cerebro podrá leer este archivo y proponer conocimiento.
                    </span>
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
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRestaurarDoc(doc)}
                                className="gap-1"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Restaurar
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Eliminar permanentemente
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                      <AlertTriangle className="h-5 w-5 text-destructive" />
                                      Eliminar definitivamente
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción es <strong>irreversible</strong>. El documento
                                      "{doc.nombre}" será eliminado del sistema y no podrá
                                      recuperarse.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleEliminarPermanente(doc)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar permanentemente
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
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
                                <span className="ml-2 inline-flex items-center gap-1 align-middle">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        className={
                                          "inline-flex items-center gap-0.5 font-mono text-[11px] " +
                                          (verificacion[doc.id] === "ok"
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : verificacion[doc.id] === "fail"
                                              ? "text-destructive"
                                              : "text-emerald-600 dark:text-emerald-400")
                                        }
                                      >
                                        <Shield className="h-3 w-3" />…{doc.sha256.slice(-8)}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                        SHA-256 (huella inmutable NOM-241 y FEUM)
                                      </p>
                                      <p className="text-xs font-mono break-all">{doc.sha256}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() => copiarHash(doc.sha256!)}
                                        className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                        aria-label="Copiar hash"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copiar hash completo</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() => verificarIntegridad(doc)}
                                        disabled={verificando === doc.id}
                                        className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                        aria-label="Verificar integridad"
                                      >
                                        {verificando === doc.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : verificacion[doc.id] === "ok" ? (
                                          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                        ) : verificacion[doc.id] === "fail" ? (
                                          <AlertTriangle className="h-3 w-3 text-destructive" />
                                        ) : (
                                          <Shield className="h-3 w-3" />
                                        )}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {verificando === doc.id
                                        ? "Verificando…"
                                        : "Verificar integridad (recalcular SHA-256)"}
                                    </TooltipContent>
                                  </Tooltip>
                                </span>
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
                              onClick={() => abrirHistorial(doc)}
                              title="Ver historial de versiones"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          )}
                          {puedeEliminar && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => subirNuevaVersion(doc)}
                              title="Subir nueva versión"
                            >
                              <Upload className="h-4 w-4" />
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

      {/* Modal Historial de versiones */}
      <Dialog
        open={historialDoc !== null}
        onOpenChange={(o) => {
          if (!o) {
            setHistorialDoc(null);
            setHistorialVersiones([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de versiones
            </DialogTitle>
            <DialogDescription>
              {historialDoc?.nombre} — {historialVersiones.length} versión
              {historialVersiones.length !== 1 ? "es" : ""} registrada
              {historialVersiones.length !== 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>
          {historialLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : historialVersiones.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay versiones anteriores.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Versión</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha</TableHead>
                  <TableHead className="hidden md:table-cell">Tamaño</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historialVersiones.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v{v.version}</span>
                        <Badge variant="outline" className="text-[10px]">
                          rev {v.version_num ?? 1}
                        </Badge>
                        {v.es_version_actual && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15 text-[10px]">
                            Versión actual
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 md:hidden">
                        {formatDate(v.created_at)} · {formatBytes(v.size_bytes)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatDate(v.created_at)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatBytes(v.size_bytes)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDescargarDoc(v)}
                        className="gap-1"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Descargar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
      </TooltipProvider>
    </div>
  );
}
