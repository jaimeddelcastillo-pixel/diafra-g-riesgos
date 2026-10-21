import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLES_FIRMA, type ElegiblesFirmantes, type Firmante } from './lib/formato-forval16';
import { listarElegibles } from './lib/firmantes-at';

export default function FirmantesPlantilla({ firmantes, elegibles, onChange, editable, orgId }: {
  firmantes: Firmante[]; elegibles?: ElegiblesFirmantes[];
  onChange: (elegibles: ElegiblesFirmantes[]) => void;
  editable: boolean; orgId: string | null | undefined;
}) {
  const usuarios = useQuery({ queryKey: ['tend-elegibles', orgId], queryFn: listarElegibles, enabled: !!orgId, refetchInterval: 15000 });
  const cambiar = (r: ElegiblesFirmantes) => onChange(ROLES_FIRMA.map(rol => rol === r.rol ? r : elegibles?.find(c => c.rol === rol) ?? { rol, user_ids: [] }));
  return <section className="border-b pb-6 space-y-4"><h2 className="font-semibold">Firmantes</h2>
    {elegibles === undefined ? <>
      {firmantes.map((f, i) => <p key={i} className="text-sm">{f.rol} · {f.nombre} · {f.cargo}</p>)}
      {editable && <Button type="button" variant="outline" onClick={() => onChange(ROLES_FIRMA.map(rol => ({ rol, user_ids: [] })))}>Configurar elegibles por rol</Button>}
    </> : ROLES_FIRMA.map(rol => {
      const r = elegibles.find(c => c.rol === rol) ?? { rol, user_ids: [] };
      const opciones = (usuarios.data ?? []).filter(u => rol !== 'Autorizó' || u.puede_autorizar);
      const noDisponibles = r.user_ids.filter(id => !opciones.some(u => u.id === id));
      return <div key={rol} className="space-y-3 border-t pt-4">
        <h3 className="font-medium">{rol}</h3>
        <div className="grid gap-2 sm:grid-cols-2">{opciones.map(u => <Label key={u.id} className="flex items-start gap-2 text-sm">
          <Checkbox disabled={!editable} checked={r.user_ids.includes(u.id)} onCheckedChange={checked => cambiar({ ...r, user_ids: checked ? [...r.user_ids, u.id] : r.user_ids.filter(id => id !== u.id), ...(r.default_user_id === u.id && !checked ? { default_user_id: undefined } : {}) })}/>
          <span>{u.nombre || 'Sin nombre'} · {u.cargo?.trim() || 'Sin cargo en el perfil'}</span>
        </Label>)}</div>
        {noDisponibles.map(id => <div key={id} className="flex items-center gap-2 text-sm text-warning"><span>Usuario no disponible para {rol}</span>{editable && <Button type="button" variant="outline" size="sm" onClick={() => cambiar({ ...r, user_ids: r.user_ids.filter(u => u !== id), ...(r.default_user_id === id ? { default_user_id: undefined } : {}) })}>Quitar de elegibles</Button>}</div>)}
        {!opciones.length && !usuarios.isPending && <p className="text-sm text-muted-foreground">Sin usuarios elegibles para {rol}</p>}
        <div className="space-y-1 max-w-md"><Label>Usuario por defecto (opcional)</Label>
          <Select disabled={!editable || usuarios.isPending} value={r.default_user_id ?? 'ninguno'} onValueChange={id => cambiar({ ...r, default_user_id: id === 'ninguno' ? undefined : id })}>
            <SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ninguno">Sin predeterminado</SelectItem>{opciones.filter(u => r.user_ids.includes(u.id)).map(u => <SelectItem key={u.id} value={u.id}>{u.nombre || 'Sin nombre'} · {u.cargo?.trim() || 'Sin cargo en el perfil'}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>;
    })}
    {usuarios.error && <p role="alert" className="text-destructive">No se pudieron cargar los usuarios elegibles de la empresa.</p>}
  </section>;
}
