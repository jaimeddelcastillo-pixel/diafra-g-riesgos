import { useState } from "react";
import { Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TrazaIA } from "@/lib/skills-presentacion";

export function InformacionRespuestaIA({ skills_usadas, modelo_ia, contexto_cerebro, contexto_usado }: TrazaIA) {
  const { isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  if (!isSuperAdmin()) return null;
  const contexto = contexto_cerebro ?? (contexto_usado?.length ? { elementos: contexto_usado.length, codigos: contexto_usado.map(k => k.codigo) } : null);
  const motivos = { interruptor_apagado: "interruptor apagado", sin_modulo: "sin módulo", sin_coincidencias: "sin coincidencias", skill_sin_version: "skill sin versión", composicion_monolitica: "composición monolítica" };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"
          aria-label="Información de la respuesta IA" onMouseEnter={() => setOpen(true)}>
          <Info className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] text-xs space-y-2" align="end"
        onMouseLeave={() => setOpen(false)}>
        <p className="font-medium break-words">Modelo: {modelo_ia ?? "Sin registro"}</p>
        <p className="break-words">Contexto Cerebro: {contexto ? `${contexto.elementos} elementos${contexto.codigos.length ? ` (${contexto.codigos.join(", ")})` : contexto.motivo ? ` · ${motivos[contexto.motivo]}` : ""}` : "Sin registro"}</p>
        {skills_usadas?.length ? skills_usadas.map((s, i) => (
          <div key={`${s.clave}-${i}`} className="break-words">
            <span className="font-medium">{s.clave}</span> · v{s.version} · {s.estado ?? "Sin registro de estado"}
            <span className="block font-mono text-muted-foreground">{s.sha256?.slice(0, 8) || "Sin huella"}</span>
          </div>
        )) : <p className="text-muted-foreground">Sin registro de skills</p>}
      </PopoverContent>
    </Popover>
  );
}