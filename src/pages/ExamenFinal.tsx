import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, ArrowLeft, Download, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

type Pregunta = {
  id: string;
  bloque: string;
  pregunta: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  respuesta_correcta: string;
  justificacion: string;
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

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
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
  const [step, setStep] = useState<"intro" | "exam" | "result">("intro");
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [idx, setIdx] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [intentoId, setIntentoId] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    correctas: number;
    calificacion: number;
    aprobado: boolean;
    bloque_resumen: Record<string, { correctas: number; total: number }>;
    intento_id: string;
  } | null>(null);
  const [diplomaUrl, setDiplomaUrl] = useState<string | null>(null);
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

      setLoading(false);
    })();
  }, [cursoId, user]);

  const iniciarExamen = async () => {
    if (!cursoId || !user) return;
    const { data: all, error } = await supabase
      .from("curso_evaluacion_preguntas")
      .select("*")
      .eq("curso_id", cursoId)
      .eq("activo", true);
    if (error || !all) {
      toast({ title: "Error", description: "No se pudieron cargar las preguntas.", variant: "destructive" });
      return;
    }
    const bloques = ["marco_regulatorio", "metodologia", "casos_practicos", "flujo_aprobacion"];
    const seleccion: Pregunta[] = [];
    for (const b of bloques) {
      const enBloque = (all as any[]).filter((p) => p.bloque === b);
      seleccion.push(...pickRandom(enBloque, POR_BLOQUE));
    }
    if (seleccion.length < TOTAL_PREGUNTAS) {
      toast({
        title: "Banco de preguntas incompleto",
        description: `Se requieren al menos ${POR_BLOQUE} preguntas por bloque (${TOTAL_PREGUNTAS} en total).`,
        variant: "destructive",
      });
      return;
    }

    // Crear intento
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: nuevo, error: errIns } = await supabase
      .from("curso_examen_intentos")
      .insert({
        user_id: user.id,
        org_id: (orgMember as any)?.org_id ?? null,
        curso_id: cursoId,
        num_intento: numIntentoPrevio + 1,
        preguntas_ids: seleccion.map((p) => p.id),
        total: TOTAL_PREGUNTAS,
      })
      .select()
      .single();
    if (errIns) {
      toast({ title: "Error", description: errIns.message, variant: "destructive" });
      return;
    }
    setIntentoId(nuevo.id);
    setPreguntas(seleccion);
    setRespuestas({});
    setIdx(0);
    setStep("exam");
  };

  const responder = (op: string) => {
    const p = preguntas[idx];
    setRespuestas((r) => ({ ...r, [p.id]: op }));
  };

  const correctasHasta = preguntas.slice(0, idx + 1).filter((p) => respuestas[p.id] === p.respuesta_correcta).length;

  const enviar = async () => {
    if (!intentoId) return;
    let correctas = 0;
    const bloqueRes: Record<string, { correctas: number; total: number }> = {};
    for (const p of preguntas) {
      const r = respuestas[p.id];
      const ok = r === p.respuesta_correcta;
      if (ok) correctas++;
      bloqueRes[p.bloque] = bloqueRes[p.bloque] || { correctas: 0, total: 0 };
      bloqueRes[p.bloque].total++;
      if (ok) bloqueRes[p.bloque].correctas++;
    }
    const calif = (correctas / TOTAL_PREGUNTAS) * 100;
    const aprobado = calif >= UMBRAL_APROBACION;

    await supabase
      .from("curso_examen_intentos")
      .update({
        respuestas: respuestas,
        correctas,
        calificacion: calif,
        bloque_resumen: bloqueRes,
        aprobado,
        finished_at: new Date().toISOString(),
      })
      .eq("id", intentoId);

    setResultado({ correctas, calificacion: calif, aprobado, bloque_resumen: bloqueRes, intento_id: intentoId });
    setStep("result");

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
      setDiplomaUrl(data?.download_url ?? null);
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
                <p className="text-sm text-muted-foreground">
                  Tu diploma se ha emitido automáticamente y enviamos un correo con el enlace.
                </p>
                {emitiendoDiploma && <p className="text-xs text-muted-foreground">Generando diploma…</p>}
                {diplomaUrl && (
                  <Button asChild className="w-full gap-2">
                    <a href={diplomaUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" /> Descargar diploma
                    </a>
                  </Button>
                )}
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
    const sel = respuestas[p.id];
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Pregunta {idx + 1} de {TOTAL_PREGUNTAS}</span>
          <Badge variant="secondary">Correctas hasta ahora: {correctasHasta}</Badge>
        </div>
        <Progress value={((idx + 1) / TOTAL_PREGUNTAS) * 100} className="h-2" />
        <Card>
          <CardHeader>
            <Badge variant="outline" className="w-fit text-[10px]">{BLOQUE_LABEL[p.bloque] ?? p.bloque}</Badge>
            <CardTitle className="text-base mt-2">{p.pregunta}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(["A", "B", "C", "D"] as const).map((op) => {
              const txt = (p as any)[`opcion_${op.toLowerCase()}`];
              return (
                <button
                  key={op}
                  onClick={() => responder(op)}
                  className={`w-full text-left p-3 rounded border text-sm transition ${
                    sel === op ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50"
                  }`}
                >
                  <span className="font-bold mr-2">{op}.</span>{txt}
                </button>
              );
            })}
          </CardContent>
        </Card>
        <div className="flex justify-between">
          <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
            Anterior
          </Button>
          {idx < TOTAL_PREGUNTAS - 1 ? (
            <Button disabled={!sel} onClick={() => setIdx((i) => i + 1)}>Siguiente</Button>
          ) : (
            <Button disabled={Object.keys(respuestas).length < TOTAL_PREGUNTAS} onClick={enviar}>
              Enviar examen
            </Button>
          )}
        </div>
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
                Puedes volver a descargar tu diploma desde la plataforma.
              </p>
              <Button
                className="mt-3 gap-2"
                disabled={emitiendoDiploma}
                onClick={() => emitirDiploma(yaAprobo)}
              >
                <Download className="h-4 w-4" />
                {emitiendoDiploma ? "Generando…" : "Obtener diploma"}
              </Button>
              {diplomaUrl && (
                <Button asChild variant="outline" className="ml-2 gap-2">
                  <a href={diplomaUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" /> Descargar PDF
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <>
              <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                <li>{TOTAL_PREGUNTAS} preguntas (5 por bloque temático)</li>
                <li>Se requiere {UMBRAL_APROBACION} % para aprobar y recibir el diploma</li>
                <li>Máximo {MAX_INTENTOS} intentos por curso</li>
                <li>Te quedan <strong>{intentosRestantes}</strong> intento(s)</li>
              </ul>
              <Button
                className="w-full gap-2"
                disabled={intentosRestantes <= 0}
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