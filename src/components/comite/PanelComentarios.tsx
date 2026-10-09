import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { nombresPersonas } from "@/lib/nombresPersonas";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TipoComentario = "comentario" | "observacion" | "resolucion";

export interface ComiteComentario {
  id: string;
  folio_id: string;
  user_id: string;
  org_id: string;
  contenido: string;
  tipo: TipoComentario;
  resuelto: boolean;
  resuelto_por: string | null;
  resuelto_en: string | null;
  created_at: string;
}

function iniciales(nombre?: string | null) {
  if (!nombre) return "?";
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function tipoBadge(tipo: TipoComentario) {
  if (tipo === "observacion")
    return <Badge className="bg-warning text-warning-foreground text-[10px]">Observación</Badge>;
  if (tipo === "resolucion")
    return <Badge className="bg-success text-success-foreground text-[10px]">Resolución</Badge>;
  return <Badge className="bg-accent text-accent-foreground text-[10px]">Comentario</Badge>;
}

export function PanelComentarios({
  folioId,
  orgId,
  puedeComentar,
  esRSoAdmin,
}: {
  folioId: string;
  orgId: string;
  puedeComentar: boolean;
  esRSoAdmin: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [nuevo, setNuevo] = useState("");
  const [tipo, setTipo] = useState<TipoComentario>("comentario");
  const [enviando, setEnviando] = useState(false);

  const { data: comentarios = [] } = useQuery({
    queryKey: ["comite-comentarios", folioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comite_comentarios")
        .select("*")
        .eq("folio_id", folioId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ComiteComentario[];
    },
  });

  const autoresIds = Array.from(new Set(comentarios.map((c) => c.user_id)));
  const { data: perfiles = [] } = useQuery({
    queryKey: ["comite-comentarios-perfiles", folioId, autoresIds.join(",")],
    enabled: autoresIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nombre, cargo")
        .in("id", autoresIds);
      if (error) throw error;
      const lista: any[] = data || [];
      const faltantes = autoresIds.filter((id) => !lista.some((p) => p.id === id));
      if (faltantes.length) {
        const n = await nombresPersonas(faltantes);
        Object.entries(n).forEach(([id, nombre]) => lista.push({ id, nombre, cargo: null }));
      }
      return lista;
    },
  });
  const perfilMap = new Map(perfiles.map((p) => [p.id, p]));

  useEffect(() => {
    const ch = supabase
      .channel(`comite_comentarios:${orgId}:${folioId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comite_comentarios", filter: `folio_id=eq.${folioId}` },
        () => qc.invalidateQueries({ queryKey: ["comite-comentarios", folioId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [folioId, orgId, qc]);

  const publicar = async () => {
    if (!user) return;
    const contenido = nuevo.trim();
    if (!contenido) {
      toast({ title: "Escribe un comentario", variant: "destructive" });
      return;
    }
    if (contenido.length > 2000) {
      toast({ title: "Demasiado largo", description: "Máximo 2000 caracteres", variant: "destructive" });
      return;
    }
    setEnviando(true);
    const { error } = await supabase.from("comite_comentarios").insert({
      folio_id: folioId,
      user_id: user.id,
      org_id: orgId,
      contenido,
      tipo,
    });
    setEnviando(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setNuevo("");
    setTipo("comentario");
    qc.invalidateQueries({ queryKey: ["comite-comentarios", folioId] });
  };

  const toggleResuelto = async (c: ComiteComentario, resuelto: boolean) => {
    const { error } = await supabase
      .from("comite_comentarios")
      .update({
        resuelto,
        resuelto_por: resuelto ? user?.id ?? null : null,
        resuelto_en: resuelto ? new Date().toISOString() : null,
      })
      .eq("id", c.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["comite-comentarios", folioId] });
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-primary">Discusión del Comité</h3>
        <p className="text-xs text-muted-foreground">Observaciones, comentarios y resoluciones del análisis.</p>
      </div>

      {/* Nuevo comentario */}
      {puedeComentar && (
        <div className="border rounded-md p-3 space-y-2 bg-muted/20">
          <Textarea
            rows={3}
            placeholder="Escribe un comentario o observación..."
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            maxLength={2000}
          />
          <div className="flex items-center gap-2">
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoComentario)}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comentario">Comentario</SelectItem>
                <SelectItem value="observacion">Observación</SelectItem>
                <SelectItem value="resolucion">Resolución</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button size="sm" onClick={publicar} disabled={enviando}>
              {enviando ? "Publicando..." : "Publicar"}
            </Button>
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {comentarios.length === 0 && (
          <p className="text-center text-xs text-muted-foreground italic py-6">
            Aún no hay comentarios. Inicia la discusión del comité.
          </p>
        )}
        {comentarios.map((c) => {
          const p = perfilMap.get(c.user_id);
          const puedeResolver = c.tipo === "observacion" && (esRSoAdmin || c.user_id === user?.id);
          return (
            <div
              key={c.id}
              className="border rounded-md p-3 bg-card animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-start gap-2">
                <Avatar className="h-8 w-8 text-[10px]">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {iniciales(p?.nombre)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold truncate">{p?.nombre ?? "—"}</p>
                    {p?.cargo && (
                      <span className="text-[10px] text-muted-foreground truncate">{p.cargo}</span>
                    )}
                    {tipoBadge(c.tipo)}
                    {c.resuelto && (
                      <Badge variant="outline" className="text-[10px] border-success text-success">
                        Resuelta
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleString("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="text-xs mt-2 whitespace-pre-line">{c.contenido}</p>
                  {puedeResolver && (
                    <label className="flex items-center gap-2 mt-2 text-[11px] cursor-pointer">
                      <Checkbox
                        checked={c.resuelto}
                        onCheckedChange={(v) => toggleResuelto(c, !!v)}
                      />
                      Marcar como resuelto
                    </label>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
