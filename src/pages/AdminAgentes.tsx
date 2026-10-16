import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { nombresPersonas } from "@/lib/nombresPersonas";
import { diffLineas } from "@/lib/diffLineas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, Sparkles } from "lucide-react";
import { contarEmpresasSkill, grupoSkill, textoSkillParaGuardar } from "@/lib/skills-presentacion";
import ProbarComposicion from "@/components/admin/ProbarComposicion";

type Skill = {
  clave: string; nombre: string; ambito: "plataforma" | "norma" | "modulo" | "tarea" | "alcance";
  modulo: string | null; norma: string | null; descripcion: string | null;
};
type Version = {
  id: string; nombre: string; system_prompt: string; version: string;
  estado: "borrador" | "vigente" | "retirada"; motivo_cambio: string | null;
  aprobado_por: string | null; aprobado_en: string | null; sha256: string | null;
  created_at: string;
};

/** Piezas de la composición por bloques: se publican solo con todos sus casos en «pasa». */
export const PIEZAS_CON_PRUEBAS = ["plataforma", "riesgos_amef", "norma_nom241", "norma_nom059"];

const ETIQUETA_AMBITO: Record<Skill["ambito"], string> = {
  alcance: "Alcance",
  plataforma: "Plataforma",
  norma: "Norma",
  modulo: "Módulo",
  tarea: "Tarea",
};

export default function AdminAgentes() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [clave, setClave] = useState<string | null>(null);
  const [vista, setVista] = useState<"skills" | "probar">("skills");

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ["ia-skills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ia_skills").select("*").order("clave");
      if (error) throw error;
      return (data ?? []) as Skill[];
    },
  });

  const { data: usoEmpresas } = useQuery({
    queryKey: ["ia-skills-uso-empresas"],
    enabled: isSuperAdmin(),
    queryFn: async () => {
      // Paginar para no subcontar empresas al superar el límite de la API.
      const empresas: { id: string; norma_aplicable: string | null }[] = [];
      const modos: Record<string, string> = {};
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await supabase.from("organizations")
          .select("id, norma_aplicable").order("id").range(desde, desde + 999);
        if (error) throw error;
        empresas.push(...(data ?? []));
        if ((data ?? []).length < 1000) break;
      }
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await supabase.from("ia_config_org")
          .select("org_id, composicion_riesgos").order("org_id").range(desde, desde + 999);
        if (error) throw error;
        for (const fila of data ?? []) modos[fila.org_id] = fila.composicion_riesgos;
        if ((data ?? []).length < 1000) break;
      }
      return { empresas, modos };
    },
  });

  if (!isSuperAdmin()) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          Skills de IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Instrucciones versionadas que usa la IA de TRACEA. Cada publicación queda en el historial. Solo super admin.
        </p>
      </header>

      <div className="flex gap-1.5">
        <Button size="sm" variant={vista === "skills" ? "default" : "outline"} onClick={() => setVista("skills")}>Skills</Button>
        <Button size="sm" variant={vista === "probar" ? "default" : "outline"} onClick={() => { setVista("probar"); setClave(null); }}>Probar composición</Button>
      </div>

      {vista === "probar" ? (
        <ProbarComposicion />
      ) : clave ? (
        <SkillDetalle clave={clave} onVolver={() => { setClave(null); qc.invalidateQueries({ queryKey: ["ia-skills"] }); }} />
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : (
        <div className="space-y-6">
          {(["En producción", "Bloques", "Alcances"] as const).map((grupo) => (
            <section key={grupo} className="space-y-2">
              <h2 className="text-base font-semibold">{grupo}</h2>
              {skills.filter((s) => grupoSkill(s.clave, s.ambito) === grupo).map((s) => (
                <SkillCard key={s.clave} skill={s} onAbrir={() => setClave(s.clave)}
                  empresas={usoEmpresas ? contarEmpresasSkill(s.clave, usoEmpresas.empresas, usoEmpresas.modos) : null} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillCard({ skill, onAbrir, empresas }: { skill: Skill; onAbrir: () => void; empresas: number | null }) {
  const { data: vigente } = useQuery({
    queryKey: ["ia-skill-vigente", skill.clave],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_prompts").select("version, estado, sha256, aprobado_en")
        .eq("nombre", skill.clave).eq("estado", "vigente").maybeSingle();
      return data as { version: string; estado: string; sha256: string; aprobado_en: string } | null;
    },
  });
  return (
    <Card className="cursor-pointer hover:border-accent/60 transition-colors" onClick={onAbrir}>
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">{skill.nombre}</p>
          <p className="text-sm text-muted-foreground">{skill.descripcion}</p>
          {(skill.clave === "dm" || skill.clave === "farma" || grupoSkill(skill.clave, skill.ambito) === "Bloques") && (
            <p className="text-xs text-muted-foreground">
              {skill.clave === "dm" || skill.clave === "farma" ? "Monolítica" : "Por bloques"}: la usan {empresas ?? "…"} empresas
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Badge variant="outline">{ETIQUETA_AMBITO[skill.ambito]}</Badge>
            {skill.norma && <Badge variant="outline">{skill.norma}</Badge>}
            {skill.modulo && <Badge variant="outline">{skill.modulo}</Badge>}
          </div>
        </div>
        <div className="text-right shrink-0">
          {vigente ? (
            <>
              <Badge>v{vigente.version}</Badge>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{vigente.sha256?.slice(0, 12)}…</p>
            </>
          ) : (
            <Badge variant={skill.ambito === "alcance" || PIEZAS_CON_PRUEBAS.includes(skill.clave) ? "secondary" : "destructive"}>
              Sin versión vigente
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SkillDetalle({ clave, onVolver }: { clave: string; onVolver: () => void }) {
  const qc = useQueryClient();
  const [publicar, setPublicar] = useState<null | { texto: string; version: string; baseVersion: string | null; restauracion?: boolean; conservarTexto?: boolean }>(null);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ver, setVer] = useState<Version | null>(null);
  const [diff, setDiff] = useState<{ a: Version; b: Version } | null>(null);
  const [publicarBorrador, setPublicarBorrador] = useState(false);
  const [motivoPub, setMotivoPub] = useState("");

  const { data: skill } = useQuery({
    queryKey: ["ia-skills"],
    select: (s: Skill[]) => s.find((x) => x.clave === clave),
  });
  const { data: versiones = [], isLoading } = useQuery({
    queryKey: ["ia-skill-versiones", clave],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_prompts").select("*")
        .eq("nombre", clave).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Version[];
    },
  });
  const vigente = versiones.find((v) => v.estado === "vigente");

  const ids = versiones.map((v) => v.aprobado_por).filter(Boolean) as string[];
  const { data: nombres = {} } = useQuery({
    queryKey: ["cerebro-nombres-skill", ids],
    enabled: ids.length > 0,
    queryFn: () => nombresPersonas(ids),
  });
  const quien = (id?: string | null) => (id ? (nombres as any)[id] ?? id : "—");

  const borrador = versiones.find((v) => v.estado === "borrador");
  const conPruebas = PIEZAS_CON_PRUEBAS.includes(clave);
  const { data: faltantes } = useQuery({
    queryKey: ["ia-skill-faltantes", borrador?.id, borrador?.sha256],
    enabled: !!borrador && conPruebas,
    queryFn: async () => {
      if (!borrador) return 0;
      const { data } = await supabase.rpc("ia_skill_casos_faltantes", { p_prompt_id: borrador.id });
      return (data ?? 0) as number;
    },
  });

  function refrescar() {
    qc.invalidateQueries({ queryKey: ["ia-skill-versiones", clave] });
    qc.invalidateQueries({ queryKey: ["ia-skills"] });
    qc.invalidateQueries({ queryKey: ["ia-skill-vigente", clave] });
    qc.invalidateQueries({ queryKey: ["ia-skill-faltantes"] });
  }

  /** Guarda (o actualiza) el único borrador de la skill. Devuelve su id. */
  async function guardarBorrador(texto: string, version: string, motivoCambio: string): Promise<string | null> {
    if (borrador) {
      const { error } = await supabase.from("agent_prompts")
        .update({ system_prompt: texto, version, motivo_cambio: motivoCambio || null })
        .eq("id", borrador.id);
      if (error) { toast({ title: "No se pudo guardar el borrador", description: error.message, variant: "destructive" }); return null; }
      return borrador.id;
    }
    const { data, error } = await supabase.from("agent_prompts")
      .insert({ nombre: clave, system_prompt: texto, version, estado: "borrador", motivo_cambio: motivoCambio || null })
      .select("id").single();
    if (error) { toast({ title: "No se pudo guardar el borrador", description: error.message, variant: "destructive" }); return null; }
    return data.id;
  }

  async function onGuardarBorrador(texto: string, version: string, motivoCambio: string) {
    setGuardando(true);
    const id = await guardarBorrador(texto, version, motivoCambio);
    setGuardando(false);
    if (!id) return;
    toast({ title: "Borrador guardado", description: "La IA no lo usa hasta que se publique." });
    setPublicar(null); setMotivo("");
    refrescar();
  }

  async function publicarBorradorId(id: string, motivoCambio: string) {
    const { error } = await supabase.rpc("publicar_skill", { p_prompt_id: id, p_motivo: motivoCambio });
    if (error) { toast({ title: "No se pudo publicar", description: error.message, variant: "destructive" }); return false; }
    toast({ title: "Skill publicada", description: "Quedó vigente y quedó en la bitácora." });
    return true;
  }

  async function publicarVersion(texto: string, version: string, motivoCambio: string) {
    setGuardando(true);
    const id = await guardarBorrador(texto, version, motivoCambio);
    if (id && (await publicarBorradorId(id, motivoCambio))) { setPublicar(null); setMotivo(""); }
    setGuardando(false);
    refrescar();
  }

  async function restaurar(v: Version) {
    const sugerida = siguienteVersion(versiones.map((x) => x.version));
    setPublicar({ texto: v.system_prompt, version: sugerida, baseVersion: v.version, restauracion: true });
    setMotivo(`Restaurada desde v${v.version}`);
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onVolver} className="pl-1">
        <ChevronLeft className="h-4 w-4" /> Todas las skills
      </Button>
      <div>
        <h2 className="text-lg font-semibold">{skill?.nombre ?? clave}</h2>
        <p className="text-sm text-muted-foreground">{skill?.descripcion}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando versiones…
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Historial de versiones</CardTitle>
            <div className="flex gap-1.5">
              {borrador ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => {
                    setMotivo(borrador.motivo_cambio ?? "");
                    setPublicar({ texto: borrador.system_prompt, version: borrador.version, baseVersion: vigente?.version ?? null, conservarTexto: true });
                  }}>Editar borrador</Button>
                  <Button
                    size="sm"
                    disabled={guardando || (conPruebas && (faltantes ?? 1) > 0)}
                    onClick={() => setPublicarBorrador(true)}
                  >
                    {conPruebas && (faltantes ?? 0) > 0 ? `Publicar borrador (faltan ${faltantes} casos)` : "Publicar borrador"}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setMotivo("");
                    setPublicar({
                      texto: vigente?.system_prompt ?? "",
                      version: siguienteVersion(versiones.map((v) => v.version)),
                      baseVersion: vigente?.version ?? null,
                    });
                  }}
                >
                  {conPruebas ? "Nuevo borrador" : "Publicar nueva versión"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {versiones.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin versiones todavía.</p>
            )}
            {versiones.map((v) => (
              <div key={v.id} className="border rounded-md p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={v.estado === "vigente" ? "default" : v.estado === "borrador" ? "secondary" : "outline"}>
                      v{v.version}
                    </Badge>
                    <span className="text-sm">{v.estado}</span>
                    {v.sha256 && <span className="text-xs text-muted-foreground font-mono">{v.sha256.slice(0, 12)}…</span>}
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setVer(v)}>Ver texto</Button>
                    <Button
                      size="sm" variant="outline"
                      disabled={versiones.length < 2}
                      onClick={() => {
                        const otra = versiones.find((x) => x.id !== v.id);
                        if (!otra) return;
                        setDiff(v.created_at < otra.created_at ? { a: v, b: otra } : { a: otra, b: v });
                      }}
                    >
                      Comparar
                    </Button>
                    {v.estado !== "vigente" && (
                      <Button size="sm" variant="outline" onClick={() => void restaurar(v)}>Restaurar</Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {v.motivo_cambio ?? "—"}
                  {v.aprobado_en && <> · {quien(v.aprobado_por)} · {new Date(v.aprobado_en).toLocaleString("es-MX")}</>}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Publicar nueva versión */}
      <Dialog open={!!publicar} onOpenChange={(o) => !o && setPublicar(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Publicar nueva versión</DialogTitle>
            <DialogDescription>
              {conPruebas
                ? "Esta pieza se guarda como borrador. Se publica desde su ficha cuando todos sus casos pasen en «Probar composición»."
                : "La versión vigente pasa a retirada y la nueva queda vigente. Todo queda en la bitácora."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Versión</Label>
              <Input
                className="max-w-[140px]"
                value={publicar?.version ?? ""}
                onChange={(e) => setPublicar((p) => (p ? { ...p, version: e.target.value } : p))}
              />
            </div>
            <div>
              <Label>Texto de la skill</Label>
              <Textarea
                value={publicar?.texto ?? ""}
                readOnly={!!publicar?.restauracion}
                onChange={(e) => setPublicar((p) => (p ? { ...p, texto: e.target.value, conservarTexto: false } : p))}
                className="min-h-[280px] font-mono text-xs"
              />
            </div>
            <div>
              <Label>Motivo del cambio (obligatorio)</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublicar(null)}>Cancelar</Button>
            <Button
              variant="secondary"
              disabled={guardando || !publicar?.texto?.trim() || !publicar?.version?.trim()}
              onClick={() => {
                if (!publicar) return;
                void onGuardarBorrador(textoSkillParaGuardar(publicar.texto, !!(publicar.restauracion || publicar.conservarTexto)), publicar.version.trim(), motivo.trim());
              }}
            >
              Guardar borrador
            </Button>
            {!conPruebas && (
              <Button
                disabled={guardando || !publicar?.texto?.trim() || !publicar?.version?.trim() || !motivo.trim()}
                onClick={() => {
                  if (!publicar) return;
                  void publicarVersion(textoSkillParaGuardar(publicar.texto, !!(publicar.restauracion || publicar.conservarTexto)), publicar.version.trim(), motivo.trim());
                }}
              >
                {guardando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Publicar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publicar borrador */}
      <Dialog open={publicarBorrador} onOpenChange={(o) => { if (!o) { setPublicarBorrador(false); setMotivoPub(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publicar borrador v{borrador?.version}</DialogTitle>
            <DialogDescription>
              La versión vigente pasa a retirada y el borrador queda vigente. Huella {borrador?.sha256?.slice(0, 16)}…
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Motivo del cambio (obligatorio)</Label>
            <Textarea value={motivoPub} onChange={(e) => setMotivoPub(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublicarBorrador(false)}>Cancelar</Button>
            <Button
              disabled={guardando || !motivoPub.trim()}
              onClick={async () => {
                if (!borrador) return;
                setGuardando(true);
                const ok = await publicarBorradorId(borrador.id, motivoPub.trim());
                setGuardando(false);
                if (ok) { setPublicarBorrador(false); setMotivoPub(""); }
                refrescar();
              }}
            >Publicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ver texto */}
      <Dialog open={!!ver} onOpenChange={(o) => !o && setVer(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>v{ver?.version} · {ver?.estado}</DialogTitle>
            <DialogDescription>
              {ver?.motivo_cambio ?? "—"}
              {ver?.aprobado_en && <> · {quien(ver.aprobado_por)} · {new Date(ver.aprobado_en).toLocaleString("es-MX")}</>}
              {ver?.sha256 && <> · Huella {ver.sha256.slice(0, 16)}…</>}
            </DialogDescription>
          </DialogHeader>
          <pre className="text-xs font-mono whitespace-pre-wrap border rounded-md p-3 max-h-[55vh] overflow-y-auto">
            {ver?.system_prompt}
          </pre>
        </DialogContent>
      </Dialog>

      {/* Comparar dos versiones */}
      <Dialog open={!!diff} onOpenChange={(o) => !o && setDiff(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comparación v{diff?.a.version} → v{diff?.b.version}</DialogTitle>
            <DialogDescription>Rojo: se quitó. Verde: se agregó.</DialogDescription>
          </DialogHeader>
          <div className="border rounded-md p-3 max-h-[55vh] overflow-y-auto font-mono text-xs space-y-0.5">
            {diff && diffLineas(diff.a.system_prompt, diff.b.system_prompt).map((l, idx) => (
              <div key={idx} className={
                l.tipo === "agregada" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : l.tipo === "eliminada" ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "opacity-60"
              }>
                {l.tipo === "agregada" ? "+ " : l.tipo === "eliminada" ? "- " : "  "}{l.texto}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Sugiere la siguiente versión etiqueta (v3.0 → 3.1; sin numeración → 1.1). */
function siguienteVersion(etiquetas: string[]): string {
  const vigentes = etiquetas
    .map((e) => e.split(".").map((n) => parseInt(n, 10)))
    .filter((p) => p.length === 2 && p.every((n) => !Number.isNaN(n)));
  if (!vigentes.length) return "1.1";
  const mayor = vigentes.sort((a, b) => b[0] - a[0] || b[1] - a[1])[0];
  return `${mayor[0]}.${mayor[1] + 1}`;
}
