import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, Flag, Eye } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Pregunta = {
  id: string;
  bloque: string;
  pregunta: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  // respuesta_correcta y justificacion NO se exponen al cliente durante el examen.
  // Sólo se reciben del servidor al calificar (ver resultado.detalles).
};

// Pregunta con las opciones barajadas por intento (anti-trampa visual).
// Mantenemos el mapeo letra-mostrada → letra-original para corregir.
type PreguntaShuffled = Pregunta & {
  opciones: { letra: "A" | "B" | "C" | "D"; texto: string; original: "A" | "B" | "C" | "D" }[];
};

const BLOQUE_LABEL: Record<string, string> = {
  marco_regulatorio: "Marco regulatorio",
  metodologia: "Metodología",
  casos_practicos: "Casos prácticos",
  flujo_aprobacion: "Flujo de aprobación",
};

const MAX_INTENTOS = 3;
const UMBRAL_APROBACION = 80; // %
const TOTAL_PREGUNTAS = 20;
const POR_BLOQUE = 5;
const MIN_BANCO_BLOQUE = 7;
const TIEMPO_LIMITE_SEG = 45 * 60; // 45 min

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function shuffleOpciones(p: Pregunta): PreguntaShuffled {
  const base: Array<{ original: "A" | "B" | "C" | "D"; texto: string }> = [
    { original: "A", texto: p.opcion_a },
    { original: "B", texto: p.opcion_b },
    { original: "C", texto: p.opcion_c },
    { original: "D", texto: p.opcion_d },
  ];
  const mezcla = pickRandom(base, 4);
  const letras: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
  return {
    ...p,
    opciones: mezcla.map((m, i) => ({ letra: letras[i], texto: m.texto, original: m.original })),
  };
}

function fmtMMSS(seg: number): string {
  const m = Math.max(0, Math.floor(seg / 60));
  const s = Math.max(0, seg % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ExamenFinal() {
  const { cursoId } = useParams<{ cursoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [curso, setCurso] = useState<{ id: string; titulo: string; norma: string } | null>(null);
  const [numIntentoPrevio, setNumIntentoPrevio] = useState(0);
  const [yaAprobo, setYaAprobo] = useState<string | null>(null); // intento_id si ya aprobó
  const [bancoOk, setBancoOk] = useState<{ ok: boolean; faltantes: string[] }>({ ok: true, faltantes: [] });
  const [step, setStep] = useState<"intro" | "exam" | "result">("intro");
  const [preguntas, setPreguntas] = useState<PreguntaShuffled[]>([]);
  const [idx, setIdx] = useState(0);
  // respuesta guardada como la letra ORIGINAL de la pregunta (A-D del banco)
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({});
  const [intentoId, setIntentoId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [tiempoRestante, setTiempoRestante] = useState<number>(TIEMPO_LIMITE_SEG);
  const [confirmarEnviar, setConfirmarEnviar] = useState(false);
  const tabBlurRef = useRef(0);
  const [resultado, setResultado] = useState<{
    correctas: number;
    calificacion: number;
    aprobado: boolean;
    bloque_resumen: Record<string, { correctas: number; total: number }>;
    intento_id: string;
    detalles?: Array<{
      id: string;
      bloque: string;
      pregunta: string;
      opcion_a: string;
      opcion_b: string;
      opcion_c: string;
      opcion_d: string;
      respuesta_correcta: string;
      justificacion: string;
      respuesta_usuario: string | null;
      correcta: boolean;
    }>;
  } | null>(null);
  const [diplomaFolio, setDiplomaFolio] = useState<string | null>(null);
  const [emitiendoDiploma, setEmitiendoDiploma] = useState(false);

  useEffect(() => {
    if (!cursoId || !user) return;
    (async () => {
      const { data: c } = await supabase
        .from("cursos")
        .select("id, titulo, norma")
        .eq("id", cursoId)
        .single();
      setCurso(c as any);

      const { data: prev } = await supabase
        .from("curso_examen_intentos")
        .select("id, num_intento, aprobado")
        .eq("curso_id", cursoId)
        .eq("user_id", user.id)
        .order("num_intento", { ascending: false });
      setNumIntentoPrevio((prev ?? []).length);
      const aprobado = (prev ?? []).find((i: any) => i.aprobado);
      if (aprobado) setYaAprobo(aprobado.id);

      // Validar banco por bloque (≥7 activas por bloque) vía RPC (no expone preguntas).
      const { data: bank } = await (supabase as any).rpc("examen_validar_banco", {
        p_curso_id: cursoId,
      });
      const cuenta: Record<string, number> = (bank as Record<string, number>) ?? {};
      const faltantes: string[] = [];
      for (const b of ["marco_regulatorio", "metodologia", "casos_practicos", "flujo_aprobacion"]) {
        if ((cuenta[b] || 0) < MIN_BANCO_BLOQUE) faltantes.push(BLOQUE_LABEL[b]);
      }
      setBancoOk({ ok: faltantes.length === 0, faltantes });

      setLoading(false);
    })();
  }, [cursoId, user]);

  // Temporizador
  useEffect(() => {
    if (step !== "exam" || !startedAt) return;
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const restante = TIEMPO_LIMITE_SEG - elapsed;
      setTiempoRestante(restante);
      if (restante <= 0) {
        clearInterval(t);
        enviar(true);
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, startedAt]);

  // Anti-trampa: contar cambios de pestaña/ventana
  useEffect(() => {
    if (step !== "exam") return;
    const onBlur = () => { if (document.hidden) tabBlurRef.current += 1; };
    document.addEventListener("visibilitychange", onBlur);
    return () => document.removeEventListener("visibilitychange", onBlur);
  }, [step]);

  const iniciarExamen = async () => {
    if (!cursoId || !user) return;
    if (!bancoOk.ok) {
      toast({
        title: "Banco incompleto",
        description: `Faltan preguntas activas en: ${bancoOk.faltantes.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    // El servidor selecciona las 20 preguntas aleatorias (5 por bloque), crea el intento
    // y devuelve las preguntas SIN respuesta correcta ni justificación.
    const { data, error } = await (supabase as any).rpc("examen_iniciar", {
      p_curso_id: cursoId,
    });
    if (error || !data) {
      toast({
        title: "Error",
        description: error?.message ?? "No se pudo iniciar la evaluación.",
        variant: "destructive",
      });
      return;
    }
    const preguntasSrv: Pregunta[] = (data.preguntas as Pregunta[]) ?? [];
    if (preguntasSrv.length < TOTAL_PREGUNTAS) {
      toast({
        title: "Banco insuficiente",
        description: `Se requieren al menos ${POR_BLOQUE} preguntas activas por bloque.`,
        variant: "destructive",
      });
      return;
    }
    // Barajar localmente el orden de opciones de cada pregunta (anti-trampa visual).
    const shuffled = preguntasSrv.map(shuffleOpciones);
    setIntentoId(data.intento_id as string);
    setPreguntas(shuffled);
    setRespuestas({});
    setMarcadas({});
    setIdx(0);
    tabBlurRef.current = 0;
    setStartedAt(Date.now());
    setTiempoRestante(TIEMPO_LIMITE_SEG);
    setStep("exam");
  };

  const responder = (op: string) => {
    const p = preguntas[idx];
    // op es la letra MOSTRADA → guardar la letra ORIGINAL del banco
    const sel = p.opciones.find((o) => o.letra === op);
    if (!sel) return;
    setRespuestas((r) => ({ ...r, [p.id]: sel.original }));
  };

  const toggleMarcar = (pid: string) => {
    setMarcadas((m) => ({ ...m, [pid]: !m[pid] }));
  };

  const enviar = async (autoExpirado = false) => {
    if (!intentoId) return;
    const now = Date.now();
    const duracionSeg = startedAt ? Math.floor((now - startedAt) / 1000) : null;
    // Calificación server-side
    const { data, error } = await (supabase as any).rpc("examen_calificar", {
      p_intento_id: intentoId,
      p_respuestas: respuestas,
      p_duracion_seg: duracionSeg,
      p_tab_blur_count: tabBlurRef.current,
    });
    if (error || !data) {
      toast({
        title: "Error al enviar",
        description: error?.message ?? "No se pudo calificar el examen.",
        variant: "destructive",
      });
      return;
    }
    const calif = Number(data.calificacion) || 0;
    const aprobado = !!data.aprobado;
    setResultado({
      correctas: data.correctas ?? 0,
      calificacion: calif,
      aprobado,
      bloque_resumen: (data.bloque_resumen as any) ?? {},
      intento_id: intentoId,
      detalles: data.detalles ?? [],
    });
    setStep("result");

    if (autoExpirado) {
      toast({
        title: "Tiempo agotado",
        description: "El examen se envió automáticamente.",
      });
    }

    if (aprobado) {
      await emitirDiploma(intentoId);
    }
  };

  const emitirDiploma = async (idIntento: string) => {
    setEmitiendoDiploma(true);
    try {
      const { data, error } = await supabase.functions.invoke("emitir-diploma", {
        body: { intento_id: idIntento },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setDiplomaFolio(data?.folio ?? null);
      toast({ title: "🎓 Diploma emitido", description: `Folio ${data?.folio}` });
    } catch (err: any) {
      toast({ title: "Error al emitir diploma", description: err.message, variant: "destructive" });
    } finally {
      setEmitiendoDiploma(false);
    }
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (!curso) return <div className="p-6 text-center text-muted-foreground">Curso no encontrado</div>;

  const intentosRestantes = MAX_INTENTOS - numIntentoPrevio;

  // ─── Resultado ─────────────────────────────────────────────────────────
  if (step === "result" && resultado) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/capacitacion")} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <Card>
          <CardHeader className="text-center">
            {resultado.aprobado ? (
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            ) : (
              <XCircle className="h-16 w-16 text-destructive mx-auto" />
            )}
            <CardTitle className="text-2xl mt-2">
              {resultado.aprobado ? "¡Aprobaste!" : "No aprobaste"}
            </CardTitle>
            <CardDescription>
              {resultado.correctas} de {TOTAL_PREGUNTAS} correctas — {resultado.calificacion.toFixed(0)} / 100
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Resumen por bloque</p>
              {Object.entries(resultado.bloque_resumen).map(([b, r]) => (
                <div key={b} className="flex items-center justify-between text-sm border rounded p-2">
                  <span>{BLOQUE_LABEL[b] ?? b}</span>
                  <Badge variant={r.correctas / r.total >= 0.8 ? "default" : "destructive"}>
                    {r.correctas} / {r.total}
                  </Badge>
                </div>
              ))}
            </div>

            {resultado.aprobado ? (
              <div className="space-y-2">
                <div className="rounded border border-emerald-500/40 bg-emerald-500/5 p-4 text-center">
                  <p className="text-sm font-semibold text-emerald-700">
                    🎓 Diploma emitido
                  </p>
                  {diplomaFolio && (
                    <p className="text-xs text-muted-foreground mt-1">Folio {diplomaFolio}</p>
                  )}
                  {emitiendoDiploma && (
                    <p className="text-xs text-muted-foreground mt-1">Generando diploma…</p>
                  )}
                </div>
                <Button onClick={() => navigate("/mis-diplomas")} className="w-full gap-2">
                  <Award className="h-4 w-4" /> Ver en Mis Diplomas
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  También enviamos el diploma a tu correo.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm">
                  Te quedan <strong>{Math.max(0, MAX_INTENTOS - (numIntentoPrevio + 1))}</strong> intento(s).
                  Repasa los módulos asociados a los bloques con menor puntaje y vuelve a intentarlo.
                </p>
                {MAX_INTENTOS - (numIntentoPrevio + 1) > 0 && (
                  <Button
                    onClick={() => {
                      setNumIntentoPrevio((n) => n + 1);
                      setStep("intro");
                      setResultado(null);
                      setIntentoId(null);
                    }}
                    className="w-full gap-2"
                  >
                    <RefreshCw className="h-4 w-4" /> Reintentar
                  </Button>
                )}
                {/* Revisión pregunta a pregunta del intento recién terminado */}
                <details className="mt-4 rounded border bg-muted/30">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Revisar mis respuestas
                  </summary>
                  <div className="p-3 space-y-3">
                    {preguntas.map((p, i) => {
                      const r = respuestas[p.id];
                      const ok = r === p.respuesta_correcta;
                      return (
                        <div key={p.id} className="rounded border bg-background p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">Pregunta {i + 1}</span>
                            {ok ? (
                              <Badge className="bg-emerald-500 text-white">Correcta</Badge>
                            ) : (
                              <Badge variant="destructive">Incorrecta</Badge>
                            )}
                          </div>
                          <p className="mb-2">{p.pregunta}</p>
                          <p className="text-xs">
                            <strong>Tu respuesta:</strong>{" "}
                            {r ? `${r}. ${(p as any)[`opcion_${r.toLowerCase()}`]}` : "Sin responder"}
                          </p>
                          {!ok && (
                            <p className="text-xs text-emerald-700 dark:text-emerald-400">
                              <strong>Correcta:</strong>{" "}
                              {p.respuesta_correcta}. {(p as any)[`opcion_${p.respuesta_correcta.toLowerCase()}`]}
                            </p>
                          )}
                          {p.justificacion && (
                            <p className="mt-1 text-xs text-muted-foreground italic">
                              {p.justificacion}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Examen ────────────────────────────────────────────────────────────
  if (step === "exam") {
    const p = preguntas[idx];
    const selOriginal = respuestas[p.id];
    // letra MOSTRADA que corresponde al original guardado
    const selMostrada = p.opciones.find((o) => o.original === selOriginal)?.letra;
    const respondidas = Object.keys(respuestas).length;
    const tiempoBajo = tiempoRestante <= 60;
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Pregunta {idx + 1} de {TOTAL_PREGUNTAS}</span>
          <div className="flex items-center gap-2">
            <Badge
              variant={tiempoBajo ? "destructive" : "secondary"}
              className="gap-1 font-mono"
            >
              <Clock className="h-3 w-3" /> {fmtMMSS(tiempoRestante)}
            </Badge>
            <Badge variant="outline">{respondidas} / {TOTAL_PREGUNTAS} respondidas</Badge>
          </div>
        </div>
        <Progress value={((idx + 1) / TOTAL_PREGUNTAS) * 100} className="h-2" />

        {/* Navegador de preguntas */}
        <div className="grid grid-cols-10 gap-1">
          {preguntas.map((pp, i) => {
            const respondida = respuestas[pp.id] !== undefined;
            const marcada = !!marcadas[pp.id];
            const actual = i === idx;
            return (
              <button
                key={pp.id}
                onClick={() => setIdx(i)}
                className={`h-7 text-[11px] rounded border transition relative ${
                  actual
                    ? "border-primary bg-primary text-primary-foreground"
                    : respondida
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-border bg-muted/30 hover:bg-muted"
                }`}
              >
                {i + 1}
                {marcada && <Flag className="h-2.5 w-2.5 absolute top-0.5 right-0.5 text-amber-500" />}
              </button>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px]">{BLOQUE_LABEL[p.bloque] ?? p.bloque}</Badge>
              <Button
                size="sm"
                variant={marcadas[p.id] ? "default" : "ghost"}
                className="h-7 text-xs gap-1"
                onClick={() => toggleMarcar(p.id)}
              >
                <Flag className="h-3.5 w-3.5" />
                {marcadas[p.id] ? "Marcada" : "Marcar para revisar"}
              </Button>
            </div>
            <CardTitle className="text-base mt-2">{p.pregunta}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {p.opciones.map((op) => (
              <button
                key={op.letra}
                onClick={() => responder(op.letra)}
                className={`w-full text-left p-3 rounded border text-sm transition ${
                  selMostrada === op.letra ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50"
                }`}
              >
                <span className="font-bold mr-2">{op.letra}.</span>{op.texto}
              </button>
            ))}
          </CardContent>
        </Card>
        <div className="flex justify-between">
          <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
            Anterior
          </Button>
          {idx < TOTAL_PREGUNTAS - 1 ? (
            <Button onClick={() => setIdx((i) => i + 1)}>Siguiente</Button>
          ) : (
            <Button onClick={() => setConfirmarEnviar(true)}>
              Enviar examen
            </Button>
          )}
        </div>

        <AlertDialog open={confirmarEnviar} onOpenChange={setConfirmarEnviar}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Enviar examen?</AlertDialogTitle>
              <AlertDialogDescription>
                Has respondido <strong>{respondidas}</strong> de {TOTAL_PREGUNTAS} preguntas.
                {respondidas < TOTAL_PREGUNTAS && (
                  <> Las preguntas sin responder se contarán como incorrectas.</>
                )}{" "}
                Una vez enviado no podrás modificar tus respuestas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setConfirmarEnviar(false); enviar(false); }}>
                Sí, enviar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ─── Intro ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/capacitacion")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Award className="h-8 w-8 text-[hsl(var(--primary))]" />
            <div>
              <CardTitle>Evaluación final — {curso.titulo}</CardTitle>
              <CardDescription>Norma {curso.norma}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {yaAprobo ? (
            <div className="rounded border border-emerald-500/40 bg-emerald-500/5 p-4">
              <p className="font-semibold text-emerald-700">Ya aprobaste esta evaluación.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Puedes descargar tu diploma en cualquier momento desde la plataforma.
              </p>
              <Button
                className="mt-3 gap-2"
                onClick={() => navigate("/mis-diplomas")}
              >
                <Award className="h-4 w-4" /> Ver en Mis Diplomas
              </Button>
            </div>
          ) : (
            <>
              {!bancoOk.ok && (
                <div className="rounded border border-yellow-500/40 bg-yellow-500/5 p-3 text-xs text-yellow-800 dark:text-yellow-400">
                  Esta evaluación todavía no está disponible: faltan preguntas activas en{" "}
                  <strong>{bancoOk.faltantes.join(", ")}</strong>.
                </div>
              )}
              <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                <li>{TOTAL_PREGUNTAS} preguntas ({POR_BLOQUE} por bloque temático, sorteadas en cada intento)</li>
                <li>Tiempo límite: <strong>{Math.floor(TIEMPO_LIMITE_SEG / 60)} minutos</strong> (auto-envío al expirar)</li>
                <li>Se requiere {UMBRAL_APROBACION} % para aprobar y recibir el diploma</li>
                <li>Máximo {MAX_INTENTOS} intentos por curso</li>
                <li>Te quedan <strong>{intentosRestantes}</strong> intento(s)</li>
                <li>Las preguntas y el orden de las opciones se mezclan en cada intento</li>
              </ul>
              <Button
                className="w-full gap-2"
                disabled={intentosRestantes <= 0 || !bancoOk.ok}
                onClick={iniciarExamen}
              >
                <Award className="h-4 w-4" />
                {intentosRestantes > 0 ? "Iniciar evaluación" : "Sin intentos disponibles"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}