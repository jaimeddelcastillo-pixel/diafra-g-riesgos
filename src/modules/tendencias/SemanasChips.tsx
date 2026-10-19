// Copia del bloque de semanas de PresionesModule (atdiafra): «Semana seleccionada», «Corregir fecha» y chips «Semanas:».
// Usa las mismas operaciones auditadas de TRACEA (corregirFechaSemana / retirarCaptura con motivo).
import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { corregirFechaSemana, retirarCaptura } from './lib/persistencia';
import { lecturasCapturadas, lecturasEsperadas, lunesDe, type Registro, type Semana } from './lib/semanas';

export default function SemanasChips({ registro, lunes, semanaGuardada, puedeEditar, motivo, onLunes, onCambio, children }: {
  registro: Registro; lunes: string; semanaGuardada?: Semana; puedeEditar: boolean; motivo: string;
  onLunes: (l: string) => void; onCambio: (fecha?: string) => void; children?: React.ReactNode;
}) {
  const esTHR = registro.modulo === 'temphr';
  const [accion, setAccion] = useState<{ tipo: 'fecha' } | { tipo: 'retirar'; semana: Semana } | null>(null);
  const [fecha, setFecha] = useState('');
  const [razon, setRazon] = useState('');
  const [busy, setBusy] = useState(false);
  const semanas = registro.semanas.slice().sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio));

  const confirmar = async () => {
    if (!accion) return;
    setBusy(true);
    try {
      if (accion.tipo === 'fecha' && semanaGuardada) await corregirFechaSemana(semanaGuardada.id, fecha, razon);
      if (accion.tipo === 'retirar') await retirarCaptura('semana', accion.semana.id, razon);
      onCambio(accion.tipo === 'fecha' ? fecha : undefined);
      toast.success(accion.tipo === 'fecha' ? 'Fecha corregida' : 'Retiro conservado en historial');
      setAccion(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return <div className="space-y-3 rounded-xl border border-border bg-card p-3">
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="lunes-captura" className="mr-1 flex items-center gap-1 text-xs font-medium text-foreground"><CalendarDays className="h-3.5 w-3.5" /> Semana seleccionada:</label>
      <input id="lunes-captura" type="date" value={lunes} className="rounded-md border border-input bg-background px-2 py-1 text-xs"
        onChange={e => e.target.value && onLunes(lunesDe(new Date(e.target.value + 'T12:00:00')))} />
      {puedeEditar && semanaGuardada && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setFecha(semanaGuardada.semana_inicio); setRazon(motivo); setAccion({ tipo: 'fecha' }); }}>Corregir fecha</Button>}
      <span className="text-[10px] text-muted-foreground">Elige una semana existente, o usa «Corregir fecha» para mover ésta. Se ajusta al lunes.</span>
    </div>
    {children}
    {semanas.length > 0 && <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <span className="mr-1 text-xs font-medium text-muted-foreground">Semanas:</span>
      {semanas.map(s => {
        const cap = lecturasCapturadas(s, esTHR), esp = lecturasEsperadas(s, esTHR);
        const vacia = cap === 0, completa = esp > 0 && cap >= esp, activa = s.semana_inicio === lunes;
        return <div key={s.id} className={`inline-flex items-stretch overflow-hidden rounded-md border ${activa ? 'border-primary' : 'border-border'}`}>
          <button type="button" onClick={() => onLunes(s.semana_inicio)} className={`flex items-center gap-1.5 px-2.5 py-1 text-xs ${activa ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            <span>{s.semana_inicio}</span>
            <span className={`rounded px-1 text-[10px] ${activa ? 'bg-primary-foreground/20' : vacia ? 'bg-warning/20 text-warning' : completa ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>{vacia ? 'vacía' : completa ? '✓' : `${cap}/${esp}`}</span>
          </button>
          {puedeEditar && <button type="button" aria-label={`Retirar semana del ${s.semana_inicio}`} title={`Retirar semana del ${s.semana_inicio} (con motivo)`}
            onClick={() => { setRazon(motivo); setAccion({ tipo: 'retirar', semana: s }); }}
            className={`border-l px-1.5 text-xs ${activa ? 'border-primary-foreground/30 text-primary-foreground hover:bg-destructive' : 'border-border text-muted-foreground hover:bg-destructive hover:text-destructive-foreground'}`}>✕</button>}
        </div>;
      })}
    </div>}
    <Dialog open={!!accion} onOpenChange={v => { if (!v && !busy) setAccion(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{accion?.tipo === 'fecha' ? 'Corregir fecha de semana' : `Retirar semana del ${accion?.tipo === 'retirar' ? accion.semana.semana_inicio : ''}`}</DialogTitle></DialogHeader>
        {accion?.tipo === 'fecha' && <><Label htmlFor="corregir-fecha">Lunes correcto</Label><Input id="corregir-fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value ? lunesDe(new Date(e.target.value + 'T12:00:00')) : '')} />
          {registro.semanas.some(s => s.id !== semanaGuardada?.id && s.semana_inicio === fecha) && <p role="alert" className="text-sm text-destructive">Ya existe una semana en esa fecha.</p>}</>}
        <Label htmlFor="motivo-operacion">Motivo</Label><Input id="motivo-operacion" value={razon} onChange={e => setRazon(e.target.value)} />
        <Button disabled={busy || !razon.trim() || (accion?.tipo === 'fecha' && !fecha)} onClick={() => void confirmar()}>Confirmar</Button>
      </DialogContent>
    </Dialog>
  </div>;
}
