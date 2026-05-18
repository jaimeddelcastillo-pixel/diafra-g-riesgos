import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getOrigenesGrupos } from "@/config/normas";

interface Props {
  /** Norma activa (de la org al crear, o del folio al editar). */
  norma: string | null | undefined;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Dropdown agrupado para "Origen del Análisis de Riesgo".
 * Adapta las opciones según la norma de la organización/folio.
 * Los títulos de sección no son seleccionables.
 */
export function OrigenAnalisisSelect({
  norma,
  value,
  onChange,
  placeholder = "Selecciona el origen del análisis",
  className,
}: Props) {
  const grupos = getOrigenesGrupos(norma);
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[336px]">
        {grupos.map((g, idx) => (
          <SelectGroup key={g.titulo}>
            {idx > 0 && <div className="my-1 h-px bg-border" />}
            <SelectLabel className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {g.titulo}
            </SelectLabel>
            {g.opciones.map((op) => (
              <SelectItem key={op} value={op} className="py-2">
                {op}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}