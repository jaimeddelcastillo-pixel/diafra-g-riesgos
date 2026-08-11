import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ClasificacionRegistro, RegistroClasificado } from "@/lib/listado-maestro/tipos";

export type DecisionPropuesta = "crear" | "vincular" | "pendiente" | "descartar";

export interface PropuestaUI {
  nombre: string;
  evidencia?: string;
  nivel_confianza: "explicito" | "inferido";
  decision: DecisionPropuesta;
  vinculo_id?: string;
}

const ETIQUETA: Record<ClasificacionRegistro, string> = {
  nuevo: "Nuevo",
  posible_actualizacion: "Posible actualización",
  posible_duplicado: "Posible duplicado",
  requiere_revision: "Requiere revisión",
};

interface Props {
  registros: RegistroClasificado[];
  areas: PropuestaUI[];
  procesos: PropuestaUI[];
  areasExistentes: { id: string; nombre: string }[];
  procesosExistentes: { id: string; nombre: string }[];
  onAreas: (v: PropuestaUI[]) => void;
  onProcesos: (v: PropuestaUI[]) => void;
}

function Propuestas({
  titulo, items, existentes, opciones, onChange, nota,
}: {
  titulo: string;
  items: PropuestaUI[];
  existentes: { id: string; nombre: string }[];
  opciones: { v: DecisionPropuesta; l: string }[];
  onChange: (v: PropuestaUI[]) => void;
  nota?: string;
}) {
  if (items.length === 0) return null;
  const set = (i: number, patch: Partial<PropuestaUI>) =>
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
      <div className="space-y-2">
        {items.map((p, i) => (
          <div key={`${p.nombre}-${i}`} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{p.nombre}</p>
                {p.evidencia && (
                  <p className="text-xs text-muted-foreground">Origen: {p.evidencia}</p>
                )}
              </div>
              <Badge variant="outline">{p.nivel_confianza === "explicito" ? "Explícito" : "Inferido"}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={p.decision} onValueChange={(v) => set(i, { decision: v as DecisionPropuesta, vinculo_id: undefined })}>
                <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {opciones.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                </SelectContent>
              </Select>
              {p.decision === "vincular" && (
                <Select value={p.vinculo_id} onValueChange={(v) => set(i, { vinculo_id: v })}>
                  <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Selecciona existente" /></SelectTrigger>
                  <SelectContent>
                    {existentes.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PreviewImportacion({
  registros, areas, procesos, areasExistentes, procesosExistentes, onAreas, onProcesos,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Registros detectados ({registros.length})</h3>
        <ScrollArea className="h-64 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Fila</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-20">Rev.</TableHead>
                <TableHead>Clasificación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.map((r) => (
                <TableRow key={`${r.fila}-${r.nombre}`}>
                  <TableCell className="text-xs text-muted-foreground">{r.fila}</TableCell>
                  <TableCell className="text-xs">{r.codigo ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.nombre}</TableCell>
                  <TableCell className="text-xs">{r.revision ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.clasificacion === "nuevo" ? "outline" : "secondary"}>
                      {ETIQUETA[r.clasificacion]}
                    </Badge>
                    {r.motivo && <p className="text-[11px] text-muted-foreground mt-1">{r.motivo}</p>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <Propuestas
        titulo="Áreas detectadas"
        items={areas}
        existentes={areasExistentes}
        opciones={[
          { v: "crear", l: "Crear área" },
          { v: "vincular", l: "Vincular existente" },
          { v: "descartar", l: "No importar" },
        ]}
        onChange={onAreas}
      />

      <Propuestas
        titulo="Procesos candidatos"
        items={procesos}
        existentes={procesosExistentes}
        nota="Proceso inferido del título del documento. Requiere revisión antes de considerarse parte del mapa institucional."
        opciones={[
          { v: "crear", l: "Crear proceso" },
          { v: "vincular", l: "Vincular existente" },
          { v: "pendiente", l: "Dejar pendiente" },
          { v: "descartar", l: "Descartar" },
        ]}
        onChange={onProcesos}
      />
    </div>
  );
}
