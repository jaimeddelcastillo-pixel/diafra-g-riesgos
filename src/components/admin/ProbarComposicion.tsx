import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Norma = "NOM-241" | "NOM-059";
type VersionCorta = { id: string; nombre: string; version: string; estado: string; sha256: string | null };
type Prueba = {
  id: string; corrida_id: string; norma: string; composicion: any; referencia: any;
  respuesta: string | null; respuesta_referencia: string | null; modelo_ia: string | null;
  resultado: "pasa" | "falla" | "pendiente"; nota: string | null; evaluado_en: string | null; created_at: string;
  caso: { codigo: string; entrada: string; debe: string; no_debe: string; requiere_herramientas: boolean } | null;
};

const PIEZAS_BASE = ["plataforma", "riesgos_amef"];
const ALCANCES = ["alcance_riesgos", "alcance_cerebro", "alcance_capacitacion"];

/** «Probar composición»: corre casos sin herramientas y deja que una persona califique. */
export default function ProbarComposicion() {
  const qc = useQueryClient();
  const [norma, setNorma] = useState<Norma>("NOM-241");
  const [orgId, setOrgId] = useState<string>("");
  const [elegidas, setElegidas] = useState<Record<string, string>>({});
  const [corriendo, setCorriendo] = useState<string | null>(null);
  const [corridaSel, setCorridaSel] = useState<string | null>(null);

  const piezas = useMemo(
    () => [...PIEZAS_BASE, norma === "NOM-059" ? "norma_nom059" : "norma_nom241", ...ALCANCES],
    [norma],
  );

  const { data: orgsQA = [] } = useQuery({
    queryKey: ["orgs-qa"],
    queryFn: async () => {
      const { data } = await supabase.from("organizations").select("id, nombre").eq("es_prueba", true).order("nombre");
      return (data ?? []) as { id: string; nombre: string }[];
    },
  });

  const { data: versiones = [] } = useQuery({
    queryKey: ["ia-piezas-versiones"],
    queryFn: async () => {
      const { data } = await supabase.from("agent_prompts")
        .select("id, nombre, version, estado, sha256")
        .in("nombre", [...PIEZAS_BASE, "norma_nom241", "norma_nom059", ...ALCANCES])
        .in("estado", ["vigente", "borrador"]);
      return (data ?? []) as VersionCorta[];
    },
  });

  const { data: pruebas = [], refetch } = useQuery({
    queryKey: ["ia-skill-pruebas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ia_skill_pruebas")
        .select("*, caso:ia_skill_casos(codigo, entrada, debe, no_debe, requiere_herramientas)")
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Prueba[];
    },
  });

  const corridas = useMemo(() => {
    const m = new Map<string, Prueba[]>();
    for (const p of pruebas) m.set(p.corrida_id, [...(m.get(p.corrida_id) ?? []), p]);
    return [...m.entries()].map(([id, filas]) => ({
      id, filas: filas.sort((a, b) => ordenCodigo(a.caso?.codigo) - ordenCodigo(b.caso?.codigo)),
      norma: filas[0].norma, piezas: (filas[0].composicion?.piezas ?? []) as any[], creada: filas[0].created_at,
    }));
  }, [pruebas]);

  const versionDe = (clave: string) => elegidas[clave]
    ?? versiones.find((v) => v.nombre === clave && v.estado === "vigente")?.id
    ?? versiones.find((v) => v.nombre === clave)?.id;

  async function correrCasos() {
    if (!orgId) { toast({ title: "Elige una empresa QA", variant: "destructive" }); return; }
    const sel: Record<string, string> = {};
    for (const c of piezas) { const id = versionDe(c); if (id) sel[c] = id; }
    setCorriendo("Creando corrida…");
    const { data, error } = await supabase.functions.invoke("ia-probar-composicion", {
      body: { accion: "iniciar", norma, org_id: orgId, versiones: sel },
    });
    if (error || data?.error) {
      setCorriendo(null);
      toast({ title: "No se pudo iniciar", description: data?.error ?? error?.message, variant: "destructive" });
      return;
    }
    const corrida_id = data.corrida_id as string;
    setCorridaSel(corrida_id);
    const { data: filas } = await supabase.from("ia_skill_pruebas")
      .select("id, caso:ia_skill_casos(codigo, requiere_herramientas)").eq("corrida_id", corrida_id);
    const porCorrer = (filas ?? []).filter((f: any) => !f.caso?.requiere_herramientas);
    let hechos = 0; let fallos = 0;
    for (const f of porCorrer) {
      setCorriendo(`Corriendo ${(f as any).caso?.codigo} (${hechos + 1}/${porCorrer.length})…`);
      const r = await supabase.functions.invoke("ia-probar-composicion", { body: { accion: "correr", prueba_id: f.id } });
      if (r.error || r.data?.error) fallos++;
      hechos++;
      if (hechos % 3 === 0) void refetch();
    }
    setCorriendo(null);
    await refetch();
    qc.invalidateQueries({ queryKey: ["ia-skill-faltantes"] });
    toast({
      title: "Corrida terminada",
      description: fallos ? `${fallos} casos no se pudieron correr; vuelve a intentarlo.` : "Califica cada caso como pasa o falla.",
      variant: fallos ? "destructive" : undefined,
    });
  }

  async function calificar(p: Prueba, resultado: Prueba["resultado"], nota?: string) {
    const { error } = await supabase.from("ia_skill_pruebas")
      .update({ resultado, nota: nota ?? p.nota }).eq("id", p.id);
    if (error) { toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" }); return; }
    await refetch();
    qc.invalidateQueries({ queryKey: ["ia-skill-faltantes"] });
  }

  const corrida = corridas.find((c) => c.id === corridaSel) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Nueva corrida</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Norma</Label>
              <Select value={norma} onValueChange={(v) => setNorma(v as Norma)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOM-241">NOM-241</SelectItem>
                  <SelectItem value="NOM-059">NOM-059</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contexto de empresa QA</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue placeholder="Elige una empresa de prueba" /></SelectTrigger>
                <SelectContent>
                  {orgsQA.map((o) => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {piezas.map((clave) => {
              const opciones = versiones.filter((v) => v.nombre === clave);
              return (
                <div key={clave}>
                  <Label className="font-mono text-xs">{clave}</Label>
                  {opciones.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Sin texto (vigente o borrador).</p>
                  ) : (
                    <Select value={versionDe(clave)} onValueChange={(v) => setElegidas((e) => ({ ...e, [clave]: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {opciones.map((v) => (
                          <SelectItem key={v.id} value={v.id}>v{v.version} · {v.estado} · {v.sha256?.slice(0, 8)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Corre los casos sin herramientas; nunca escribe datos. Los casos que requieren herramientas aparecen como «Probar en un folio QA».
          </p>
          <Button onClick={() => void correrCasos()} disabled={!!corriendo}>
            {corriendo ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{corriendo}</> : "Correr casos"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Corridas</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {corridas.length === 0 && <p className="text-sm text-muted-foreground">Sin corridas todavía.</p>}
          {corridas.map((c) => {
            const pasa = c.filas.filter((f) => f.resultado === "pasa").length;
            return (
              <button
                key={c.id}
                onClick={() => setCorridaSel(c.id)}
                className={`w-full text-left border rounded-md p-2 text-sm hover:border-accent/60 ${corridaSel === c.id ? "border-accent" : ""}`}
              >
                <span className="font-medium">{c.norma}</span>
                {" · "}{new Date(c.creada).toLocaleString("es-MX")}
                {" · "}{pasa}/{c.filas.length} pasa
                <span className="block text-xs text-muted-foreground font-mono">
                  {c.piezas.map((p) => `${p.clave} v${p.version}${p.estado === "borrador" ? " (borrador)" : ""}`).join(" · ")}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {corrida && (
        <div className="space-y-3">
          {corrida.filas.map((p) => <CasoFila key={p.id} p={p} onCalificar={calificar} />)}
        </div>
      )}
    </div>
  );
}

function CasoFila({ p, onCalificar }: { p: Prueba; onCalificar: (p: Prueba, r: Prueba["resultado"], nota?: string) => void }) {
  const [nota, setNota] = useState(p.nota ?? "");
  const herramientas = p.caso?.requiere_herramientas;
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{p.caso?.codigo} · {p.caso?.entrada}</p>
            <p className="text-xs"><span className="font-medium">Debe:</span> {p.caso?.debe}</p>
            <p className="text-xs"><span className="font-medium">No debe:</span> {p.caso?.no_debe}</p>
          </div>
          <Badge variant={p.resultado === "pasa" ? "default" : p.resultado === "falla" ? "destructive" : "outline"}>
            {p.resultado}
          </Badge>
        </div>
        {herramientas ? (
          <p className="text-sm text-muted-foreground border rounded-md p-2">Probar en un folio QA y marcar a mano.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-medium mb-1">Composición nueva</p>
              <pre className="text-xs whitespace-pre-wrap border rounded-md p-2 max-h-72 overflow-y-auto">{p.respuesta ?? "Sin respuesta todavía."}</pre>
            </div>
            <div>
              <p className="text-xs font-medium mb-1">
                Vigente {p.referencia ? `${p.referencia.clave} v${p.referencia.version}` : "(sin referencia)"}
              </p>
              <pre className="text-xs whitespace-pre-wrap border rounded-md p-2 max-h-72 overflow-y-auto opacity-80">{p.respuesta_referencia ?? "—"}</pre>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Nota</Label>
            <Textarea rows={1} value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" disabled={!herramientas && !p.respuesta} onClick={() => onCalificar(p, "pasa", nota)}>Pasa</Button>
          <Button size="sm" variant="outline" disabled={!herramientas && !p.respuesta} onClick={() => onCalificar(p, "falla", nota)}>Falla</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ordenCodigo(c?: string) {
  if (!c) return 999;
  const grupo = { C: 0, D: 100, F: 200 }[c[0] as "C" | "D" | "F"] ?? 300;
  return grupo + parseInt(c.slice(1), 10);
}
