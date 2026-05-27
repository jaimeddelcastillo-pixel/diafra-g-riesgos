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
  BookOpen, Award, Sparkles, ExternalLink, CalendarClock,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useIsTrial, TRIAL_DOWNLOAD_TOOLTIP } from "@/lib/trialRestrictions";
import { useNavigate } from "react-router-dom";
import { useCurso, type CursoDB, type LeccionDB } from "@/hooks/useCurso";

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

// Mapas de comportamiento que NO viven en la BD (relaciones a guías PDF y mensajes IA).
// El contenido editable (título, video, próximamente, etc.) viene de la BD vía useCurso().
const DESCARGA_GUIA_MAP: Record<string, string> = {
  "1.3": "guia-s9-dm",
  "2.3": "pno-amgr-01",
  "nom059-1-3": "guia-s9-med",
  "nom059-2-3": "pno-amgr-02",
};

const PRACTICA_MAP: Record<string, { link?: string; mensajeIA?: string }> = {
  "3.2": { link: "/folios" },
  "nom059-3-2": {
    mensajeIA:
      "Estoy tomando el Curso de Gestión de Riesgos NOM-059. Quiero practicar con un ejercicio guiado. Por favor inicia el protocolo de análisis de riesgos para medicamentos como si fuera mi primer folio de práctica.",
  },
};

const cursoLegacyId = (norma: "NOM-241" | "NOM-059") =>
  norma === "NOM-241" ? "nom241" : "nom059";
const badgeTone = (norma: "NOM-241" | "NOM-059"): "navy" | "orange" =>
  norma === "NOM-241" ? "navy" : "orange";

// Acceso al curso completo (videos + evaluación + DC-3):
// solo organizaciones que pagaron el curso explícitamente o que tienen plan Enterprise.
// Guías y PNOs siguen siendo accesibles para todos los planes.
const CURSO_PRICE_ID = "price_1TQ7kVKfwzAg4OKvjU9mVaun";
const DC3_EXTRA_PRICE_ID = "price_1TbRUHKfwzAg4OKvWE8uMR6y";
const DC3_UNIT_PRICE_USD = 35;
const CURSO_CHECKOUT_LABEL = "Curso + DC-3 + 1 Mes TRACEA — $85 USD lanzamiento";
const DC3_EXTRA_LABEL = "Ya tengo plan TRACEA — solo DC-3 $35 USD por usuario";

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
  const { org, orgRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isTrial = useIsTrial();
  const [progreso, setProgreso] = useState<Record<string, boolean>>({});
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [dc3DialogOpen, setDc3DialogOpen] = useState(false);
  const [dc3Qty, setDc3Qty] = useState(1);

  const planLower = org?.plan?.toLowerCase() ?? "";
  const tieneCurso =
    (org as any)?.tiene_curso_pagado === true || planLower === "enterprise";
  const cursoExpira = (org as any)?.curso_expira_en as string | null | undefined;
  const dc3Emitidos = ((org as any)?.dc3_emitidos as number | null | undefined) ?? 0;
  const dc3Saldo =
    ((org as any)?.dc3_adicionales_disponibles as number | null | undefined) ?? 0;
  const isAdmin = orgRole === "admin" || orgRole === "super_admin";

  const norma = org?.norma_aplicable ?? null;
  const showDM = norma === "NOM-241" || norma === "MULTI" || !norma;
  const showMed = norma === "NOM-059" || norma === "MULTI" || !norma;
  const isMulti = norma === "MULTI" || !norma;

  const { curso: cursoDM, loading: loadingDM } = useCurso(showDM ? "NOM-241" : null);
  const { curso: cursoMed, loading: loadingMed } = useCurso(showMed ? "NOM-059" : null);

  const guiasDM = GUIAS.filter((g) => g.norma === "NOM-241");
  const guiasMed = GUIAS.filter((g) => g.norma === "NOM-059");
  const guiasVisibles = GUIAS.filter(
    (g) => (g.norma === "NOM-241" && showDM) || (g.norma === "NOM-059" && showMed),
  );

  const iniciarCheckoutCurso = async () => {
    setLoadingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: CURSO_PRICE_ID },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No se recibió URL de checkout");
    } catch (err) {
      toast({
        title: "No se pudo iniciar el pago",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoadingCheckout(false);
    }
  };

  const abrirDialogoDC3 = () => {
    setDc3Qty(1);
    setDc3DialogOpen(true);
  };

  const comprarDC3Extra = async () => {
    setLoadingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: DC3_EXTRA_PRICE_ID, quantity: dc3Qty },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No se recibió URL de checkout");
    } catch (err) {
      toast({
        title: "No se pudo iniciar el pago",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoadingCheckout(false);
    }
  };

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

  const handleLeccionClick = async (cursoLegacy: string, l: LeccionDB) => {
    if (l.proximamente) return;
    if (l.tipo === "video" && l.url_video) {
      window.open(l.url_video, "_blank");
      marcarCompletada(cursoLegacy, l.leccion_id);
      return;
    }
    if (l.tipo === "descarga") {
      const refGuiaId = DESCARGA_GUIA_MAP[l.leccion_id];
      if (!refGuiaId) return;
      if (isTrial) {
        toast({
          title: "Descarga restringida en prueba gratuita",
          description: TRIAL_DOWNLOAD_TOOLTIP,
          variant: "destructive",
        });
        return;
      }
      const g = GUIAS.find((x) => x.id === refGuiaId);
      if (g) {
        const ok = await descargarGuia(g);
        if (ok) marcarCompletada(cursoLegacy, l.leccion_id);
      }
      return;
    }
    if (l.tipo === "practica") {
      const cfg = PRACTICA_MAP[l.leccion_id];
      if (cfg?.link) {
        marcarCompletada(cursoLegacy, l.leccion_id);
        navigate(cfg.link);
      } else if (cfg?.mensajeIA) {
        marcarCompletada(cursoLegacy, l.leccion_id);
        window.dispatchEvent(
          new CustomEvent("tracea:open-assistant", { detail: { mensajeInicial: cfg.mensajeIA } }),
        );
      }
    }
  };

  const renderCurso = (curso: CursoDB | null, loading: boolean, defaultOpen = false) => {
    if (loading) {
      return (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Cargando curso...</CardContent>
        </Card>
      );
    }
    if (!curso) return null;
    const cursoLegacy = cursoLegacyId(curso.norma);
    const tone = badgeTone(curso.norma);
    const completables = curso.modulos.flatMap((m) =>
      m.lecciones.filter((l) => !l.proximamente),
    );
    const total = completables.length;
    const completadas = completables.filter(
      (l) => progreso[progresoKey(cursoLegacy, l.leccion_id)],
    ).length;
    const porcentaje = total === 0 ? 0 : Math.round((completadas / total) * 100);
    const totalLecciones = curso.modulos.reduce((a, m) => a + m.lecciones.length, 0);
    const descripcionSuffix = curso.descripcion.includes("·")
      ? curso.descripcion.split("·").slice(-1)[0].trim()
      : curso.descripcion;
    const firstModuloId = curso.modulos[0]?.id;

    return (
      <Card key={curso.id}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{curso.titulo}</CardTitle>
              <CardDescription>
                {curso.modulos.length} módulos · {totalLecciones} lecciones · {descripcionSuffix}
              </CardDescription>
            </div>
            <GuiaBadge tone={tone}>{curso.norma}</GuiaBadge>
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
          <Accordion
            type="multiple"
            defaultValue={defaultOpen && firstModuloId ? [firstModuloId] : []}
            className="w-full"
          >
            {curso.modulos.map((m) => (
              <AccordionItem key={m.id} value={m.id}>
                <AccordionTrigger className="text-sm font-medium">{m.titulo}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {m.lecciones.map((l) => {
                      const completada = progreso[progresoKey(cursoLegacy, l.leccion_id)];
                      const disabled = !!l.proximamente;
                      const numeroVisible = l.leccion_id.startsWith("nom059-")
                        ? l.leccion_id.replace("nom059-", "").replace("-", ".")
                        : l.leccion_id;
                      return (
                        <button
                          key={l.id}
                          onClick={() => handleLeccionClick(cursoLegacy, l)}
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
                          ) : l.tipo === "practica" ? (
                            <ExternalLink className="h-5 w-5 text-[hsl(var(--primary))] shrink-0" />
                          ) : l.tipo === "evaluacion" ? (
                            <Award className="h-5 w-5 text-[hsl(var(--primary))] shrink-0" />
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
                                : l.tipo === "practica"
                                ? "Disponible — Practicar"
                                : l.tipo === "evaluacion"
                                ? "Disponible — Iniciar evaluación"
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
    <>
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
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                variant="outline"
              >
                <Sparkles className="h-3 w-3 mr-1" /> 1 DC-3 incluido
              </Badge>
              <Badge variant="outline" className="border-muted-foreground/30">
                DC-3 emitidos: {dc3Emitidos}
              </Badge>
              <Badge variant="outline" className="border-muted-foreground/30">
                DC-3 disponibles: {dc3Saldo}
              </Badge>
              {isAdmin ? (
                <Button size="sm" variant="outline" onClick={abrirDialogoDC3}>
                  Comprar más DC-3 — $35 USD c/u
                </Button>
              ) : (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Button size="sm" variant="outline" disabled>
                          Comprar más DC-3
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Solo el Administrador de la organización puede comprar DC-3 adicionales.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-orange-500/30 text-orange-600 bg-orange-500/10">
                Lanzamiento — primeros 20 clientes
              </Badge>
            </div>
          )}
        </div>

        {tieneCurso && cursoExpira && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
            <CalendarClock className="h-4 w-4" />
            <span>
              Tu acceso vence el{" "}
              <span className="font-medium text-foreground">
                {new Date(cursoExpira).toLocaleDateString("es-MX", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </span>
          </div>
        )}

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
                <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
                  Curso completo NOM-241 o NOM-059 + Constancia DC-3 oficial STPS + 1 mes
                  de acceso plan Starter con hasta 3 usuarios.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                <Button
                  size="lg"
                  onClick={iniciarCheckoutCurso}
                  disabled={loadingCheckout}
                  className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
                >
                  {CURSO_CHECKOUT_LABEL}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={isAdmin ? abrirDialogoDC3 : undefined}
                  disabled={!isAdmin || loadingCheckout}
                  title={!isAdmin ? "Solo el Administrador puede comprar DC-3" : undefined}
                >
                  {DC3_EXTRA_LABEL}
                </Button>
              </div>
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                Precio de lanzamiento — primeros 20 clientes
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {showDM && renderCurso(cursoDM, loadingDM, true)}
            {showMed && renderCurso(cursoMed, loadingMed, !showDM)}
          </div>
        )}
      </section>
    </div>
      {/* Dialog: comprar DC-3 adicionales */}
      <Dialog open={dc3DialogOpen} onOpenChange={setDc3DialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comprar DC-3 adicionales</DialogTitle>
            <DialogDescription>
              Cada DC-3 adicional cuesta $35 USD. Selecciona cuántos necesitas. Se sumarán a tu saldo disponible al confirmar el pago.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium">Cantidad</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={dc3Qty}
              onChange={(e) =>
                setDc3Qty(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
              }
            />
            <div className="text-sm text-muted-foreground">
              Total estimado:{" "}
              <span className="font-semibold text-foreground">
                ${(dc3Qty * DC3_UNIT_PRICE_USD).toFixed(2)} USD
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Podrás ajustar la cantidad nuevamente en la página de pago de Stripe.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDc3DialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={comprarDC3Extra} disabled={loadingCheckout}>
              Ir al pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
