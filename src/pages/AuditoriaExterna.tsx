import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ClipboardCheck, FileText, Brain, ShieldAlert, LogOut, Download, Eye, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuditorExpedientes, type ItemExpediente } from "@/hooks/useAuditorExpedientes";
import { abrirArchivoAuditor, descargarFolioAuditor } from "@/lib/auditoriaDescargas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const fmtFecha = (d?: string | null, hora = false) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleString("es-MX", hora
    ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }) : "—";

const GRUPOS: { tipo: ItemExpediente["tipo"]; titulo: string; icon: any }[] = [
  { tipo: "folio", titulo: "Folios", icon: ShieldAlert },
  { tipo: "documento", titulo: "Documentos", icon: FileText },
  { tipo: "conocimiento", titulo: "Conocimientos", icon: Brain },
];

function Campo({ label, valor }: { label: string; valor: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap break-words">{valor === null || valor === undefined || valor === "" ? "—" : String(valor)}</p>
    </div>
  );
}

function useAccion() {
  const { toast } = useToast();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const correr = async (clave: string, fn: () => Promise<unknown>) => {
    setOcupado(clave);
    try { await fn(); } catch (e: any) {
      toast({ title: "No se pudo completar", description: e.message, variant: "destructive" });
    } finally { setOcupado(null); }
  };
  return { ocupado, correr };
}

function VisorFolio({ itemId, d, permiteDescarga }: { itemId: string; d: any; permiteDescarga: boolean }) {
  const f = d.folio;
  const { ocupado, correr } = useAccion();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{f.codigo}</h2>
          <p className="text-sm text-muted-foreground">{f.proceso_equipo}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{f.estado}</Badge>
          <Badge variant="secondary">Versión {f.numero_version || "1.0"}</Badge>
          {permiteDescarga && (
            <Button size="sm" disabled={!!ocupado} onClick={() => correr("pdf", () => descargarFolioAuditor(itemId, d))}>
              <Download className="h-4 w-4 mr-1" /> {ocupado === "pdf" ? "Generando…" : "PDF"}
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Campo label="Tipo" valor={f.tipo_folio} />
        <Campo label="Norma" valor={f.norma_folio} />
        <Campo label="Metodología" valor={f.metodologia_folio} />
        <Campo label="Origen" valor={f.origen} />
        <Campo label="Inicio" valor={fmtFecha(f.fecha_inicio)} />
        <Campo label="Cierre" valor={fmtFecha(f.fecha_cierre)} />
      </div>
      <Campo label="Alcance" valor={f.alcance} />
      <Campo label="Justificación técnica" valor={f.justificacion_tecnica} />
      <Campo label="Conclusión" valor={f.conclusion} />
      <Campo label="Riesgo residual global" valor={f.riesgo_residual_global} />

      <section>
        <h3 className="text-sm font-semibold mb-2">Riesgos ({d.riesgos.length})</h3>
        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>{["ID", "Etapa", "Modo de falla / peligro", "Efecto", "S", "O", "D", "NPR", "Controles", "Acción", "NPR res.", "Dictamen"].map((h) => (
                <th key={h} className="text-left p-2 font-medium">{h}</th>))}</tr>
            </thead>
            <tbody>
              {d.riesgos.map((r: any) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2">{r.numero_id}</td>
                  <td className="p-2">{r.etapa_proceso}</td>
                  <td className="p-2">{r.peligro_modo_falla || r.peligro}</td>
                  <td className="p-2">{r.efecto_dano}</td>
                  <td className="p-2">{r.severidad}</td>
                  <td className="p-2">{r.ocurrencia}</td>
                  <td className="p-2">{r.detectabilidad_aplicable === false ? "—" : r.deteccion}</td>
                  <td className="p-2 font-semibold">{r.npr}</td>
                  <td className="p-2">{r.controles_actuales || [r.controles_prevencion, r.controles_deteccion].filter(Boolean).join(" / ")}</td>
                  <td className="p-2">{r.accion_propuesta}</td>
                  <td className="p-2">{r.npr_residual}</td>
                  <td className="p-2">{r.dictamen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Comité y firmas</h3>
        <div className="space-y-2">
          {d.comite.length === 0 && <p className="text-sm text-muted-foreground">Sin integrantes registrados.</p>}
          {d.comite.map((c: any) => (
            <div key={c.id} className="border rounded-md p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{c.nombre} <span className="text-muted-foreground font-normal">· {c.cargo}</span></span>
                <Badge variant={c.firmado ? "default" : "outline"}>{c.firmado ? `Firmó ${fmtFecha(c.fecha_firma)}` : "Sin firma"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Responsabilidad: {c.responsabilidad || "—"}</p>
              {c.texto_compromiso && <p className="text-xs mt-1">Significado de la firma: {c.texto_compromiso}</p>}
            </div>
          ))}
          {d.votos.length > 0 && (
            <div className="text-xs text-muted-foreground pt-1">
              Votos: {d.votos.map((v: any) => `${v.persona ?? "—"}: ${v.voto}`).join(" · ")}
            </div>
          )}
        </div>
      </section>

      {d.versiones.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2">Historial de versiones</h3>
          <ul className="text-sm space-y-1">
            {d.versiones.map((v: any, i: number) => (
              <li key={i}>v{v.version} · {fmtFecha(v.created_at)} · {v.motivo_revision || "—"} · {v.realizado_por || "—"}</li>
            ))}
          </ul>
        </section>
      )}

      {Array.isArray(d.evidencias) && (
        <section>
          <h3 className="text-sm font-semibold mb-2">Evidencias ({d.evidencias.length})</h3>
          <ul className="space-y-1">
            {d.evidencias.map((e: any) => (
              <li key={e.path} className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2">
                <span className="truncate">Riesgo {e.riesgo_numero} · {e.nombre}</span>
                {(!e.es_pdf || permiteDescarga) && (
                  <Button size="sm" variant="outline" disabled={!!ocupado}
                    onClick={() => correr(e.path, () => abrirArchivoAuditor(itemId, e.nombre, e.path))}>
                    {e.es_pdf ? <><Download className="h-4 w-4 mr-1" />Descargar</> : <><Eye className="h-4 w-4 mr-1" />Ver</>}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function VisorDocumento({ itemId, d, permiteDescarga }: { itemId: string; d: any; permiteDescarga: boolean }) {
  const { ocupado, correr } = useAccion();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{d.registro?.codigo ? `${d.registro.codigo} · ` : ""}{d.nombre}</h2>
        {(!d.es_pdf || permiteDescarga) && (
          <Button size="sm" disabled={!!ocupado} onClick={() => correr("doc", () => abrirArchivoAuditor(itemId, d.nombre_archivo || d.nombre))}>
            {d.es_pdf ? <><Download className="h-4 w-4 mr-1" />Descargar copia</> : <><Eye className="h-4 w-4 mr-1" />Ver</>}
          </Button>
        )}
      </div>
      {d.copia_no_controlada && <Badge variant="destructive">Copia no controlada</Badge>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Campo label="Código" valor={d.registro?.codigo} />
        <Campo label="Revisión" valor={d.registro?.revision ?? d.version} />
        <Campo label="Estado" valor={d.registro?.estado ?? (d.retirado_en ? "Retirado" : null)} />
        <Campo label="Clasificación" valor={d.clasificacion} />
        <Campo label="Tipo" valor={d.tipo} />
        <Campo label="Archivo" valor={d.nombre_archivo} />
      </div>
      <Campo label="Huella SHA-256" valor={d.sha256} />
      {!d.es_pdf && <p className="text-xs text-muted-foreground">Este archivo no es PDF: solo se puede ver en pantalla durante 60 segundos.</p>}
    </div>
  );
}

function VisorConocimiento({ d }: { d: any }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Conocimiento validado</h2>
      <p className="text-sm whitespace-pre-wrap">{d.contenido}</p>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Validó" valor={d.validado_por} />
        <Campo label="Fecha de validación" valor={fmtFecha(d.validado_en, true)} />
      </div>
      <section>
        <h3 className="text-sm font-semibold mb-2">Fuentes</h3>
        {d.fuentes.length === 0 && <p className="text-sm text-muted-foreground">Sin fuente registrada.</p>}
        {d.fuentes.map((s: any, i: number) => (
          <div key={i} className="border rounded-md p-3 text-sm mb-2">
            <p className="font-medium">
              {s.documento_codigo ? `${s.documento_codigo}${s.documento_revision ? ` rev. ${s.documento_revision}` : ""}` : s.nombre_fuente || s.tipo_fuente}
            </p>
            <p className="text-xs text-muted-foreground">
              {[s.tipo_fuente, s.pagina && `pág. ${s.pagina}`, s.parrafo && `párr. ${s.parrafo}`, s.seccion].filter(Boolean).join(" · ")}
            </p>
            {s.cita_textual && <p className="text-xs italic mt-1">“{s.cita_textual}”</p>}
          </div>
        ))}
      </section>
    </div>
  );
}

export default function AuditoriaExterna() {
  const { user, loading, profile, org, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: expedientes, isLoading } = useAuditorExpedientes();
  const [expId, setExpId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const exp = useMemo(() => (expedientes ?? []).find((e) => e.id === expId) ?? (expedientes ?? [])[0], [expedientes, expId]);

  useEffect(() => {
    if (!itemId) { setDetalle(null); return; }
    let vivo = true;
    setCargando(true); setError(null); setDetalle(null);
    supabase.rpc("auditor_ver_item" as any, { p_item_id: itemId }).then(({ data, error }) => {
      if (!vivo) return;
      if (error) setError(error.message); else setDetalle(data);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [itemId]);

  if (loading || isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b bg-card px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardCheck className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">TRACEA · Auditoría externa</span>
        </div>
        <div className="flex items-center gap-2">
          {org && <Button variant="ghost" size="sm" onClick={() => navigate("/")}>Volver a TRACEA</Button>}
          <span className="text-sm text-muted-foreground hidden sm:inline">{profile?.nombre}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut} aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {!exp ? (
        <div className="max-w-md mx-auto text-center py-24 px-4">
          <h1 className="text-lg font-bold">No tienes accesos vigentes</h1>
          <p className="text-sm text-muted-foreground mt-2">No hay expedientes de auditoría activos para tu cuenta.</p>
        </div>
      ) : (
        <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{exp.org_nombre}</p>
              <h1 className="text-xl font-bold">{exp.nombre}</h1>
              <p className="text-sm text-muted-foreground">
                Vigente hasta {fmtFecha(exp.expira_en, true)} · Solo lectura{exp.permite_descarga ? " · Descargas con marca de agua" : " · Sin descargas"}
              </p>
            </div>
            {(expedientes ?? []).length > 1 && (
              <select className="border rounded-md bg-background px-2 py-1 text-sm" value={exp.id}
                onChange={(e) => { setExpId(e.target.value); setItemId(null); }}>
                {(expedientes ?? []).map((e) => <option key={e.id} value={e.id}>{e.org_nombre} · {e.nombre}</option>)}
              </select>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Cada consulta y descarga queda registrada en la bitácora de la empresa.</p>

          <div className="grid md:grid-cols-[300px_1fr] gap-4">
            <div className={`space-y-4 ${itemId ? "hidden md:block" : ""}`}>
              {GRUPOS.map(({ tipo, titulo, icon: Icon }) => {
                const items = exp.items.filter((i) => i.tipo === tipo);
                if (items.length === 0) return null;
                return (
                  <Card key={tipo}>
                    <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><Icon className="h-4 w-4" />{titulo} ({items.length})</CardTitle></CardHeader>
                    <CardContent className="pt-0 space-y-1">
                      {items.map((i) => (
                        <button key={i.id} onClick={() => setItemId(i.id)}
                          className={`w-full text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted ${itemId === i.id ? "bg-muted font-medium" : ""}`}>
                          {i.titulo || "(sin título)"}
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Card className={!itemId ? "hidden md:block" : ""}>
              <CardContent className="p-4 md:p-6">
                {itemId && (
                  <Button variant="ghost" size="sm" className="md:hidden mb-3" onClick={() => setItemId(null)}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Ítems
                  </Button>
                )}
                {!itemId && <p className="text-sm text-muted-foreground">Elige un ítem del expediente.</p>}
                {cargando && <p className="text-sm text-muted-foreground">Cargando…</p>}
                {error && <p className="text-sm text-destructive">{error}</p>}
                {detalle && detalle.tipo === "folio" && <VisorFolio itemId={detalle.item_id} d={detalle.datos} permiteDescarga={detalle.permite_descarga} />}
                {detalle && detalle.tipo === "documento" && <VisorDocumento itemId={detalle.item_id} d={detalle.datos} permiteDescarga={detalle.permite_descarga} />}
                {detalle && detalle.tipo === "conocimiento" && <VisorConocimiento d={detalle.datos} />}
              </CardContent>
            </Card>
          </div>
        </main>
      )}
    </div>
  );
}
