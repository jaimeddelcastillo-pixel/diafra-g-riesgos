import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CAMPOS } from "@/lib/listado-maestro/mapeo";
import type { CampoTracea, Confianza, MapeoColumna, TablaCruda } from "@/lib/listado-maestro/tipos";

const CONF_LABEL: Record<Confianza, string> = { alta: "Alta", media: "Media", baja: "Baja" };

interface Props {
  tabla: TablaCruda;
  mapeo: MapeoColumna[];
  onChange: (mapeo: MapeoColumna[]) => void;
}

export function MapeoColumnasTable({ tabla, mapeo, onChange }: Props) {
  const set = (indice: number, valor: string) => {
    const campo = valor === "__ignorar" ? null : (valor as CampoTracea);
    onChange(
      mapeo.map((m) =>
        m.indice === indice
          ? { ...m, campo, confianza: "alta" as Confianza }
          : campo && m.campo === campo
            ? { ...m, campo: null }
            : m,
      ),
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Columna del archivo</TableHead>
          <TableHead>Ejemplo</TableHead>
          <TableHead>Campo en TRACEA</TableHead>
          <TableHead className="w-24">Confianza</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mapeo.map((m) => (
          <TableRow key={m.indice}>
            <TableCell className="font-medium text-sm">{m.origen}</TableCell>
            <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
              {tabla.filas[0]?.[m.indice] ?? "—"}
            </TableCell>
            <TableCell>
              <Select value={m.campo ?? "__ignorar"} onValueChange={(v) => set(m.indice, v)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ignorar">Ignorar</SelectItem>
                  {CAMPOS.map((c) => (
                    <SelectItem key={c.campo} value={c.campo}>{c.etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              {m.campo ? <Badge variant="outline">{CONF_LABEL[m.confianza]}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
