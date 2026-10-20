import { useState } from 'react';
import { Camera, Upload, Sparkles, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import LoteFotosImporter from './LoteFotosImporter';
import { lunesDe, type Registro } from './lib/semanas';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { empresaActiva } from './lib/persistencia';

const TIPOS = ['image/png', 'image/jpeg', 'image/webp'];
const PIE: Record<string, string> = { presiones: 'en Pa', filtros: 'en Pa', temphr: 'de temperatura y humedad relativa' };

/** Tarjeta «Digitalizar bitácora» copiada de atdiafra (ImageImporter): dos zonas grandes, lote arriba a la derecha y fecha con lunes calculado.
 *  La IA solo propone; se confirma en Extracción de bitácora. */
export default function DigitalizarBitacora({ registro, nombreModulo, lunes, onLunes, disabled, onFoto, onConfirmado }: { registro: Registro; nombreModulo: string; lunes: string; onLunes: (f: string) => void; disabled: boolean; onFoto: (f: File) => void; onConfirmado: () => void }) {
  const [drag, setDrag] = useState(false);
  const [fecha, setFecha] = useState(lunes);
  const auth = useAuth();
  const verConsumo = auth.orgRole === 'admin' || auth.orgRole === 'responsable_sanitario';
  const consumo = useQuery({ queryKey: ['tend-consumo', auth.orgId], enabled: verConsumo && !!auth.orgId, queryFn: async () => { const org = await empresaActiva(); const { count, error } = await supabase.from('tend_extracciones').select('id', { count: 'exact', head: true }).eq('org_id', org); if (error) throw error; return count ?? 0; } });
  if (registro.modulo === 'agua') return null;
  const elegir = (f?: File) => { if (!f) return; if (!TIPOS.includes(f.type)) { toast.error('Solo fotos JPG, PNG o WEBP'); return; } onFoto(f); };
  const zona = 'flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 transition-colors';
  return <div className="rounded-xl border border-border bg-card p-5">
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" /> Digitalizar bitácora de {nombreModulo.toLowerCase()}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Una foto = una semana (Lunes–Domingo, 3 turnos). La IA extrae los valores escritos {PIE[registro.modulo] ?? ''}; tú revisas antes de guardar.</p>
        {verConsumo && <p className="mt-1 text-xs text-muted-foreground">Consumo de la empresa: {consumo.data ?? '…'} extracciones</p>}
      </div>
      <div className="shrink-0"><LoteFotosImporter key={registro.id} registro={registro} disabled={disabled} onConfirmado={onConfirmado} /></div>
    </div>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <label htmlFor="lunes-digitalizar" className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Semana de la foto (si la IA no lee la fecha):</label>
      <input id="lunes-digitalizar" type="date" value={fecha} disabled={disabled} onChange={e => { const v = e.target.value || lunes; setFecha(v); onLunes(v); }} className="rounded-md border border-input bg-background px-2 py-1 text-xs" />
      <span className="text-[10px] text-muted-foreground">→ lunes {lunesDe(new Date((fecha || lunes) + 'T12:00:00'))}</span>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label htmlFor="bitacora-camara" className={`${zona} border-border hover:border-primary hover:bg-primary/5 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <Camera className="mb-2 h-7 w-7 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Tomar foto</span>
        <span className="mt-0.5 text-center text-[11px] text-muted-foreground">Abre la cámara</span>
        <input id="bitacora-camara" aria-label="Tomar foto" type="file" accept="image/*" capture="environment" className="hidden" disabled={disabled} onChange={e => { elegir(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      <label htmlFor="bitacora-archivo"
        onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) elegir(e.dataTransfer.files?.[0]); }}
        className={`${zona} ${drag ? 'border-primary bg-primary/10' : 'border-border hover:border-primary hover:bg-primary/5'} ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <Upload className="mb-2 h-7 w-7 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{drag ? 'Suelta la foto aquí' : 'Subir o arrastrar archivo'}</span>
        <span className="mt-0.5 text-center text-[11px] text-muted-foreground">JPG / PNG / WEBP</span>
        <input id="bitacora-archivo" aria-label="Subir archivo de bitácora" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={disabled} onChange={e => { elegir(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
    </div>
  </div>;
}
