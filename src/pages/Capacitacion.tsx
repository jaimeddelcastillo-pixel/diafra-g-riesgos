import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  GraduationCap, FileText, Download, Lock, Play, CheckCircle2,
  BookOpen, Award, Sparkles, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsTrial, TRIAL_DOWNLOAD_TOOLTIP } from "@/lib/trialRestrictions";
import { useNavigate } from "react-router-dom";

type Guia = {
  id: string;
  titulo: string;
  descripcion: string;
  badge: string;
  badgeTone: "navy" | "orange";
  storagePath: string;
  buttonLabel: string;
  norma: "NOM-241" | "NOM-059";
};

const GUIAS: Guia[] = [
  {
    id: "guia-s9-dm",
    titulo: "Guía Técnica S≥9 — Dispositivos Médicos",
    descripcion:
      "Por qué un riesgo con NPR bajo puede seguir siendo crítico y cómo defenderlo ante COFEPRIS. Gestión de Riesgos NOM-241 y FEUM.",
    badge: "NOM-241",
    badgeTone: "navy",
    storagePath: "guia-s9-dm.pdf",
    buttonLabel: "Descargar PDF",
    norma: "NOM-241",
  },
  {
    id: "guia-s9-med",
    titulo: "Guía Técnica S≥9 — Medicamentos",
    descripcion:
      "Severidad crítica en gestión de riesgos farmacéuticos. Incluye Regla S+1 para población vulnerable. Gestión de Riesgos NOM-059 y FEUM.",
    badge: "NOM-059",
    badgeTone: "orange",
    storagePath: "guia-s9-med.pdf",
    buttonLabel: "Descargar PDF",
    norma: "NOM-059",
  },
  {
    id: "pno-amgr-01",
    titulo: "PNO-AMGR-01 — Gestión de Riesgos DM",
    descripcion:
      "Procedimiento Normalizado proforma para implementar gestión de riesgos en dispositivos médicos. Incluye los 6 datos requeridos para tu análisis de riesgo NOM-241 y FEUM.",
    badge: "NOM-241",
    badgeTone: "navy",
    storagePath: "PNO-AMGR-01.pdf",
    buttonLabel: "Descargar PDF",
    norma: "NOM-241",
  },
  {
    id: "pno-amgr-02",
    titulo: "PNO-AMGR-02 — Gestión de Riesgos Medicamentos",
    descripcion:
      "Procedimiento Normalizado proforma para medicamentos. Incluye los requisitos de Gestión de Riesgos de Calidad NOM-059 y FEUM, y escala S+1 para población vulnerable.",
    badge: "NOM-059",
    badgeTone: "orange",
    storagePath: "PNO-AMGR-02.pdf",
    buttonLabel: "Descargar PDF",
    norma: "NOM-059",
  },
];

const PROXIMAMENTE = [
  { titulo: "Checklist de Auditoría COFEPRIS", descripcion: "Lista de verificación previa a una visita regulatoria." },
];

type Recurso = {
  id: string;
  titulo: string;
  descripcion: string;
  storagePath: string;
};

const RECURSOS_TRACEA: Recurso[] = [
  {
    id: "manual-tracea",
    titulo: "Manual de Usuario TRACEA",
    descripcion: "Guía completa para sacar el máximo provecho de la plataforma.",
    storagePath: "manual-tracea.pdf",
  },
  {
    id: "glosario-regulatorio",
    titulo: "Glosario Regulatorio NOM-241 / NOM-059",
    descripcion: "Definiciones clave para hablar el idioma de COFEPRIS.",
    storagePath: "glosario-regulatorio.pdf",
  },
];

type Leccion = {
  id: string;
  titulo: string;
  tipo: "video" | "descarga" | "link" | "assistant";
  refGuiaId?: string;
  link?: string;
  mensajeIA?: string;
  proximamente?: boolean;
};

type Modulo = { id: string; titulo: string; lecciones: Leccion[] };

type Curso = {
  id: "nom241" | "nom059";
  titulo: string;
  descripcion: string;
  badge: string;
  badgeTone: "navy" | "orange";
  modulos: Modulo[];
};

const CURSO_NOM241: Curso = {
  id: "nom241",
  titulo: "Gestión de Riesgos NOM-241 para Dispositivos Médicos",
  descripcion: "4 módulos · Constancia DC-3 al finalizar",
  badge: "NOM-241",
  badgeTone: "navy",
  modulos: [
    {
      id: "m1",
      titulo: "Módulo 1: Introducción a la Gestión de Riesgos",
      lecciones: [
        { id: "1.1", titulo: "¿Qué es la Gestión de Riesgos en dispositivos médicos?", tipo: "video", proximamente: true },
        { id: "1.2", titulo: "NOM-241 y COFEPRIS: lo que necesitas saber", tipo: "video", proximamente: true },
        { id: "1.3", titulo: "Descargar Guía S≥9 DM", tipo: "descarga", refGuiaId: "guia-s9-dm" },
      ],
    },
    {
      id: "m2",
      titulo: "Módulo 2: El Archivo Maestro de Gestión de Riesgos",
      lecciones: [
        { id: "2.1", titulo: "Los 6 datos que necesita tu análisis de riesgo", tipo: "video", proximamente: true },
        { id: "2.2", titulo: "Cómo evaluar el nivel de prioridad de cada riesgo", tipo: "video", proximamente: true },
        { id: "2.3", titulo: "Descargar PNO-AMGR-01", tipo: "descarga", refGuiaId: "pno-amgr-01" },
      ],
    },
    {
      id: "m3",
      titulo: "Módulo 3: Casos Prácticos",
      lecciones: [
        { id: "3.1", titulo: "Análisis completo de proceso", tipo: "video", proximamente: true },
        { id: "3.2", titulo: "Ejercicio con el Asistente IA", tipo: "link", link: "/folios" },
      ],
    },
    {
      id: "m4",
      titulo: "Módulo 4: Evaluación y Certificación",
      lecciones: [
        { id: "4.1", titulo: "Evaluación final", tipo: "video", proximamente: true },
        { id: "4.2", titulo: "Constancia DC-3", tipo: "video", proximamente: true },
      ],
    },
  ],
};

const CURSO_NOM059: Curso = {
  id: "nom059",
  titulo: "Gestión de Riesgos NOM-059 para Medicamentos",
  descripcion: "4 módulos · Gestión de Riesgos NOM-059 y FEUM",
  badge: "NOM-059",
  badgeTone: "orange",
  modulos: [
    {
      id: "m1",
      titulo: "Módulo 1: Introducción al QRM Farmacéutico",
      lecciones: [
        { id: "nom059-1-1", titulo: "¿Qué es la Gestión de Riesgos de Calidad en medicamentos?", tipo: "video", proximamente: true },
        { id: "nom059-1-2", titulo: "NOM-059 y COFEPRIS: lo que necesitas saber", tipo: "video", proximamente: true },
        { id: "nom059-1-3", titulo: "Descargar Guía S≥9 — Medicamentos", tipo: "descarga", refGuiaId: "guia-s9-med" },
      ],
    },
    {
      id: "m2",
      titulo: "Módulo 2: El Archivo Maestro de QRM",
      lecciones: [
        { id: "nom059-2-1", titulo: "Los 6 datos que necesita tu análisis de riesgo NOM-059", tipo: "video", proximamente: true },
        { id: "nom059-2-2", titulo: "Parámetros críticos y cómo evaluar el nivel de riesgo", tipo: "video", proximamente: true },
        { id: "nom059-2-3", titulo: "Descargar PNO-AMGR-02 — Gestión de Riesgos Medicamentos", tipo: "descarga", refGuiaId: "pno-amgr-02" },
      ],
    },
    {
      id: "m3",
      titulo: "Módulo 3: Casos Prácticos",
      lecciones: [
        { id: "nom059-3-1", titulo: "Análisis de riesgo: proceso de llenado aséptico", tipo: "video", proximamente: true },
        {
          id: "nom059-3-2",
          titulo: "Practicar con el Asistente IA — Medicamentos",
          tipo: "assistant",
          mensajeIA:
            "Estoy tomando el Curso de Gestión de Riesgos NOM-059. Quiero practicar con un ejercicio guiado. Por favor inicia el protocolo de análisis de riesgos para medicamentos como si fuera mi primer folio de práctica.",
        },
      ],
    },
    {
      id: "m4",
      titulo: "Módulo 4: Evaluación y Certificación",
      lecciones: [
        { id: "nom059-4-1", titulo: "Evaluación final NOM-059", tipo: "video", proximamente: true },
        { id: "nom059-4-2", titulo: "Constancia DC-3", tipo: "video", proximamente: true },
      ],
    },
  ],
};

const PLANES_CON_CURSO = ["curso", "starter", "professional", "enterprise"];

function GuiaBadge({ tone, children }: { tone: "navy" | "orange"; children: React.ReactNode }) {
  const cls =
    tone === "navy"
      ? "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30"
      : "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30";
  return <Badge variant="outline" className={cls}>{children}</Badge>;
}

function renderGuiaCard(g: Guia, onDownload: (g: Guia) => void, isTrial: boolean) {
  return (
    <Card key={g.id} className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <FileText
            className={
              g.badgeTone === "navy"
                ? "h-8 w-8 text-[hsl(var(--primary))] shrink-0"
                : "h-8 w-8 text-orange-500 shrink-0"
            }
          />
          <GuiaBadge tone={g.badgeTone}>{g.badge}</GuiaBadge>
        </div>
        <CardTitle className="text-base mt-2">{g.titulo}</CardTitle>
        <CardDescription className="text-sm">{g.descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        {isTrial ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="w-full inline-block">
                  <Button disabled variant="outline" className="w-full" aria-disabled>
                    <Lock className="h-4 w-4 mr-2" />
                    {g.buttonLabel}
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
          <Button onClick={() => onDownload(g)} className="w-full" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            {g.buttonLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

const progresoKey = (cursoId: string, leccionId: string) => `${cursoId}::${leccionId}`;

export default function Capacitacion() {
  const { org } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isTrial = useIsTrial();
  const [progreso, setProgreso] = useState<Record<string, boolean>>({});

  const planLower = org?.plan?.toLowerCase() ?? "";
  const tieneCurso =
    !!planLower && (PLANES_CON_CURSO.includes(planLower) || planLower === "trial");

  const norma = org?.norma_aplicable ?? null;
  const showDM = norma === "NOM-241" || norma === "MULTI" || !norma;
  const showMed = norma === "NOM-059" || norma === "MULTI" || !norma;
  const isMulti = norma === "MULTI" || !norma;

  const guiasDM = GUIAS.filter((g) => g.norma === "NOM-241");
  const guiasMed = GUIAS.filter((g) => g.norma === "NOM-059");
  const guiasVisibles = GUIAS.filter(
    (g) => (g.norma === "NOM-241" && showDM) || (g.norma === "NOM-059" && showMed),
  );

  useEffect(() => {
    (async () => {
      if (!org?.id) return;
      const { data } = await (supabase as any)
        .from("capacitacion_progreso")
        .select("curso_id,leccion_id,completado")
        .in("curso_id", ["nom241", "nom059"]);
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r: any) => {
        if (r.completado) map[progresoKey(r.curso_id, r.leccion_id)] = true;
      });
      setProgreso(map);
    })();
  }, [org?.id]);

  const descargarGuia = async (g: Guia) => {
    const { data } = await supabase.storage
      .from("tracea-recursos")
      .createSignedUrl(g.storagePath, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
      return true;
    }
    const { data: pub } = supabase.storage.from("tracea-recursos").getPublicUrl(g.storagePath);
    if (pub?.publicUrl) {
      window.open(pub.publicUrl, "_blank");
      return true;
    }
    toast({
      title: "Documento no disponible",
      description: "Este recurso aún no ha sido cargado por el equipo TRACEA.",
      variant: "destructive",
    });
    return false;
  };

  const descargarRecurso = async (r: Recurso) => {
    const { data } = await supabase.storage
      .from("tracea-recursos")
      .createSignedUrl(r.storagePath, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
      return;
    }
    const { data: pub } = supabase.storage.from("tracea-recursos").getPublicUrl(r.storagePath);
    if (pub?.publicUrl) {
      window.open(pub.publicUrl, "_blank");
      return;
    }
    toast({
      title: "Documento no disponible",
      description: "Este recurso aún no ha sido cargado por el equipo TRACEA.",
      variant: "destructive",
    });
  };

  const marcarCompletada = async (cursoId: string, leccionId: string) => {
    if (!org?.id) return;
    await (supabase as any).from("capacitacion_progreso").upsert(
      {
        org_id: org.id,
        curso_id: cursoId,
        leccion_id: leccionId,
        completado: true,
        completado_en: new Date().toISOString(),
      },
      { onConflict: "org_id,user_id,curso_id,leccion_id" },
    );
    setProgreso((p) => ({ ...p, [progresoKey(cursoId, leccionId)]: true }));
  };

  const handleLeccionClick = async (curso: Curso, l: Leccion) => {
    if (l.proximamente) return;
    if (l.tipo === "descarga" && l.refGuiaId) {
      if (isTrial) {
        toast({
          title: "Descarga restringida en prueba gratuita",
          description: TRIAL_DOWNLOAD_TOOLTIP,
          variant: "destructive",
        });
        return;
      }
      const g = GUIAS.find((x) => x.id === l.refGuiaId);
      if (g) {
        const ok = await descargarGuia(g);
        if (ok) marcarCompletada(curso.id, l.id);
      }
    } else if (l.tipo === "link" && l.link) {
      marcarCompletada(curso.id, l.id);
      navigate(l.link);
    } else if (l.tipo === "assistant" && l.mensajeIA) {
      marcarCompletada(curso.id, l.id);
      window.dispatchEvent(
        new CustomEvent("tracea:open-assistant", { detail: { mensajeInicial: l.mensajeIA } }),
      );
    }
  };

  const renderCurso = (curso: Curso, defaultOpen = false) => {
    const completables = curso.modulos.flatMap((m) =>
      m.lecciones.filter((l) => !l.proximamente),
    );
    const total = completables.length;
    const completadas = completables.filter((l) => progreso[progresoKey(curso.id, l.id)]).length;
    const porcentaje = total === 0 ? 0 : Math.round((completadas / total) * 100);
    const totalLecciones = curso.modulos.reduce((a, m) => a + m.lecciones.length, 0);

    return (
      <Card key={curso.id}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{curso.titulo}</CardTitle>
              <CardDescription>
                {curso.modulos.length} módulos · {totalLecciones} lecciones · {curso.descripcion.split("·").slice(-1)[0].trim()}
              </CardDescription>
            </div>
            <GuiaBadge tone={curso.badgeTone}>{curso.badge}</GuiaBadge>
          </div>
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progreso</span>
              <span>{completadas}/{total} · {porcentaje}%</span>
            </div>
            <Progress value={porcentaje} className="h-2" />
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={defaultOpen ? ["m1"] : []} className="w-full">
            {curso.modulos.map((m) => (
              <AccordionItem key={m.id} value={m.id}>
                <AccordionTrigger className="text-sm font-medium">{m.titulo}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {m.lecciones.map((l) => {
                      const completada = progreso[progresoKey(curso.id, l.id)];
                      const disabled = !!l.proximamente;
                      const numeroVisible = l.id.startsWith("nom059-")
                        ? l.id.replace("nom059-", "").replace("-", ".")
                        : l.id;
                      return (
                        <button
                          key={l.id}
                          onClick={() => handleLeccionClick(curso, l)}
                          disabled={disabled}
                          className={`w-full flex items-center gap-3 p-3 rounded-md border text-left transition ${
                            disabled ? "bg-muted/30 cursor-not-allowed" : "hover:bg-muted/50"
                          }`}
                        >
                          {l.tipo === "video" ? (
                            <div className="h-10 w-16 rounded bg-muted flex items-center justify-center shrink-0">
                              <Play className="h-4 w-4 text-muted-foreground" />
                            </div>
                          ) : completada ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                          ) : l.tipo === "link" || l.tipo === "assistant" ? (
                            <ExternalLink className="h-5 w-5 text-[hsl(var(--primary))] shrink-0" />
                          ) : (
                            <Download className="h-5 w-5 text-[hsl(var(--primary))] shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              Lección {numeroVisible}: {l.titulo}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {l.proximamente
                                ? "Próximamente"
                                : completada
                                ? "Completada"
                                : l.tipo === "descarga"
                                ? "Disponible — Descargar"
                                : l.tipo === "assistant"
                                ? "Disponible — Abrir Asistente IA"
                                : l.tipo === "link"
                                ? "Disponible — Abrir"
                                : "Disponible"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-[hsl(var(--primary))] text-primary-foreground p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-white/10">
            <GraduationCap className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Capacitación</h1>
            <p className="text-primary-foreground/80 mt-1">
              Aprende, certifícate y cumple con COFEPRIS
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN 1 — Biblioteca de Conocimiento */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h2 className="text-xl font-semibold">Biblioteca de Conocimiento</h2>
          <Badge variant="secondary">Acceso libre</Badge>
        </div>

        {isMulti ? (
          <>
            {guiasDM.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Dispositivos Médicos · NOM-241
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {guiasDM.map((g) => renderGuiaCard(g, descargarGuia, isTrial))}
                </div>
              </div>
            )}
            {guiasMed.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Medicamentos · NOM-059
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {guiasMed.map((g) => renderGuiaCard(g, descargarGuia, isTrial))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Guías Técnicas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {guiasVisibles.map((g) => renderGuiaCard(g, descargarGuia, isTrial))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 mt-6">
            Manual y Glosario
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {RECURSOS_TRACEA.map((r) => (
              <Card key={r.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <BookOpen className="h-8 w-8 text-[hsl(var(--primary))] shrink-0" />
                    <Badge variant="secondary">TRACEA</Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{r.titulo}</CardTitle>
                  <CardDescription className="text-sm">{r.descripcion}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button onClick={() => descargarRecurso(r)} className="w-full" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Descargar PDF
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 mt-6">
            Próximamente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PROXIMAMENTE.map((p) => (
              <Card key={p.titulo} className="relative opacity-70">
                <div className="absolute top-3 right-3">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardHeader>
                  <CardTitle className="text-sm">{p.titulo}</CardTitle>
                  <CardDescription className="text-xs">{p.descripcion}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary" className="text-xs">Próximamente</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SECCIÓN 2 — Curso de Certificación */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h2 className="text-xl font-semibold">Curso de Certificación</h2>
          </div>
          {tieneCurso ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" variant="outline">
              <Sparkles className="h-3 w-3 mr-1" /> Incluido en tu plan
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-orange-500/30 text-orange-600 bg-orange-500/10">
                Requiere Curso $450 USD
              </Badge>
              <Button size="sm" onClick={() => navigate("/precios")}>Ver planes</Button>
            </div>
          )}
        </div>

        {!tieneCurso ? (
          <Card className="border-2 border-dashed">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-[hsl(var(--primary))]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  Certifica a tu equipo en Gestión de Riesgos
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Con constancia DC-3 oficial STPS al finalizar la evaluación.
                </p>
              </div>
              <Button size="lg" onClick={() => navigate("/precios")}>
                Adquirir Curso — $450 USD
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {showDM && renderCurso(CURSO_NOM241, true)}
            {showMed && renderCurso(CURSO_NOM059, !showDM)}
          </div>
        )}
      </section>
    </div>
  );
}
