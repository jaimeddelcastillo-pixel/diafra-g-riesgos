// Copia de WeeklyReadingsTablePresion (atdiafra): una fila por día y turno (21 filas).
// Solo apariencia; la edición usa las mismas funciones de Captura (editar / accionDia).
import { ArrowLeft, ArrowRight, Eraser } from 'lucide-react';
import { DIAS, TURNOS, type Dia, type PuntoLectura, type Semana } from './lib/semanas';

type Campo = 'lecturas' | 'lecturas_hr';
export default function TablaLecturas({ quienPorDefecto, semana, titulo, unidad, limite, esTHR, nombreVariable, puedeEditar, fuera, alerta, editar, accion }: {
  quienPorDefecto?: string | null; semana: Semana; titulo: string; unidad: string; limite: string; esTHR: boolean; nombreVariable: string; puedeEditar: boolean;
  fuera: (campo: Campo, v: number | null) => boolean; alerta?: (p: PuntoLectura) => string | null;
  editar: (campo: Campo, dia: string, turno: string, cambio: Partial<PuntoLectura>) => void;
  accion: (dia: Dia, a: 'na' | 'limpiar' | -1 | 1) => void;
}) {
  const punto = (campo: Campo, dia: string, turno: string) => semana[campo]?.find(p => p.dia === dia && p.turno === turno);
  const celda = 'border border-border px-2 py-1';
  const valor = (campo: Campo, dia: string, turno: string, p?: PuntoLectura) => {
    const out = !p?._na && fuera(campo, p?.valor ?? null);
    const dudoso = !!p?._dudoso && !p?._edited;
    const aviso = p ? alerta?.(p) : null;
    return <td className={`${celda} ${out ? 'bg-destructive/10' : ''} ${dudoso ? 'bg-warning/10' : ''}`} title={out ? `Fuera de límite: ${limite}` : dudoso ? 'Lectura marcada de baja confianza por la IA — verifica' : aviso ?? (p?._edited ? 'Editado' : undefined)}>
      <input aria-label={`${campo === 'lecturas_hr' ? 'HR' : 'Valor'} ${dia} ${turno}`} type="number" step="any" inputMode="decimal" disabled={!puedeEditar || !!p?._na}
        value={p?.valor ?? ''} onChange={e => editar(campo, dia, turno, { valor: e.target.value === '' ? null : Number(e.target.value), ...(quienPorDefecto && !p?.quien ? { quien: quienPorDefecto } : {}) })}
        className={`w-full border-0 bg-transparent text-right font-mono text-xs ${out ? 'font-semibold text-destructive' : ''}`} />
      {aviso && <span role="alert" className="block text-[10px] text-destructive">{aviso}</span>}
    </td>;
  };
  return <div className="overflow-x-auto rounded-xl border border-border bg-card p-3">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h4 className="text-sm font-semibold">Lecturas de la semana — {titulo}</h4>
        <p className="text-[11px] text-muted-foreground">Unidad: <span className="font-mono">{unidad}</span> · Límite normativo: {limite} · 7 días × 3 turnos = 21 lecturas</p>
      </div>
      <span className="text-[10px] text-muted-foreground">Sáb/Dom marcados N/A por defecto (semana inglesa). Desmárcalos si hubo lectura.</span>
    </div>
    <table className="w-full border-collapse text-xs">
      <thead><tr className="bg-muted/40">
        <th className={`${celda} text-left`}>Día</th><th className={celda}>Turno</th><th className={celda}>Hora</th><th className={celda}>Quien</th>
        <th className={celda}>{nombreVariable} ({esTHR ? '°C' : unidad})</th>{esTHR && <th className={celda}>HR (%)</th>}<th className={celda}>N/A</th>
      </tr></thead>
      <tbody>{DIAS.map(dia => TURNOS.map((turno, t) => {
        const p = punto('lecturas', dia, turno);
        const na = !!p?._na;
        return <tr key={`${dia}-${turno}`} className={na ? 'opacity-50' : ''}>
          {t === 0 && <td rowSpan={3} className={`${celda} align-top font-medium`}>
            <div>{dia}</div>
            {puedeEditar && <div className="mt-1 flex items-center gap-0.5 text-muted-foreground">
              <button type="button" title="Mover día a la izquierda" aria-label={`Mover ${dia} a la izquierda`} disabled={dia === 'Lunes'} onClick={() => accion(dia, -1)} className="rounded p-0.5 hover:bg-muted disabled:opacity-30"><ArrowLeft className="h-3 w-3" /></button>
              <button type="button" title="Mover día a la derecha" aria-label={`Mover ${dia} a la derecha`} disabled={dia === 'Domingo'} onClick={() => accion(dia, 1)} className="rounded p-0.5 hover:bg-muted disabled:opacity-30"><ArrowRight className="h-3 w-3" /></button>
              <button type="button" title="Limpiar día" aria-label={`Limpiar ${dia}`} onClick={() => accion(dia, 'limpiar')} className="rounded p-0.5 hover:bg-muted"><Eraser className="h-3 w-3" /></button>
              <button type="button" title="Marcar el día completo como N/A" aria-label={`N/A día ${dia}`} onClick={() => accion(dia, 'na')} className="rounded px-1 text-[10px] hover:bg-muted">N/A</button>
            </div>}
          </td>}
          <td className={celda}>{turno}</td>
          <td className={celda}><input type="time" aria-label={`Hora ${dia} ${turno}`} value={p?.hora ?? ''} disabled={!puedeEditar || na} onChange={e => editar('lecturas', dia, turno, { hora: e.target.value })} className="w-full border-0 bg-transparent text-xs" /></td>
          <td className={celda}><input type="text" aria-label={`Antefirma ${dia} ${turno}`} placeholder="Iniciales" value={p?.quien ?? ''} disabled={!puedeEditar || na} onChange={e => editar('lecturas', dia, turno, { quien: e.target.value })} className="w-full border-0 bg-transparent text-xs" /></td>
          {valor('lecturas', dia, turno, p)}
          {esTHR && valor('lecturas_hr', dia, turno, punto('lecturas_hr', dia, turno))}
          <td className={`${celda} text-center`}><input type="checkbox" aria-label={`N/A ${dia} ${turno}`} checked={na} disabled={!puedeEditar} title="Marcar día/turno como No Aplica (festivo, paro, etc.)"
            onChange={e => { editar('lecturas', dia, turno, { _na: e.target.checked, valor: e.target.checked ? null : p?.valor ?? null }); if (esTHR) { const h = punto('lecturas_hr', dia, turno); editar('lecturas_hr', dia, turno, { _na: e.target.checked, valor: e.target.checked ? null : h?.valor ?? null }); } }} /></td>
        </tr>;
      }))}</tbody>
    </table>
  </div>;
}
