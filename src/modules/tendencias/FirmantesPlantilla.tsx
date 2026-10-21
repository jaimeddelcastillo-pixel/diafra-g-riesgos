import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Firmante } from './lib/formato-forval16';
import { elegirFirmante, listarUsuariosFirmantes, usuarioDelFirmante } from './lib/firmantes-empresa';

export default function FirmantesPlantilla({ firmantes, onChange, editable, orgId }: {
  firmantes: Firmante[]; onChange: (firmantes: Firmante[]) => void;
  editable: boolean; orgId: string | null | undefined;
}) {
  const usuarios = useQuery({ queryKey: ['tend-firmantes-empresa', orgId],
    queryFn: listarUsuariosFirmantes, enabled: !!orgId });
  const actualizar = (i: number, firmante: Firmante) => onChange(firmantes.map((f, j) => j === i ? firmante : f));
  return <section className="border-b pb-6 space-y-4">
    <div className="flex justify-between gap-3"><h2 className="font-semibold">Firmantes</h2>
      {editable && <Button type="button" variant="outline" size="sm" onClick={() => onChange([...firmantes, { rol: '', nombre: '', cargo: '' }])}><Plus className="mr-2 h-4 w-4"/>Agregar firmante</Button>}
    </div>
    {usuarios.error && <p role="alert" className="text-destructive">No se pudieron cargar los usuarios de la empresa.</p>}
    {firmantes.map((s, i) => <div key={i} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`firma-${i}-usuario`}>Usuario de la empresa</Label>
        <Select disabled={!editable || usuarios.isPending || !!usuarios.error}
          value={usuarioDelFirmante(s, usuarios.data ?? [])}
          onValueChange={id => { if (id !== 'manual') actualizar(i, elegirFirmante(s, id, usuarios.data ?? [])); }}>
          <SelectTrigger id={`firma-${i}-usuario`} className="w-full min-w-0 [&>span]:truncate"><SelectValue/></SelectTrigger>
          <SelectContent><SelectItem value="manual">{usuarios.isPending ? 'Cargando…' : 'Nombre y cargo actuales'}</SelectItem>
            {(usuarios.data ?? []).map(u => <SelectItem key={u.id} value={u.id}>{u.nombre || 'Sin nombre'}{u.cargo ? ` · ${u.cargo}` : ''}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_2fr_auto]">
        {(['rol', 'nombre', 'cargo'] as const).map(k => <div className="space-y-1 min-w-0" key={k}>
          <Label htmlFor={`firma-${i}-${k}`}>{k === 'rol' ? 'Rol' : k === 'nombre' ? 'Nombre' : 'Cargo'}</Label>
          <Input id={`firma-${i}-${k}`} value={s[k]} onChange={e => actualizar(i, { ...s, [k]: e.target.value })}/>
        </div>)}
        {editable && <Button type="button" variant="ghost" size="icon" aria-label="Quitar firmante" title="Quitar firmante" onClick={() => onChange(firmantes.filter((_, j) => i !== j))}><Trash2 className="h-4 w-4"/></Button>}
      </div>
    </div>)}
  </section>;
}