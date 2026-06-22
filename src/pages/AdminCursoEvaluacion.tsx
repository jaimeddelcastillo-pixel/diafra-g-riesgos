import { useEffect, useState, useCallback } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Save, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

// Banco mínimo por bloque (anti-trampa por sorteo): se cargan 7-8 por bloque
// y el examen sortea 5 por bloque en cada intento.
const MIN_POR_BLOQUE = 7;
const POR_BLOQUE_EXAMEN = 5;
const META = MIN_POR_BLOQUE * 4; // 28
const BLOQUES = [
  { v: "marco_regulatorio", l: "Marco regulatorio" },
  { v: "metodologia", l: "Metodología" },
  { v: "casos_practicos", l: "Casos prácticos" },
  { v: "flujo_aprobacion", l: "Flujo de aprobación" },
];
const BLOQUES_SET = new Set(BLOQUES.map((b) => b.v));

type Pregunta = {
  id: string;
  curso_id: string;
  pregunta: string;
  opcion_a: string; opcion_b: string; opcion_c: string; opcion_d: string;
  respuesta_correcta: "A" | "B" | "C" | "D";
  justificacion: string;
  bloque: string;
  orden: number;
  activo: boolean;
};

export default function AdminCursoEvaluacion() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin, loading } = useAuth();
  const [cursoNorma, setCursoNorma] = useState<string>("");
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [load, setLoad] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const { data: c } = await (supabase as any).from("cursos").select("norma").eq("id", id).maybeSingle();
    setCursoNorma(c?.norma ?? "");
    const { data } = await (supabase as any)
      .from("curso_evaluacion_preguntas")
      .select("*")
      .eq("curso_id", id)
      .order("orden", { ascending: true });
    setPreguntas(data ?? []);
    setLoad(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return null;
  if (!isSuperAdmin()) return <Navigate to="/" replace />;
  if (load) return <div className="p-6 text-sm text-muted-foreground">Cargando...</div>;

  const activas = preguntas.filter((p) => p.activo).length;
  const porBloque = BLOQUES.map((b) => ({
    ...b,
    n: preguntas.filter((p) => p.activo && p.bloque === b.v).length,
  }));
  const completo = porBloque.every((b) => b.n >= MIN_POR_BLOQUE);

  const agregar = async () => {
    const nextOrden = (preguntas[preguntas.length - 1]?.orden ?? 0) + 1;
    const { error } = await (supabase as any).from("curso_evaluacion_preguntas").insert({
      curso_id: id, pregunta: "Nueva pregunta",
      opcion_a: "", opcion_b: "", opcion_c: "", opcion_d: "",
      respuesta_correcta: "A", bloque: "marco_regulatorio", orden: nextOrden,
    });
    if (error) toast.error(error.message); else { toast.success("Pregunta agregada"); fetchAll(); }
  };

  const guardar = async (p: Pregunta) => {
    const { error } = await (supabase as any).from("curso_evaluacion_preguntas").update({
      pregunta: p.pregunta, opcion_a: p.opcion_a, opcion_b: p.opcion_b,
      opcion_c: p.opcion_c, opcion_d: p.opcion_d, respuesta_correcta: p.respuesta_correcta,
      justificacion: p.justificacion, bloque: p.bloque, activo: p.activo,
    }).eq("id", p.id);
    if (error) toast.error(error.message); else toast.success("Pregunta guardada");
  };

  const eliminar = async (pid: string) => {
    if (!confirm("¿Eliminar pregunta?")) return;
    const { error } = await (supabase as any).from("curso_evaluacion_preguntas").delete().eq("id", pid);
    if (error) toast.error(error.message); else { toast.success("Eliminada"); fetchAll(); }
  };

  const upd = (pid: string, patch: Partial<Pregunta>) => {
    setPreguntas((prev) => prev.map((x) => (x.id === pid ? { ...x, ...patch } : x)));
  };

  // ─── Importador JSON / CSV ─────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [importFormat, setImportFormat] = useState<"json" | "csv">("json");
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<Array<Omit<Pregunta, "id" | "curso_id" | "orden" | "activo">> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const PLANTILLA_JSON = JSON.stringify(
    [
      {
        bloque: "marco_regulatorio",
        pregunta: "¿Qué norma sustituye a la NOM-241-SSA1-2012 a partir de 2025?",
        opcion_a: "NOM-059-SSA1-2015",
        opcion_b: "NOM-241-SSA1-2025",
        opcion_c: "ISO 13485:2016",
        opcion_d: "FEUM 12.0",
        respuesta_correcta: "B",
        justificacion: "La NOM-241-SSA1-2025 sustituye a su versión 2012 para BPF de dispositivos médicos.",
      },
    ],
    null,
    2,
  );
  const PLANTILLA_CSV =
    "bloque,pregunta,A,B,C,D,correcta,justificacion\n" +
    'marco_regulatorio,"¿Qué norma sustituye a la NOM-241-SSA1-2012?","NOM-059","NOM-241-SSA1-2025","ISO 13485","FEUM 12.0",B,"Sustituye a la versión 2012."';

  // Parser CSV con soporte de comillas dobles
  function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let cur: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else { field += c; }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") { cur.push(field); field = ""; }
        else if (c === "\n" || c === "\r") {
          if (field !== "" || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ""; }
          if (c === "\r" && text[i + 1] === "\n") i++;
        } else { field += c; }
      }
    }
    if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
    return rows.filter((r) => r.some((x) => x.trim() !== ""));
  }

  function validarItem(it: any, idx: number): string | null {
    if (!it || typeof it !== "object") return `Fila ${idx + 1}: formato inválido`;
    if (!BLOQUES_SET.has(it.bloque)) return `Fila ${idx + 1}: bloque inválido "${it.bloque}"`;
    if (!String(it.pregunta || "").trim()) return `Fila ${idx + 1}: pregunta vacía`;
    for (const k of ["opcion_a", "opcion_b", "opcion_c", "opcion_d"]) {
      if (!String(it[k] || "").trim()) return `Fila ${idx + 1}: ${k} vacía`;
    }
    if (!["A", "B", "C", "D"].includes(it.respuesta_correcta))
      return `Fila ${idx + 1}: respuesta_correcta debe ser A, B, C o D`;
    return null;
  }

  const generarPreview = () => {
    setImportError(null);
    setImportPreview(null);
    try {
      let items: any[] = [];
      if (importFormat === "json") {
        const parsed = JSON.parse(importText);
        if (!Array.isArray(parsed)) throw new Error("El JSON debe ser un arreglo");
        items = parsed;
      } else {
        const rows = parseCSV(importText);
        if (rows.length < 2) throw new Error("CSV vacío o sin filas");
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const need = ["bloque", "pregunta", "a", "b", "c", "d", "correcta", "justificacion"];
        for (const n of need) {
          if (!header.includes(n)) throw new Error(`Falta columna "${n}" en encabezado`);
        }
        const idx = (k: string) => header.indexOf(k);
        items = rows.slice(1).map((r) => ({
          bloque: r[idx("bloque")]?.trim(),
          pregunta: r[idx("pregunta")]?.trim(),
          opcion_a: r[idx("a")]?.trim(),
          opcion_b: r[idx("b")]?.trim(),
          opcion_c: r[idx("c")]?.trim(),
          opcion_d: r[idx("d")]?.trim(),
          respuesta_correcta: r[idx("correcta")]?.trim().toUpperCase(),
          justificacion: r[idx("justificacion")]?.trim() ?? "",
        }));
      }
      for (let i = 0; i < items.length; i++) {
        const err = validarItem(items[i], i);
        if (err) throw new Error(err);
      }
      // Duplicados de enunciado dentro del lote
      const enunciados = new Set<string>();
      for (let i = 0; i < items.length; i++) {
        const e = items[i].pregunta.trim().toLowerCase();
        if (enunciados.has(e)) throw new Error(`Fila ${i + 1}: pregunta duplicada`);
        enunciados.add(e);
      }
      setImportPreview(items.map((it) => ({
        bloque: it.bloque,
        pregunta: it.pregunta.trim(),
        opcion_a: it.opcion_a.trim(),
        opcion_b: it.opcion_b.trim(),
        opcion_c: it.opcion_c.trim(),
        opcion_d: it.opcion_d.trim(),
        respuesta_correcta: it.respuesta_correcta,
        justificacion: String(it.justificacion ?? "").trim(),
      })));
    } catch (e: any) {
      setImportError(e.message ?? "Error al procesar el contenido");
    }
  };

  const confirmarImport = async () => {
    if (!importPreview || !id) return;
    setImporting(true);
    try {
      if (importMode === "replace") {
        const { error: delErr } = await (supabase as any)
          .from("curso_evaluacion_preguntas")
          .delete()
          .eq("curso_id", id);
        if (delErr) throw new Error(delErr.message);
      }
      const baseOrden = importMode === "replace"
        ? 0
        : (preguntas[preguntas.length - 1]?.orden ?? 0);
      const rows = importPreview.map((p, i) => ({
        curso_id: id,
        bloque: p.bloque,
        pregunta: p.pregunta,
        opcion_a: p.opcion_a,
        opcion_b: p.opcion_b,
        opcion_c: p.opcion_c,
        opcion_d: p.opcion_d,
        respuesta_correcta: p.respuesta_correcta,
        justificacion: p.justificacion,
        orden: baseOrden + i + 1,
        activo: true,
      }));
      const { error: insErr } = await (supabase as any)
        .from("curso_evaluacion_preguntas")
        .insert(rows);
      if (insErr) throw new Error(insErr.message);
      toast.success(`${rows.length} pregunta(s) importada(s)`);
      setImportOpen(false);
      setImportText("");
      setImportPreview(null);
      setImportError(null);
      fetchAll();
    } catch (e: any) {
      setImportError(e.message ?? "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/cursos")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Volver a cursos
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Evaluación · {cursoNorma}</h1>
          <p className="text-sm text-muted-foreground">
            Banco de preguntas del examen final. En cada intento se sortean {POR_BLOQUE_EXAMEN} por bloque ({POR_BLOQUE_EXAMEN * 4} en total).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              completo
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                : "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
            }
          >
            {activas} preguntas activas · mínimo {META}
          </Badge>
          {completo ? (
            <Badge className="bg-emerald-500 text-white">Evaluación lista</Badge>
          ) : (
            <Badge variant="outline" className="border-yellow-500/40 text-yellow-700 dark:text-yellow-400">
              Faltan bloques por completar
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Importar
          </Button>
          <Button size="sm" onClick={agregar}><Plus className="h-4 w-4 mr-2" /> Agregar pregunta</Button>
        </div>
      </div>

      {/* Contador por bloque */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {porBloque.map((b) => {
          const ok = b.n >= MIN_POR_BLOQUE;
          const warn = b.n >= POR_BLOQUE_EXAMEN && b.n < MIN_POR_BLOQUE;
          const cls = ok
            ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
            : warn
              ? "border-yellow-500/40 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400"
              : "border-destructive/40 bg-destructive/5 text-destructive";
          return (
            <div key={b.v} className={`rounded border px-3 py-2 text-xs ${cls}`}>
              <div className="font-semibold">{b.l}</div>
              <div className="text-[11px] opacity-80">
                {b.n} / {MIN_POR_BLOQUE} activas {ok ? "✓" : warn ? "· faltan para sortear sin repetir" : `· faltan ${MIN_POR_BLOQUE - b.n}`}
              </div>
            </div>
          );
        })}
      </div>

      {preguntas.length === 0 && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">
          Aún no hay preguntas. Agrega la primera.
        </CardContent></Card>
      )}

      {preguntas.map((p, i) => (
        <Card key={p.id}>
          <CardHeader>
            <CardTitle className="text-base">Pregunta {i + 1}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={p.pregunta} onChange={(e) => upd(p.id, { pregunta: e.target.value })} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(["a","b","c","d"] as const).map((k) => (
                <div key={k}>
                  <Label className="text-xs">Opción {k.toUpperCase()}</Label>
                  <Input
                    value={(p as any)[`opcion_${k}`]}
                    onChange={(e) => upd(p.id, { [`opcion_${k}`]: e.target.value } as any)}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Respuesta correcta</Label>
                <Select value={p.respuesta_correcta} onValueChange={(v) => upd(p.id, { respuesta_correcta: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["A","B","C","D"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Bloque</Label>
                <Select value={p.bloque} onValueChange={(v) => upd(p.id, { bloque: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BLOQUES.map((b) => <SelectItem key={b.v} value={b.v}>{b.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={p.activo} onCheckedChange={(v) => upd(p.id, { activo: v })} />
                <Label className="text-xs">Activa</Label>
              </div>
            </div>
            <div>
              <Label className="text-xs">Justificación</Label>
              <Textarea value={p.justificacion} onChange={(e) => upd(p.id, { justificacion: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => eliminar(p.id)}>
                <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Eliminar
              </Button>
              <Button size="sm" onClick={() => guardar(p)}>
                <Save className="h-4 w-4 mr-2" /> Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}