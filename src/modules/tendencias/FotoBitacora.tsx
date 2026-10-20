// Visor de la foto de bitácora junto a la tabla (como atdiafra): zoom y rotación sin abrir otra pestaña.
import { useEffect, useState } from 'react';
import { RotateCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { abrirFoto } from './lib/persistencia';
export default function FotoBitacora({ path }: { path: string }) {
  const [url, setUrl] = useState<string>(); const [error, setError] = useState(''); const [zoom, setZoom] = useState(1); const [rot, setRot] = useState(0);
  useEffect(() => { let vivo = true; setUrl(undefined); setError(''); setZoom(1); setRot(0); abrirFoto(path).then(u => { if (vivo) setUrl(u); }).catch(e => { if (vivo) setError(String(e)); }); return () => { vivo = false; }; }, [path]);
  const pdf = /\.pdf$/i.test(path);
  return <div className="flex flex-col rounded-xl border border-border bg-card p-3">
    <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Foto de la bitácora</h4>
      {!pdf && <div className="flex gap-1"><Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Alejar" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Acercar" onClick={() => setZoom(z => Math.min(4, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Girar" onClick={() => setRot(r => (r + 90) % 360)}><RotateCw className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Restablecer" onClick={() => { setZoom(1); setRot(0); }}><Maximize2 className="h-4 w-4" /></Button></div>}
    </div>
    <div className="relative h-[560px] overflow-auto rounded-md bg-muted">
      {error ? <p role="alert" className="p-3 text-sm text-destructive">{error}</p> : !url ? <p className="p-3 text-sm text-muted-foreground">Cargando foto…</p>
        : pdf ? <iframe title="Foto de la bitácora" src={url} className="h-full w-full" />
        : <img src={url} alt="Foto de la bitácora" className="origin-top-left transition-transform" style={{ transform: `scale(${zoom}) rotate(${rot}deg)`, transformOrigin: 'center', maxWidth: '100%' }} />}
    </div>
  </div>;
}
