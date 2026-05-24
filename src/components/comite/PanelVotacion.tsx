import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Clock, Pencil } from "lucide-react";
import type { FolioComite } from "@/hooks/useFolios";
import { z } from "zod";

type VotoTipo = "aprueba" | "aprueba_con_observaciones" | "rechaza";

export interface ComiteVoto {
  id: string;
  folio_id: string;
  user_id: string;
  org_id: string;
  voto: VotoTipo;
  comentario: string | null;
  created_at: string;
  updated_at: string;
}

const votoSchema = z
  .object({
    voto: z.enum(["aprueba", "aprueba_con_observaciones", "rechaza"]),
    comentario: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((d) => d.voto === "aprueba" || (d.comentario && d.comentario.length > 0), {
    message: "El comentario es obligatorio para observaciones o rechazo",
    path: ["comentario"],
  });

function votoLabel(v: VotoTipo) {
  return v === "aprueba"
    ? "Aprobó"
    : v === "aprueba_con_observaciones"
      ? "Aprobó con observaciones"
      : "Rechazó";
}

function VotoIcon({ v }: { v: VotoTipo | null }) {
  if (v === "aprueba") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (v === "aprueba_con_observaciones") return <AlertTriangle className="h-4 w-4 text-warning" />;
  if (v === "rechaza") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

export function PanelVotacion({
  folioId,
  orgId,
  folioEstado,
  comite,
  isRS,
}: {
  folioId: string;
  orgId: string;
  folioEstado: string;
  comite: FolioComite[];
  isRS: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [voto, setVoto] = useState<VotoTipo | null>(null);
  const [comentario, setComentario] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: votos = [] } = useQuery({
    queryKey: ["comite-votos", folioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comite_votos")
        .select("*")
        .eq("folio_id", folioId);
      if (error) throw error;
      return (data || []) as ComiteVoto[];
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`comite_votos:${orgId}:${folioId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comite_votos", filter: `folio_id=eq.${folioId}` },
        () => qc.invalidateQueries({ queryKey: ["comite-votos", folioId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [folioId, orgId, qc]);

  const miMiembro = useMemo(
    () => comite.find((c) => c.user_id && c.user_id === user?.id),
    [comite, user?.id],
  );
  const miVoto = useMemo(() => votos.find((v) => v.user_id === user?.id) || null, [votos, user?.id]);

  // Pre-llenar al editar
  useEffect(() => {
    if (editing && miVoto) {
      setVoto(miVoto.voto);
      setComentario(miVoto.comentario || "");
    }
  }, [editing, miVoto]);

  const totalMiembros = comite.length;
  const totalVotos = votos.filter((v) => comite.some((c) => c.user_id === v.user_id)).length;
  const pct = totalMiembros > 0 ? Math.round((totalVotos / totalMiembros) * 100) : 0;

  const rechazos = votos.filter((v) => v.voto === "rechaza").length;
  const observ = votos.filter((v) => v.voto === "aprueba_con_observaciones").length;
  const pendientes = totalMiembros - totalVotos;

  let semaforo: { color: string; icon: JSX.Element; texto: string } | null = null;
  if (isRS) {
    if (rechazos > 0) {
      semaforo = {
        color: "bg-destructive/10 border-destructive/40 text-destructive",
        icon: <XCircle className="h-5 w-5" />,
        texto: "Hay rechazos — el análisis requiere correcciones antes de continuar.",
      };
    } else if (pendientes > 0) {
      semaforo = {
        color: "bg-muted border-border text-muted-foreground",
        icon: <Clock className="h-5 w-5" />,
        texto: `Votación en curso — ${pendientes} miembro(s) pendiente(s).`,
      };
    } else if (observ > 0) {
      semaforo = {
        color: "bg-warning/10 border-warning/40 text-warning",
        icon: <AlertTriangle className="h-5 w-5" />,
        texto: "Hay observaciones — revisa los comentarios antes de firmar.",
      };
    } else if (totalVotos > 0) {
      semaforo = {
        color: "bg-success/10 border-success/40 text-success",
        icon: <CheckCircle2 className="h-5 w-5" />,
        texto: "Consenso alcanzado — todos aprobaron. Puedes emitir el dictamen.",
      };
    }
  }

  const puedeVotar = !!miMiembro && folioEstado === "Borrador" && !!user;
  const puedeModificar = !!miVoto && folioEstado === "Borrador";

  const handleSubmit = async () => {
    if (!voto || !user) return;
    const parsed = votoSchema.safeParse({ voto, comentario: comentario.trim() || null });
    if (!parsed.success) {
      toast({
        title: "Datos incompletos",
        description: parsed.error.issues[0]?.message ?? "Revisa el formulario",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const payload = {
      folio_id: folioId,
      user_id: user.id,
      org_id: orgId,
      voto: parsed.data.voto,
      comentario: parsed.data.comentario,
    };
    const { error } = await supabase
      .from("comite_votos")
      .upsert(payload, { onConflict: "folio_id,user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Voto registrado" });
    setEditing(false);
    setVoto(null);
    setComentario("");
    qc.invalidateQueries({ queryKey: ["comite-votos", folioId] });
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-primary">Votación del Comité Técnico</h3>
        <p className="text-xs text-muted-foreground">
          Todos los miembros deben votar antes de que el RS emita el dictamen.
        </p>
      </div>

      {/* Progreso */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {totalVotos} de {totalMiembros} miembro(s) han votado
          </span>
          <span className="font-semibold text-accent">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      {/* Semáforo RS */}
      {semaforo && (
        <div className={`flex items-start gap-2 p-3 border rounded-md ${semaforo.color}`}>
          {semaforo.icon}
          <p className="text-xs font-medium">{semaforo.texto}</p>
        </div>
      )}

      {/* Lista de miembros */}
      <div className="border rounded-md divide-y">
        {comite.map((m) => {
          const v = votos.find((x) => x.user_id === m.user_id);
          return (
            <div key={m.id} className="flex items-center gap-2 px-3 py-2 text-xs">
              <VotoIcon v={v?.voto ?? null} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.nombre}</p>
                <p className="text-[10px] text-muted-foreground truncate">{m.cargo}</p>
              </div>
              <div className="text-right">
                <p
                  className={`font-semibold text-[11px] ${
                    v?.voto === "aprueba"
                      ? "text-success"
                      : v?.voto === "aprueba_con_observaciones"
                        ? "text-warning"
                        : v?.voto === "rechaza"
                          ? "text-destructive"
                          : "text-muted-foreground"
                  }`}
                >
                  {v ? votoLabel(v.voto) : "Pendiente"}
                </p>
                {v && (
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(v.updated_at).toLocaleDateString("es-MX")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {comite.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground italic">
            Aún no hay miembros en el comité.
          </p>
        )}
      </div>

      {/* Formulario de voto */}
      {puedeVotar && (!miVoto || editing) && (
        <div className="border rounded-md p-3 space-y-2 bg-muted/20">
          <p className="text-xs font-bold">Tu voto</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              type="button"
              size="sm"
              variant={voto === "aprueba" ? "default" : "outline"}
              className={voto === "aprueba" ? "bg-success hover:bg-success/90 text-success-foreground" : ""}
              onClick={() => setVoto("aprueba")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Apruebo
            </Button>
            <Button
              type="button"
              size="sm"
              variant={voto === "aprueba_con_observaciones" ? "default" : "outline"}
              className={voto === "aprueba_con_observaciones" ? "bg-warning hover:bg-warning/90 text-warning-foreground" : ""}
              onClick={() => setVoto("aprueba_con_observaciones")}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Con observaciones
            </Button>
            <Button
              type="button"
              size="sm"
              variant={voto === "rechaza" ? "destructive" : "outline"}
              onClick={() => setVoto("rechaza")}
            >
              <XCircle className="h-3.5 w-3.5" /> Rechazo
            </Button>
          </div>
          {(voto === "rechaza" || voto === "aprueba_con_observaciones") && (
            <Textarea
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Describe tus observaciones o el motivo del rechazo..."
              maxLength={2000}
            />
          )}
          <div className="flex justify-end gap-2">
            {editing && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
            <Button size="sm" disabled={!voto || saving} onClick={handleSubmit}>
              {saving ? "Guardando..." : "Confirmar voto"}
            </Button>
          </div>
        </div>
      )}

      {/* Voto ya emitido */}
      {miVoto && !editing && puedeVotar && (
        <div className="border rounded-md p-3 bg-card flex items-start gap-2">
          <VotoIcon v={miVoto.voto} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">Tu voto: {votoLabel(miVoto.voto)}</p>
            {miVoto.comentario && (
              <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-line">
                {miVoto.comentario}
              </p>
            )}
          </div>
          {puedeModificar && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="gap-1">
              <Pencil className="h-3 w-3" /> Modificar
            </Button>
          )}
        </div>
      )}

      {!puedeVotar && !miVoto && (
        <Badge variant="outline" className="text-[10px]">
          {folioEstado !== "Borrador"
            ? "Solo se puede votar mientras el folio esté en Borrador"
            : "Solo miembros del comité pueden votar"}
        </Badge>
      )}
    </div>
  );
}
