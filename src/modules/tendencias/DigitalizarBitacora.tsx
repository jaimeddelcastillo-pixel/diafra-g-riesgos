import { useRef, useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import LoteFotosImporter from './LoteFotosImporter';
import type { Registro } from './lib/semanas';

const TIPOS = ['image/png', 'image/jpeg', 'image/webp'];

/** Tarjeta «Digitalizar bitácora» (paridad atdiafra): cámara, archivo/arrastre y lote. La IA solo propone; se confirma en Extracción de bitácora. */
export default function DigitalizarBitacora({ registro, nombreModulo, lunes, onLunes, disabled, onFoto, onConfirmado }: { registro: Registro; nombreModulo: string; lunes: string; onLunes: (f: string) => void; disabled: boolean; onFoto: (f: File) => void; onConfirmado: () => void }) {
  const camara = useRef<HTMLInputElement>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  if (registro.modulo === 'agua') return null;
  const elegir = (f?: File) => { if (!f) return; if (!TIPOS.includes(f.type)) { toast.error('Solo fotos JPG, PNG o WEBP'); return; } onFoto(f); };
  return <section className="space-y-3 rounded-md border p-4">
    <h3 className="font-semibold">Digitalizar bitácora de {nombreModulo}</h3>
    <div className="max-w-xs space-y-1"><Label htmlFor="lunes-digitalizar">Fecha de la semana (si la IA no la lee)</Label><Input id="lunes-digitalizar" type="date" value={lunes} disabled={disabled} onChange={e => e.target.value && onLunes(e.target.value)} /></div>
    <div className={`flex flex-wrap items-center gap-3 rounded-md border-2 border-dashed p-4 ${drag ? 'border-primary bg-accent' : 'border-border'}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) elegir(e.dataTransfer.files?.[0]); }}>
      <Button type="button" disabled={disabled} onClick={() => camara.current?.click()}><Camera className="mr-2 h-4 w-4" />Tomar foto</Button>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => archivo.current?.click()}><Upload className="mr-2 h-4 w-4" />Subir o arrastrar archivo</Button>
      <LoteFotosImporter key={registro.id} registro={registro} disabled={disabled} onConfirmado={onConfirmado} />
      <span className="text-xs text-muted-foreground">JPG, PNG o WEBP</span>
      <input ref={camara} className="sr-only" aria-label="Tomar foto" type="file" accept="image/*" capture="environment" onChange={e => { elegir(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={archivo} className="sr-only" aria-label="Subir archivo de bitácora" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { elegir(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  </section>;
}
