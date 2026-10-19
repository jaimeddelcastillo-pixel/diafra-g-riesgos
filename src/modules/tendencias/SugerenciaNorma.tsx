// T4c: sugiere la especificación de la norma según la clase ISO del área y la variable. La persona decide.
import { useQuery } from '@tanstack/react-query';
import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listarNormas } from './lib/persistencia';
import { sugerir, variablesDe, esCriterioInterno } from './lib/norma';
import type { Instrumento } from './lib/catalogos';

export function useNormas() {
  return useQuery({ queryKey: ['tend-normas'], queryFn: listarNormas, staleTime: 5 * 60_000 });
}

export default function SugerenciaNorma({ valores, iso, onAplicar }: {
  valores: Record<string, unknown>; iso: string | null | undefined; onAplicar: (cambios: Record<string, unknown>) => void;
}) {
  const normas = useNormas().data ?? [];
  const vars = variablesDe({ tipo: (valores.tipo as Instrumento['tipo']) ?? 'manometro_diferencial' });
  const s = sugerir(normas, iso, vars[0]);
  const hr = vars.includes('hr') ? sugerir(normas, iso, 'hr') : null;
  if (!iso) return <p className="sm:col-span-2 text-xs text-muted-foreground">Elige el área para ver la especificación de la norma.</p>;
  if (!s) return <p className="sm:col-span-2 text-xs text-muted-foreground">La norma no tiene especificación precargada para {iso}.</p>;
  const lie = valores.spec_lie as number | null | undefined, lse = valores.spec_lse as number | null | undefined;
  const interno = esCriterioInterno(s, lie === undefined || (lie as unknown) === '' ? null : Number(lie), lse === undefined || (lse as unknown) === '' ? null : Number(lse));
  return (
    <div className="sm:col-span-2 rounded-md border border-border bg-muted/30 p-3 text-sm space-y-2">
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 mt-0.5 text-primary" />
        <div className="flex-1">
          <p className="font-medium">Sugerencia {s.referencia} · {iso}: «{s.texto}»{hr ? ` · HR «${hr.texto}»` : ''}</p>
          <p className="text-xs text-muted-foreground">
            {s.sin_valor ? 'La norma no da valor numérico; la empresa define su criterio.' : `LIE ${s.lie ?? '—'}${s.lie_estricto ? ' (>)' : ''} · LSE ${s.lse ?? '—'}`}
            {s.nota ? ` · ${s.nota}` : ''}
          </p>
          {interno && <p className="text-xs text-warning mt-1">Los límites capturados son más estrictos que la norma: se guardará como «criterio interno».</p>}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onAplicar({
          spec_texto: s.texto, especificacion: s.texto, spec_lie: s.lie, spec_lse: s.lse,
          spec_lie_estricto: s.lie_estricto, spec_lse_estricto: s.lse_estricto, spec_referencia: s.referencia,
          ...(hr ? { spec_texto_hr: hr.texto, spec_lie_hr: hr.lie, spec_lse_hr: hr.lse } : {}),
          spec_criterio_interno: false,
        })}>Usar sugerencia</Button>
      </div>
    </div>
  );
}

/** Al guardar: si la empresa exige más que la norma, marca «criterio interno». */
export function marcarCriterioInterno(normas: Parameters<typeof sugerir>[0], iso: string | null | undefined, v: Record<string, unknown>): Record<string, unknown> {
  const s = sugerir(normas, iso, variablesDe({ tipo: (v.tipo as Instrumento['tipo']) ?? 'manometro_diferencial' })[0]);
  const interno = esCriterioInterno(s, v.spec_lie as number | null, v.spec_lse as number | null);
  return interno ? { ...v, spec_criterio_interno: true, spec_nota: (v.spec_nota as string) || 'criterio interno' } : v;
}
