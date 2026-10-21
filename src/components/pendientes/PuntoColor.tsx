import { cn } from "@/lib/utils";
import type { ColorPendiente } from "@/lib/pendientes";

const CLASE: Record<ColorPendiente, string> = { rojo: "bg-destructive", naranja: "bg-warning", verde: "bg-success" };

export function PuntoColor({ color }: { color: ColorPendiente }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", CLASE[color])} aria-label={color} title={color} />;
}
