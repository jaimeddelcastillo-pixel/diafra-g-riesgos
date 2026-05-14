import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

type AgentRow = {
  id: string; nombre: "dm" | "farma"; system_prompt: string; version: string;
  activo: boolean; updated_at: string;
};

export default function AdminAgentes() {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin()) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          Agentes IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestión de los System Prompts del Asistente IA. Solo super admin.
        </p>
      </header>
      <AgentEditor nombre="dm" titulo="Agent DM (NOM-241 / Dispositivos Médicos)" />
      <AgentEditor nombre="farma" titulo="Agent Farma (NOM-059 / Medicamentos)" />
    </div>
  );
}

function AgentEditor({ nombre, titulo }: { nombre: "dm" | "farma"; titulo: string }) {
  const [row, setRow] = useState<AgentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [version, setVersion] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("agent_prompts").select("*")
      .eq("nombre", nombre).eq("activo", true).maybeSingle();
    if (data) {
      setRow(data as AgentRow);
      setPrompt(data.system_prompt);
      setVersion(data.version);
    }
    setLoading(false);
  }

  async function save() {
    if (!row) return;
    setSaving(true);
    // Crear nueva versión: desactivar la actual e insertar nueva activa
    const { error: dErr } = await supabase
      .from("agent_prompts").update({ activo: false }).eq("id", row.id);
    if (dErr) { toast({ title: "Error", description: dErr.message, variant: "destructive" }); setSaving(false); return; }
    const { error: iErr } = await supabase
      .from("agent_prompts").insert({
        nombre, system_prompt: prompt, version, activo: true,
      });
    if (iErr) { toast({ title: "Error", description: iErr.message, variant: "destructive" }); setSaving(false); return; }
    toast({ title: "Prompt actualizado", description: `Versión ${version} activa` });
    setSaving(false);
    void load();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{titulo}</CardTitle>
        {row && <Badge variant="outline">v{row.version}</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <>
            <div>
              <Label>Versión</Label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} className="max-w-[120px]" />
            </div>
            <div>
              <Label>System Prompt</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[300px] font-mono text-xs"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving || !prompt.trim() || !version.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Publicar nueva versión
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}