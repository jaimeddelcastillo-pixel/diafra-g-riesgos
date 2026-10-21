import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLES_FIRMA, type ElegiblesFirmantes, type Firmante } from './lib/formato-forval16';
import { firmantePerfil, opcionesRol, type UsuarioElegible } from './lib/firmantes-at';

export default function FirmantesAT({ firmantes, usuarios, config, autorId, editable, onChange }: {
  firmantes: Firmante[]; usuarios: UsuarioElegible[]; config?: ElegiblesFirmantes[];
  autorId?: string; editable: boolean; onChange: (firmantes: Firmante[]) => void;
}) {
  const actualizar = (index: number, f: Firmante) => onChange(firmantes.map((s, i) => i === index ? f : s));
  return <section className="border-t pt-4 space-y-4"><h2 className="font-semibold">Firmantes del AT</h2>
    {ROLES_FIRMA.map(rol => {
      const opciones = opcionesRol(rol, usuarios, config, autorId);
      const filas = firmantes.map((f, i) => ({ f, i })).filter(({ f }) => f.rol === rol);
      return <div key={rol} className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-medium">{rol}</h3>
        {editable && (rol !== 'Autorizó' || !filas.length) && <Button type="button" size="sm" variant="outline" disabled={!opciones.some(u => !filas.some(({ f }) => f.user_id === u.id))} onClick={() => {
          const u = opciones.find(u => !filas.some(({ f }) => f.user_id === u.id));
          if (u) onChange([...firmantes, firmantePerfil(rol, u)]);
        }}><Plus className="mr-2 h-4 w-4"/>Agregar {rol}</Button>}
      </div>
      {filas.map(({ f, i }) => <div key={i} className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="min-w-0 space-y-1"><Label htmlFor={`at-firmante-${i}`}>Usuario</Label><Select disabled={!editable} value={f.user_id ?? 'historico'} onValueChange={id => { const u = opciones.find(u => u.id === id); if (u) actualizar(i, firmantePerfil(rol, u)); }}>
            <SelectTrigger id={`at-firmante-${i}`} className="[&>span]:truncate"><SelectValue/></SelectTrigger><SelectContent>
              {!opciones.some(u => u.id === f.user_id) && <SelectItem value={f.user_id ?? 'historico'}>{f.nombre || 'Usuario no disponible'}</SelectItem>}
              {opciones.filter(u => u.id === f.user_id || !filas.some(({ f }) => f.user_id === u.id)).map(u => <SelectItem key={u.id} value={u.id}>{u.nombre || 'Sin nombre'} · {u.cargo?.trim() || 'Sin cargo en el perfil'}</SelectItem>)}
            </SelectContent></Select></div>
          {(['nombre', 'cargo'] as const).map(k => <div key={k} className="min-w-0 space-y-1"><Label htmlFor={`at-firmante-${i}-${k}`}>{k === 'nombre' ? 'Nombre' : 'Cargo'}</Label><Input id={`at-firmante-${i}-${k}`} disabled={!editable} value={f[k]} onChange={e => actualizar(i, { ...f, [k]: e.target.value })}/></div>)}
          {editable && <Button type="button" variant="ghost" size="icon" title="Quitar firmante" aria-label="Quitar firmante" onClick={() => onChange(firmantes.filter((_, j) => i !== j))}><Trash2 className="h-4 w-4"/></Button>}
        </div>
        {editable && usuarios.some(u => u.id === f.user_id && !u.cargo?.trim()) && <p className="text-sm text-warning">Sin cargo en el perfil</p>}
        {editable && !opciones.some(u => u.id === f.user_id) && <p role="alert" className="text-sm text-warning">Este usuario ya no es elegible para {rol}; selecciona otro.</p>}
      </div>)}
      {!filas.length && <p className="text-sm text-muted-foreground">Sin firmante seleccionado</p>}
      </div>;
    })}
  </section>;
}
