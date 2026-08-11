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
import { useBrainAssignments, useBrainProcesses } from "@/hooks/useBrain";
import { useProfiles } from "@/hooks/useProfiles";
import { toast } from "sonner";

const CAPAS = [
  { v: "vision", l: "Visión" },
  { v: "proceso", l: "Proceso" },
  { v: "especialista", l: "Especialista" },
  { v: "documental", l: "Documental" },
  { v: "validacion", l: "Validación" },
];

const NIVELES = [
  { v: "decisor", l: "Decisor" },
  { v: "responsable", l: "Responsable" },
  { v: "ejecutor", l: "Ejecutor" },
  { v: "consultivo", l: "Consultivo" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreada: (sessionId: string) => void;
}

export function NuevaEntrevistaDialog({ open, onOpenChange, onCreada }: Props) {
  const { data: asignaciones = [] } = useBrainAssignments();
  const { data: procesos = [] } = useBrainProcesses();
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

  useEffect(() => {
    if (!open) {
      setAssignmentId(null); setProfileId(null); setNombre(""); setPuesto("");
      setArea(""); setProcesoIds([]); setEsInterno(true); setModo("adhoc");
    }
  }, [open]);

  const aplicarAsignacion = (id: string) => {
    setAssignmentId(id);
    const a = pendientes.find((x: any) => x.id === id);
    if (!a) return;
    setProfileId(a.profile_id ?? null);
    setEsInterno(!!a.profile_id);
    setNombre(a.nombre_externo ?? "");
    setPuesto(a.puesto ?? "");
    if (a.capa) setCapa(a.capa);
    if (a.nivel_autoridad) setNivel(a.nivel_autoridad);
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
        toast.error("Tu plan de prueba permite una sola sesión de entrevista. Contacta a tu asesor para activar tu plan.");
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
            <TabsTrigger value="adhoc">Ad hoc</TabsTrigger>
          </TabsList>

          <TabsContent value="asignacion" className="space-y-3 pt-3">
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
              </div>
            )}
          </TabsContent>

          <TabsContent value="adhoc" className="space-y-3 pt-3">
            <div className="flex items-center gap-2">
              <Checkbox id="interno" checked={esInterno} onCheckedChange={(v) => setEsInterno(!!v)} />
              <Label htmlFor="interno" className="font-normal">¿Es un miembro de la organización?</Label>
            </div>
            {esInterno ? (
              <div className="space-y-2">
                <Label>Miembro</Label>
                <Select value={profileId ?? undefined} onValueChange={setProfileId}>
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
          </div>
          <div className="space-y-2">
            <Label>Nivel de autoridad</Label>
            <Select value={nivel} onValueChange={setNivel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NIVELES.map((n) => <SelectItem key={n.v} value={n.v}>{n.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Procesos efectivos de esta sesión</Label>
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
