import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Landmark } from "lucide-react";
import { toast } from "sonner";

/** RFC: 12 (persona moral) o 13 (persona física) caracteres. Misma regla que la restricción en la base. */
export const RFC_RE = /^[A-ZÑ&]{3,4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$/;

export function DatosFiscalesCard() {
  const { orgId, orgRole, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const puedeEditar = orgRole === "admin" || orgRole === "responsable_sanitario" || isSuperAdmin();
  const puedeVer = puedeEditar;
  const [nombre, setNombre] = useState("");
  const [razon, setRazon] = useState("");
  const [rfc, setRfc] = useState("");
  const [orig, setOrig] = useState({ razon: "", rfc: "" });
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!orgId || !puedeVer) return;
    (supabase as any).from("organizations").select("nombre, razon_social, rfc").eq("id", orgId).maybeSingle()
      .then(({ data }: any) => {
        setNombre(data?.nombre ?? "");
        setRazon(data?.razon_social ?? "");
        setRfc(data?.rfc ?? "");
        setOrig({ razon: data?.razon_social ?? "", rfc: data?.rfc ?? "" });
      });
  }, [orgId, puedeVer]);

  if (!puedeVer) return null;

  const rfcNorm = rfc.trim().toUpperCase();
  const rfcValido = rfcNorm === "" || RFC_RE.test(rfcNorm);
  const cambio = razon.trim() !== orig.razon || rfcNorm !== orig.rfc;

  const guardar = async () => {
    if (!rfcValido) return toast.error("RFC inválido: 12 caracteres (persona moral) o 13 (persona física).");
    setOcupado(true);
    const { error } = await (supabase as any).from("organizations")
      .update({ razon_social: razon.trim() || null, rfc: rfcNorm || null }).eq("id", orgId);
    setOcupado(false);
    if (error) return toast.error(error.message.includes("rfc_formato") ? "RFC inválido." : error.message);
    setOrig({ razon: razon.trim(), rfc: rfcNorm });
    setRfc(rfcNorm);
    qc.invalidateQueries({ queryKey: ["pendientes-configuracion"] });
    toast.success("Datos fiscales guardados.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" /> Datos fiscales</CardTitle>
        <CardDescription>Se usan en la constancia DC-3.{!puedeEditar && " Solo el administrador o el Responsable Sanitario pueden editarlos."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 max-w-xl">
        <div>
          <Label className="text-xs">Nombre de la empresa</Label>
          <p className="text-sm font-medium">{nombre || "—"}</p>
          <p className="text-xs text-muted-foreground">Para cambiarlo, contacta a soporte TRACEA.</p>
        </div>
        <div>
          <Label htmlFor="df-razon">Razón social</Label>
          <Input id="df-razon" value={razon} disabled={!puedeEditar} onChange={(e) => setRazon(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="df-rfc">RFC</Label>
          <Input id="df-rfc" value={rfc} maxLength={13} disabled={!puedeEditar} className="font-mono uppercase"
            onChange={(e) => setRfc(e.target.value.toUpperCase())} />
          {!rfcValido && <p className="text-xs text-destructive mt-1">Formato inválido: 12 caracteres (moral) o 13 (física).</p>}
        </div>
        {puedeEditar && (
          <Button size="sm" onClick={guardar} disabled={ocupado || !cambio || !rfcValido}>Guardar</Button>
        )}
      </CardContent>
    </Card>
  );
}
