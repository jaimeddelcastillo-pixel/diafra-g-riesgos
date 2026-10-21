import { Link } from "react-router-dom";
import { MODULO_LABEL, TIPO_LABEL, plazoPendiente, type ColorPendiente, type Pendiente, type Semaforo } from "@/lib/pendientes";
import { cn } from "@/lib/utils";

const BARRA: Record<ColorPendiente, string> = { rojo: "border-l-destructive", naranja: "border-l-warning", verde: "border-l-success" };
const TEXTO: Record<ColorPendiente, string> = { rojo: "text-destructive", naranja: "text-warning", verde: "text-success" };

export function PendienteEnlace({ pendiente: p, semaforo }: { pendiente: Pendiente; semaforo?: Semaforo }) {
  const plazo = semaforo ? plazoPendiente(p, semaforo) : null;
  const etiqueta = p.color === "verde" ? "A tiempo" : !plazo ? (p.color === "rojo" ? "Vencido" : "Por vencer") : p.color === "rojo" ? `Vencido hace ${plazo.dias} días` : `Vence en ${plazo.dias} días`;
  return (
    <Link to={p.ruta} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 border-l-4 px-3 py-3 text-sm hover:bg-muted/50", BARRA[p.color])}>
      <span className="min-w-0 flex-1 basis-48 break-words">
        <span className="block font-medium">{p.titulo}</span>
        <span className="text-xs text-muted-foreground">{MODULO_LABEL[p.modulo] ?? p.modulo} · {TIPO_LABEL[p.tipo] ?? p.tipo}</span>
      </span>
      <span className={cn("text-xs font-medium", TEXTO[p.color])}>{etiqueta}</span>
    </Link>
  );
}