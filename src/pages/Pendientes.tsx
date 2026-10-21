import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePendientes } from "@/hooks/usePendientes";
import { MODULO_LABEL, TIPO_LABEL, contarPendientes, type Pendiente, type ColorPendiente } from "@/lib/pendientes";
import { PuntoColor } from "@/components/pendientes/PuntoColor";
import { PendienteEnlace } from "@/components/pendientes/PendienteEnlace";
import { useSemaforoPendientes } from "@/hooks/useSemaforoPendientes";

function Lista({ datos, cargando, error }: { datos?: Pendiente[]; cargando: boolean; error: unknown }) {
  const [modulo, setModulo] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [color, setColor] = useState("todos");
  const semaforo = useSemaforoPendientes();
  const lista = datos ?? [];
  const modulos = useMemo(() => [...new Set(lista.map((p) => p.modulo))], [lista]);
  const tipos = useMemo(() => [...new Set(lista.map((p) => p.tipo))], [lista]);
  const conteo = contarPendientes(lista.filter((p) => (modulo === "todos" || p.modulo === modulo) && (tipo === "todos" || p.tipo === tipo)));
  const visibles = lista.filter((p) => (modulo === "todos" || p.modulo === modulo) && (tipo === "todos" || p.tipo === tipo) && (color === "todos" || p.color === color));
  if (cargando) return <Skeleton className="h-40" />;
  if (error) return <p role="alert" className="text-destructive">{(error as { message?: string }).message ?? "No se pudieron cargar los pendientes."}</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por urgencia">
        <Button variant={color === "todos" ? "secondary" : "outline"} size="sm" aria-pressed={color === "todos"} onClick={() => setColor("todos")}>Todos ({conteo.rojo + conteo.naranja + conteo.verde})</Button>
        {([ ["rojo", "Vencidos"], ["naranja", "Por vencer"], ["verde", "A tiempo"] ] as [ColorPendiente, string][]).map(([valor, etiqueta]) => (
          <Button key={valor} variant={color === valor ? "secondary" : "outline"} size="sm" aria-pressed={color === valor} onClick={() => setColor(valor)}><PuntoColor color={valor} /><span className="ml-2">{etiqueta} ({conteo[valor]})</span></Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Select value={modulo} onValueChange={setModulo}><SelectTrigger className="w-56" aria-label="Módulo"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos los módulos</SelectItem>{modulos.map((m) => <SelectItem key={m} value={m}>{MODULO_LABEL[m] ?? m}</SelectItem>)}</SelectContent></Select>
        <Select value={tipo} onValueChange={setTipo}><SelectTrigger className="w-56" aria-label="Tipo"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos los tipos</SelectItem>{tipos.map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t] ?? t}</SelectItem>)}</SelectContent></Select>
        <Select value={color} onValueChange={setColor}><SelectTrigger className="w-40" aria-label="Color"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos los colores</SelectItem><SelectItem value="rojo">Rojo</SelectItem><SelectItem value="naranja">Naranja</SelectItem><SelectItem value="verde">Verde</SelectItem></SelectContent></Select>
      </div>
      {!visibles.length ? <p className="text-sm text-muted-foreground">Sin pendientes.</p> : (
        <ul className="divide-y rounded-md border">
          {visibles.map((p) => (
            <li key={`${p.tipo}-${p.registro}-${p.titulo}`}>
              <PendienteEnlace pendiente={p} semaforo={semaforo.data} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConfirmarPerfil({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!abierto || !user) return;
    void supabase.from("profiles").select("nombre,cargo").eq("id", user.id).maybeSingle().then(({ data }) => {
      setNombre(data?.nombre ?? profile?.nombre ?? ""); setCargo(data?.cargo ?? "");
    });
  }, [abierto, user, profile?.nombre]);
  const guardar = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("confirmar_perfil", { _nombre: nombre, _cargo: cargo });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Perfil confirmado");
    await qc.invalidateQueries({ queryKey: ["pendientes"] });
    onCerrar();
  };
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirma tu nombre completo y tu cargo</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Mientras no lo confirmes, no podrás ser elegido como firmante.</p>
        <div className="space-y-2"><Label htmlFor="perfil-nombre">Nombre completo</Label><Input id="perfil-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="perfil-cargo">Cargo</Label><Input id="perfil-cargo" value={cargo} placeholder={cargo ? undefined : "Sin cargo en el perfil"} onChange={(e) => setCargo(e.target.value)} /></div>
        <DialogFooter><Button disabled={busy || !nombre.trim() || !cargo.trim()} onClick={() => void guardar()}>Confirmar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Pendientes() {
  const { hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const gestion = hasRole("admin") || hasRole("responsable_sanitario");
  const mio = usePendientes("mio");
  const empresa = usePendientes("empresa", gestion);
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Mis pendientes</h1>
      <Tabs defaultValue="mio">
        <TabsList>
          <TabsTrigger value="mio">Para mí ({mio.data?.length ?? 0})</TabsTrigger>
          {gestion && <TabsTrigger value="empresa">De la empresa ({empresa.data?.length ?? 0})</TabsTrigger>}
        </TabsList>
        <TabsContent value="mio"><Lista datos={mio.data} cargando={mio.isLoading} error={mio.error} /></TabsContent>
        {gestion && <TabsContent value="empresa"><Lista datos={empresa.data} cargando={empresa.isLoading} error={empresa.error} /></TabsContent>}
      </Tabs>
      <ConfirmarPerfil abierto={params.get("confirmar") === "perfil"} onCerrar={() => setParams({}, { replace: true })} />
    </div>
  );
}
