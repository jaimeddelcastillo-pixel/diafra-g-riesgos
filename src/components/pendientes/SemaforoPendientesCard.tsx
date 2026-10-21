import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SEMAFORO_DEFECTO, type Semaforo } from "@/lib/pendientes";

const CAMPOS: { k: keyof Semaforo; label: string }[] = [
  { k: "operativo_naranja", label: "Operativo: naranja desde (días)" },
  { k: "operativo_rojo", label: "Operativo: rojo desde (días)" },
  { k: "gestion_naranja", label: "Gestión: naranja desde (días)" },
  { k: "gestion_rojo", label: "Gestión: rojo desde (días)" },
];

export function SemaforoPendientesCard() {
  const { org } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["semaforo-pendientes", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("org_pendientes_semaforo").select("operativo_naranja,operativo_rojo,gestion_naranja,gestion_rojo").eq("org_id", org!.id).maybeSingle();
      if (error) throw error;
      return (data ?? SEMAFORO_DEFECTO) as Semaforo;
    },
  });
  const [v, setV] = useState<Semaforo>(SEMAFORO_DEFECTO);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setV(q.data); }, [q.data]);
  const valido = v.operativo_naranja >= 1 && v.operativo_rojo > v.operativo_naranja && v.gestion_naranja >= 1 && v.gestion_rojo > v.gestion_naranja;
  const guardar = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("guardar_semaforo_pendientes", { _operativo_naranja: v.operativo_naranja, _operativo_rojo: v.operativo_rojo, _gestion_naranja: v.gestion_naranja, _gestion_rojo: v.gestion_rojo });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Semáforo guardado");
    await qc.invalidateQueries({ queryKey: ["semaforo-pendientes"] });
    await qc.invalidateQueries({ queryKey: ["pendientes"] });
  };
  return (
    <Card id="semaforo-pendientes" className="scroll-mt-20">
      <CardHeader><CardTitle className="text-base">Semáforo de pendientes</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Días naturales desde que nace el pendiente. Antes del naranja es verde; una fecha límite vencida siempre es rojo.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CAMPOS.map(({ k, label }) => (
            <div key={k} className="space-y-1"><Label htmlFor={`sem-${k}`}>{label}</Label>
              <Input id={`sem-${k}`} type="number" min={1} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} /></div>
          ))}
        </div>
        {!valido && <p className="text-sm text-destructive">El rojo debe ser mayor que el naranja y ambos al menos 1.</p>}
        <Button disabled={busy || !valido} onClick={() => void guardar()}>Guardar semáforo</Button>
      </CardContent>
    </Card>
  );
}
