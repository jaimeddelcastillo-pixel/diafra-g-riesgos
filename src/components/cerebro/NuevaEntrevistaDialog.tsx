import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrainAreas, useBrainAssignments, useBrainProcesses } from "@/hooks/useBrain";
import { useProfiles } from "@/hooks/useProfiles";
import { toast } from "sonner";

const CAPAS = [
  {
    v: "vision",
    l: "Visión",
    ayuda:
      "Explora cómo funciona la organización en conjunto: estructura, responsabilidades, interacción entre áreas, prioridades y contexto general.",
  },
  {
    v: "proceso",
    l: "Proceso",
    ayuda:
      "Explora cómo se realiza realmente un proceso: actividades, responsables, controles, entradas, salidas, excepciones e interacciones.",
  },
  {
    v: "especialista",
    l: "Especialista",
    ayuda:
      "Profundiza en conocimiento técnico o regulatorio que requiere experiencia específica.",
  },
  {
    v: "documental",
    l: "Documental",
    ayuda:
      "Revisa qué está formalmente documentado: procedimientos, formatos, registros, versiones, evidencias y ubicación documental.",
  },
  {
    v: "validacion",
    l: "Validación",
    ayuda:
      "Confirma, corrige o complementa conocimiento previamente capturado por el Cerebro.",
  },
];

const NIVELES = [
  {
    v: "decisor",
    l: "Decisor",
    ayuda:
      "Tiene autoridad para establecer o aprobar decisiones sobre el dominio entrevistado.",
  },
  {
    v: "responsable",
    l: "Responsable",
    ayuda:
      "Tiene responsabilidad formal sobre el proceso o actividad y puede confirmar cómo debe gestionarse.",
  },
  {
    v: "ejecutor",
    l: "Ejecutor",
    ayuda: "Realiza directamente las actividades y conoce su operación cotidiana.",
  },
  {
    v: "consultivo",
    l: "Consultivo",
    ayuda:
      "Aporta conocimiento o experiencia, pero no tiene autoridad formal para establecer el criterio institucional.",
  },
];

const NOTA_NIVEL =
  "El nivel de autoridad no representa jerarquía organizacional. Indica el peso de esta persona respecto del conocimiento tratado en esta entrevista específicamente.";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreada: (sessionId: string) => void;
}

export function NuevaEntrevistaDialog({ open, onOpenChange, onCreada }: Props) {
  const { data: asignaciones = [] } = useBrainAssignments();
  const { data: procesos = [] } = useBrainProcesses();
  const { data: areas = [] } = useBrainAreas();
  const { data: profiles = [] } = useProfiles();

  const pendientes = useMemo(
    () => (asignaciones as any[]).filter((a) => a.estado === "pendiente" || a.estado === "sugerida"),
    [asignaciones],
  );

  const [modo, setModo] = useState<"asignacion" | "adhoc">("adhoc");
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [esInterno, setEsInterno] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [puesto, setPuesto] = useState("");
  const [area, setArea] = useState("");
  const [capa, setCapa] = useState("proceso");
  const [nivel, setNivel] = useState("responsable");
  const [procesoIds, setProcesoIds] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [razonAsignacion, setRazonAsignacion] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAssignmentId(null); setProfileId(null); setNombre(""); setPuesto("");
      setArea(""); setProcesoIds([]); setEsInterno(true); setModo("adhoc");
      setRazonAsignacion(null);
    }
  }, [open]);

  const ayudaCapa = CAPAS.find((c) => c.v === capa)?.ayuda ?? "";
  const ayudaNivel = NIVELES.find((n) => n.v === nivel)?.ayuda ?? "";

  /** Autocompleta el puesto desde profiles.cargo al elegir un miembro interno. */
  const aplicarMiembro = (id: string) => {
    setProfileId(id);
    const p = (profiles as any[]).find((x) => x.id === id);
    if (p?.cargo && !puesto.trim()) setPuesto(p.cargo);
  };

  const aplicarAsignacion = async (id: string) => {
    setAssignmentId(id);
    const a = pendientes.find((x: any) => x.id === id);
    if (!a) return;
    setProfileId(a.profile_id ?? null);
    setEsInterno(!!a.profile_id);
    setNombre(a.nombre_externo ?? "");
    const perfil = (profiles as any[]).find((p) => p.id === a.profile_id);
    setPuesto(a.puesto ?? perfil?.cargo ?? "");
    setArea((areas as any[]).find((x) => x.id === a.area_id)?.nombre ?? "");
    setRazonAsignacion(a.razon_asignacion ?? null);
    if (a.capa) setCapa(a.capa);
    if (a.nivel_autoridad) setNivel(a.nivel_autoridad);

    // Procesos sugeridos por la asignación.
    const { data: rel } = await supabase
      .from("brain_assignment_processes")
      .select("process_id")
      .eq("assignment_id", id);
    const sugeridos = (rel ?? []).map((r: any) => r.process_id).filter(Boolean);
    if (sugeridos.length > 0) {
      setProcesoIds(sugeridos);
    } else if (Array.isArray(a.dominios_conocimiento) && a.dominios_conocimiento.length > 0) {
      const dominios = (a.dominios_conocimiento as string[]).map((d) => d.toLowerCase().trim());
      setProcesoIds(
        (procesos as any[])
          .filter((p) => dominios.some((d) => (p.nombre ?? "").toLowerCase().includes(d)))
          .map((p) => p.id),
      );
    }
  };

  const toggleProceso = (id: string) =>
    setProcesoIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const crear = async () => {
    if (modo === "adhoc" && !esInterno && !nombre.trim()) {
      toast.error("Indica el nombre del entrevistado.");
      return;
    }
    if (esInterno && !profileId && modo === "adhoc") {
      toast.error("Selecciona al miembro de la organización.");
      return;
    }
    setGuardando(true);
    const { data, error } = await supabase.rpc("crear_sesion_entrevista", {
      p_assignment_id: modo === "asignacion" ? assignmentId : null,
      p_entrevistado_profile_id: esInterno ? profileId : null,
      p_entrevistado_nombre: esInterno
        ? (profiles as any[]).find((p) => p.id === profileId)?.nombre ?? null
        : nombre.trim(),
      p_entrevistado_puesto: puesto.trim() || null,
      p_entrevistado_area: area.trim() || null,
      p_capa: capa,
      p_nivel_autoridad: nivel,
      p_proceso_ids: procesoIds,
    });
    setGuardando(false);

    if (error) {
      const m = String(error.message ?? "");
      if (m.includes("trial_limit")) {
        toast.error("Llegaste al límite de entrevistas de tu plan. Contrata un plan para hacer más entrevistas.");
      } else if (m.includes("feature_inactiva")) {
        toast.error("El Cerebro Institucional no está activo para tu organización.");
      } else if (m.includes("fuera_de_org")) {
        toast.error("Los datos seleccionados no pertenecen a tu organización.");
      } else {
        toast.error("No se pudo crear la sesión de entrevista.");
      }
      return;
    }
    onOpenChange(false);
    onCreada((data as any).session_id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva entrevista</DialogTitle>
          <DialogDescription>
            Define a quién se entrevista y qué procesos cubre esta sesión.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={modo} onValueChange={(v) => setModo(v as any)}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="asignacion">Desde asignación</TabsTrigger>
            <TabsTrigger value="adhoc">Nueva entrevista</TabsTrigger>
          </TabsList>

          <TabsContent value="asignacion" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              Entrevista solicitada previamente por el Cerebro para cubrir o validar conocimiento específico.
            </p>
            {pendientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay asignaciones pendientes.</p>
            ) : (
              <div className="space-y-2">
                <Label>Asignación</Label>
                <Select value={assignmentId ?? undefined} onValueChange={aplicarAsignacion}>
                  <SelectTrigger><SelectValue placeholder="Selecciona una asignación" /></SelectTrigger>
                  <SelectContent>
                    {pendientes.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nombre_externo ?? (profiles as any[]).find((p) => p.id === a.profile_id)?.nombre ?? "Miembro interno"}
                        {a.puesto ? ` — ${a.puesto}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {razonAsignacion && (
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    <p className="text-xs font-medium">Motivo de la asignación</p>
                    <p className="text-xs text-muted-foreground">{razonAsignacion}</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="adhoc" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              Entrevista iniciada directamente con una persona, sin una asignación previa.
            </p>
            <div className="flex items-center gap-2">
              <Checkbox id="interno" checked={esInterno} onCheckedChange={(v) => setEsInterno(!!v)} />
              <Label htmlFor="interno" className="font-normal">¿Es un miembro de la organización?</Label>
            </div>
            {esInterno ? (
              <div className="space-y-2">
                <Label>Miembro</Label>
                <Select value={profileId ?? undefined} onValueChange={aplicarMiembro}>
                  <SelectTrigger><SelectValue placeholder="Selecciona a la persona" /></SelectTrigger>
                  <SelectContent>
                    {(profiles as any[]).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}{p.cargo ? ` — ${p.cargo}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="puesto">Puesto</Label>
            <Input id="puesto" value={puesto} onChange={(e) => setPuesto(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="area">Área</Label>
            <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Capa</Label>
            <Select value={capa} onValueChange={setCapa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAPAS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ayudaCapa}</p>
          </div>
          <div className="space-y-2">
            <Label>Nivel de autoridad</Label>
            <Select value={nivel} onValueChange={setNivel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NIVELES.map((n) => <SelectItem key={n.v} value={n.v}>{n.l}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ayudaNivel}</p>
            <p className="text-xs text-muted-foreground/80 italic">{NOTA_NIVEL}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Procesos a cubrir en esta entrevista</Label>
          {procesos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aún no hay procesos registrados.</p>
          ) : (
            <ScrollArea className="h-32 rounded-md border p-3">
              <div className="space-y-2">
                {(procesos as any[]).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={procesoIds.includes(p.id)} onCheckedChange={() => toggleProceso(p.id)} />
                    {p.nombre}
                  </label>
                ))}
              </div>
            </ScrollArea>
          )}
          <p className="text-xs text-muted-foreground">
            Selecciona los procesos sobre los que esta persona aportará conocimiento. Si aún no están
            definidos, podrán identificarse progresivamente durante la construcción del Cerebro.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={crear} disabled={guardando}>
            {guardando ? "Creando…" : "Iniciar entrevista"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
