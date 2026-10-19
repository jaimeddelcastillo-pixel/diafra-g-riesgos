// F4a: importación atdiafra → TRACEA. Solo super_admin. Vista previa sin escribir; la escritura es una sola
// transacción vía RPC tend_importar_atdiafra (si un conteo no cuadra, la base revierte todo).
import { useState } from 'react';
import JSZip from 'jszip';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { listarNormas } from '@/modules/tendencias/lib/persistencia';
import {
  vistaPrevia, aplicarExclusiones, mapearInstrumento, construirSnapshotAT, verificarConteos, construirInforme,
  TABLAS_MIGRACION, type Respaldo, type Exclusion, type VistaPrevia,
} from '@/modules/tendencias/lib/migracion-atdiafra';

export default function ImportarTendenciasCard() {
  const [org, setOrg] = useState('');
  const [respaldo, setRespaldo] = useState<Respaldo | null>(null);
  const [previa, setPrevia] = useState<VistaPrevia | null>(null);
  const [excluidas, setExcluidas] = useState<Record<string, Exclusion>>({});
  const [motivo, setMotivo] = useState('');
  const [autorizado, setAutorizado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const normas = useQuery({ queryKey: ['tend-normas'], queryFn: listarNormas });
  const orgs = useQuery({
    queryKey: ['admin-orgs-import'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('id, nombre').order('nombre');
      if (error) throw error;
      return data ?? [];
    },
  });

  const leerZip = async (file: File) => {
    const zip = await JSZip.loadAsync(file);
    const json = async (n: string) => {
      const f = zip.file(n);
      return f ? JSON.parse(await f.async('string')) : null;
    };
    const manifest = await json('manifest.json');
    if (!manifest?.tablas) throw new Error('El ZIP no tiene manifest.json válido');
    const tablas: Respaldo['tablas'] = {};
    for (const t of TABLAS_MIGRACION) tablas[t] = (await json(`${t}.json`)) ?? [];
    const fotos: Record<string, Blob> = {};
    for (const [ruta, f] of Object.entries(zip.files)) {
      if (ruta.startsWith('fotos/') && !f.dir) fotos[ruta] = await f.async('blob');
    }
    return { manifest, tablas, fotos } as Respaldo;
  };

  const alElegirArchivo = async (file: File | null) => {
    if (!file || !org) return;
    setOcupado(true);
    try {
      const r = await leerZip(file);
      const { data: correos, error: e2 } = await supabase
        .from('org_members').select('profiles(email)').eq('org_id', org);
      if (e2) throw e2;
      const lista = (correos ?? []).map((m) => String((m as { profiles?: { email?: string } }).profiles?.email ?? ''));
      setRespaldo(r);
      setPrevia(vistaPrevia(r, lista, normas.data ?? []));
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  };

  const alternarExclusion = (tabla: Exclusion['tabla'], id: string, nombre: string, marcar: boolean) => {
    setExcluidas((e) => {
      const c = { ...e };
      if (marcar) c[`${tabla}:${id}`] = { tabla, id, nombre, motivo: '' };
      else delete c[`${tabla}:${id}`];
      return c;
    });
  };

  const bloqueado = !previa || previa.usuariosFaltantes.length > 0 || previa.conteos.some((c) => !c.cuadra)
    || Object.values(excluidas).some((e) => !e.motivo.trim()) || !motivo.trim() || !autorizado.trim();

  const importar = async () => {
    if (!respaldo || !previa) return;
    setOcupado(true);
    try {
      const excl = Object.values(excluidas);
      const conteos = verificarConteos(respaldo, excl);
      const filtrado = aplicarExclusiones(respaldo, excl);
      const tablas = { ...filtrado.tablas };
      tablas.tend_instrumentos = (tablas.tend_instrumentos ?? []).map(mapearInstrumento);
      const formato = (tablas.tend_formato ?? [])[0] ?? null;
      const snapshots: string[] = [];
      tablas.tend_registros_at = (tablas.tend_registros_at ?? []).map((at) => {
        const con = construirSnapshotAT(at, tablas.tend_registros ?? [], tablas.tend_semanas ?? [], formato);
        if (String(at.estado) === 'emitido' && !at.datos_snapshot) snapshots.push(String(at.codigo));
        return con;
      });
      // Fotos: se suben al bucket de la empresa y se reescribe foto_path (guard exige prefijo de empresa).
      for (const s of tablas.tend_semanas ?? []) {
        const orig = String(s.foto_path ?? '');
        const blob = respaldo.fotos[`fotos/${orig}`] ?? respaldo.fotos[orig];
        if (!orig || !blob) continue;
        const path = `${org}/migrado/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from('tend-bitacoras').upload(path, blob, { upsert: false });
        if (error) throw error;
        s.foto_path = path;
      }
      const { data, error } = await supabase.rpc('tend_importar_atdiafra', {
        _org: org, _paquete: tablas, _conteos: conteos, _motivo: motivo.trim(), _autorizado_por: autorizado.trim(),
      });
      if (error) throw error;
      const informe = construirInforme(respaldo, excl, previa.sospechosos, snapshots);
      const url = URL.createObjectURL(new Blob([JSON.stringify(informe, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'informe-migracion-atdiafra.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Migración aplicada: ${JSON.stringify(data)}`);
      setRespaldo(null); setPrevia(null); setExcluidas({});
    } catch (e) { toast.error(`Se revirtió todo: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setOcupado(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Tendencias · Importar Análisis de Tendencias (atdiafra)</CardTitle>
        <p className="text-xs text-muted-foreground">Recibe el ZIP de respaldo (JSON por tabla, manifest.json y fotos/). Primero muestra una vista previa sin escribir nada; la importación es una sola transacción y queda en la auditoría como «Sistema / migración».</p></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={org} onValueChange={setOrg}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Empresa destino" /></SelectTrigger>
            <SelectContent>{(orgs.data ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="file" accept=".zip" className="w-64" disabled={!org || ocupado}
            onChange={(e) => alElegirArchivo(e.target.files?.[0] ?? null)} />
        </div>
        {previa && (
          <>
            <div className="rounded border p-2 text-xs">
              <p className="font-medium mb-1">Conteo por tabla contra el manifest</p>
              {previa.conteos.filter((c) => c.manifest > 0 || c.respaldo > 0).map((c) => (
                <p key={c.tabla} className={c.cuadra ? '' : 'text-destructive'}>{c.tabla}: {c.respaldo} / {c.manifest} {c.cuadra ? '✓' : '✗ no cuadra'}</p>
              ))}
            </div>
            {previa.usuariosFaltantes.length > 0 && (
              <p className="text-xs text-destructive">Usuarios sin cuenta en la empresa destino: {previa.usuariosFaltantes.join(', ')}. No se puede continuar.</p>
            )}
            <div className="rounded border p-2 text-xs max-h-48 overflow-y-auto">
              <p className="font-medium mb-1">Registros AT, registros de captura y semanas (marca «No migrar» con su motivo)</p>
              {previa.excluibles.map((x) => {
                const k = `${x.tabla}:${x.id}`;
                const ex = excluidas[k];
                return (
                  <div key={k} className="flex items-center gap-2 py-0.5">
                    <Checkbox checked={!!ex} onCheckedChange={(v) => alternarExclusion(x.tabla, x.id, x.nombre, !!v)} />
                    <span className="w-40 shrink-0">{x.tabla.replace('tend_', '')}</span>
                    <span className="flex-1">{x.nombre}</span>
                    {ex && <Input className="h-6 w-48" placeholder="Motivo" value={ex.motivo}
                      onChange={(e) => setExcluidas((c) => ({ ...c, [k]: { ...ex, motivo: e.target.value } }))} />}
                  </div>
                );
              })}
            </div>
            {previa.sospechosos.length > 0 && (
              <div className="rounded border p-2 text-xs max-h-32 overflow-y-auto">
                <p className="font-medium mb-1">Sospechosos del catálogo (mismas reglas de la Revisión del catálogo)</p>
                {previa.sospechosos.map((s) => <p key={s.codigo}>{s.codigo}: {s.hallazgos.map((h) => h.mensaje).join('; ')}</p>)}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Input className="w-64" placeholder="Motivo de la migración" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              <Input className="w-64" placeholder="Autorizó (nombre)" value={autorizado} onChange={(e) => setAutorizado(e.target.value)} />
              <Button disabled={bloqueado || ocupado} onClick={importar}>Importar en una sola transacción</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
