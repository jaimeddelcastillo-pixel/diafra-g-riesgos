import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { GraduationCap, Download, ShieldCheck, FileText, Award, Loader2, RefreshCw } from "lucide-react";
import SolicitarDC3Card from "@/components/SolicitarDC3Card";

type DiplomaRow = {
  id: string;
  folio: string;
  curso_titulo: string;
  curso_norma: string | null;
  fecha_emision: string;
  calificacion: number;
  hash_verificacion: string;
  pdf_path: string;
  intento_id: string | null;
  modulo_clave?: string | null;
};

type IntentoPendiente = {
  id: string;
  curso_id: string;
  calificacion: number;
  finished_at: string | null;
  curso_titulo?: string;
};

export default function MisDiplomas() {
  const [loading, setLoading] = useState(true);
  const [diplomas, setDiplomas] = useState<DiplomaRow[]>([]);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState<IntentoPendiente[]>([]);
  const [emitiendo, setEmitiendo] = useState<string | null>(null);
  const [regenerando, setRegenerando] = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    // P1c.1: nunca se ocultan diplomas por módulo; el módulo solo sirve para agrupar.
    const { data: cursosPropios } = await (supabase as any).rpc("mis_cursos_certificados");
    const infoCurso = new Map<string, { titulo: string; modulo_clave: string | null }>(
      ((cursosPropios ?? []) as any[]).map((c) => [c.id, { titulo: c.titulo, modulo_clave: c.modulo_clave }]),
    );
    const [dipRes, intRes] = await Promise.all([
      supabase
        .from("curso_diplomas")
        .select("id, folio, curso_titulo, curso_norma, fecha_emision, calificacion, hash_verificacion, pdf_path, curso_id, intento_id")
        .eq("user_id", user.id)
        .order("fecha_emision", { ascending: false }),
      supabase
        .from("curso_examen_intentos")
        .select("id, curso_id, calificacion, finished_at")
        .eq("user_id", user.id)
        .eq("aprobado", true)
        .order("finished_at", { ascending: false }),
    ]);
    if (dipRes.error) toast.error("No se pudieron cargar tus diplomas");
    const dips = ((dipRes.data ?? []) as Array<DiplomaRow & { curso_id: string }>).map((d) => ({
      ...d,
      modulo_clave: infoCurso.get(d.curso_id)?.modulo_clave ?? null,
    }));
    // Agrupar por módulo (orden estable), sin filtrar.
    dips.sort((x, y) => (x.modulo_clave ?? "").localeCompare(y.modulo_clave ?? ""));
    setDiplomas(dips);

    // intentos aprobados sin diploma emitido para ese curso
    const cursosConDip = new Set(dips.map((d) => d.curso_id));
    const intentos = (intRes.data ?? []) as IntentoPendiente[];
    const pend = intentos.filter((i) => !cursosConDip.has(i.curso_id));
    if (pend.length > 0) {
      const titulos = new Map(Array.from(infoCurso.entries()).map(([id, c]) => [id, c.titulo]));
      setPendientes(pend.map((p) => ({ ...p, curso_titulo: titulos.get(p.curso_id) })));
    } else {
      setPendientes([]);
    }
    setLoading(false);
  };

  useEffect(() => { void cargar(); }, []);

  const emitir = async (intentoId: string) => {
    setEmitiendo(intentoId);
    try {
      const { data, error } = await supabase.functions.invoke("emitir-diploma", {
        body: { intento_id: intentoId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`Diploma emitido: ${data?.folio ?? ""}`);
      await cargar();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo emitir el diploma");
    } finally {
      setEmitiendo(null);
    }
  };

  const regenerar = async (d: DiplomaRow) => {
    if (!d.intento_id) {
      toast.error("No se puede regenerar: falta intento asociado.");
      return;
    }
    setRegenerando(d.id);
    try {
      const { data, error } = await supabase.functions.invoke("emitir-diploma", {
        body: { intento_id: d.intento_id, force_regenerate: true },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Diploma regenerado con el diseño actualizado");
      await cargar();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo regenerar el diploma");
    } finally {
      setRegenerando(null);
    }
  };

  const descargar = async (d: DiplomaRow) => {
    setDescargando(d.id);
    try {
      const { data, error } = await supabase.storage
        .from("diplomas")
        .createSignedUrl(d.pdf_path, 60, { download: `${d.folio}.pdf` });
      if (error || !data?.signedUrl) throw error ?? new Error("No se pudo generar la descarga");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al generar la descarga");
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-[#0B2545]" />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0B2545" }}>Mis diplomas</h1>
          <p className="text-sm text-muted-foreground">
            Diplomas de aprovechamiento emitidos por TRACEA Academy. Descárgalos cuando los necesites.
          </p>
        </div>
      </div>

      {pendientes.length > 0 && (
        <Card className="border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-300">
              <Award className="h-5 w-5" /> Tienes diplomas pendientes de emisión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendientes.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 flex-wrap rounded border bg-background p-3">
                <div className="text-sm">
                  <div className="font-medium">{p.curso_titulo ?? "Curso"}</div>
                  <div className="text-xs text-muted-foreground">
                    Aprobado con {Number(p.calificacion).toFixed(0)} / 100
                  </div>
                </div>
                <Button size="sm" onClick={() => emitir(p.id)} disabled={emitiendo === p.id}>
                  {emitiendo === p.id ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Emitiendo…</>
                  ) : (
                    <><Award className="h-4 w-4 mr-1" /> Emitir mi diploma</>
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : diplomas.length === 0 && pendientes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-3">
            <FileText className="h-10 w-10 mx-auto opacity-50" />
            <p>Aún no tienes diplomas emitidos.</p>
            <Button asChild variant="outline">
              <Link to="/capacitacion">Ir a Capacitación</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {diplomas.map((d) => (
            <Card key={d.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{d.curso_titulo}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono">{d.folio}</Badge>
                      {d.curso_norma && <Badge variant="secondary">{d.curso_norma}</Badge>}
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    {Number(d.calificacion).toFixed(0)} / 100
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  Emitido el{" "}
                  {new Date(d.fecha_emision).toLocaleDateString("es-MX", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/diploma/verificar/${d.hash_verificacion}`} target="_blank">
                      <ShieldCheck className="h-4 w-4 mr-1" /> Verificar
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerar(d)}
                    disabled={regenerando === d.id || !d.intento_id}
                    title="Regenera el PDF con el diseño más reciente (conserva folio y QR)"
                  >
                    {regenerando === d.id ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Regenerando…</>
                    ) : (
                      <><RefreshCw className="h-4 w-4 mr-1" /> Regenerar</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => descargar(d)}
                    disabled={descargando === d.id}
                    style={{ backgroundColor: "#0B2545" }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    {descargando === d.id ? "Generando…" : "Descargar"}
                  </Button>
                </div>
              </CardContent>
              <CardContent className="pt-0">
                <SolicitarDC3Card diplomaId={d.id} cursoTitulo={d.curso_titulo} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}