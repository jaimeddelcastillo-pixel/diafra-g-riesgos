import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Folio, Riesgo } from "@/hooks/useFolios";

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="bg-muted px-4 py-2 border-b">
      <h3 className="text-sm font-bold">{number}. {title}</h3>
    </div>
  );
}

interface Props {
  folio: Folio;
  riesgos: Riesgo[];
  locked: boolean;
  onSaved: () => void;
}

export function SeccionDictamen({ folio, riesgos, locked, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const hasNoAceptables = riesgos.some((r) => r.dictamen === "No Aceptable");

  const [form, setForm] = useState({
    justificacion: (folio as any).justificacion_tecnica || "",
    conclusion: (folio as any).conclusion || "Aprobado",
  });

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("folios").update({
      justificacion_tecnica: form.justificacion,
      conclusion: form.conclusion,
    } as any).eq("id", folio.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Dictamen actualizado" });
      setEditing(false);
      onSaved();
    }
  };

  if (!editing) {
    return (
      <div className="border rounded-md overflow-hidden relative">
        <SectionHeader number="IV" title="DICTAMEN DE BENEFICIO-RIESGO" />
        {!locked && (
          <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold">¿Existen riesgos residuales clasificados como NO ACEPTABLES o CONDICIONADOS?</span>
            <span className="flex items-center gap-1">
              SÍ <span className={`inline-block w-4 h-4 border rounded ${hasNoAceptables ? "bg-foreground" : ""}`} />
            </span>
            <span className="flex items-center gap-1">
              NO <span className={`inline-block w-4 h-4 border rounded ${!hasNoAceptables ? "bg-foreground" : ""}`} />
            </span>
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">
              JUSTIFICACIÓN TÉCNICA: (Explicar por qué el beneficio médico supera el riesgo residual identificado, citando evidencia clínica o técnica).
            </p>
            <div className="text-sm whitespace-pre-line border rounded p-3 bg-muted/20 min-h-[80px]">
              {form.justificacion || <span className="text-muted-foreground/50 italic">Sin justificación registrada</span>}
            </div>
          </div>

          <div className="flex items-center gap-8 border-t pt-3">
            <span className="font-semibold text-sm">CONCLUSIÓN:</span>
            <span className="flex items-center gap-2 text-sm">
              APROBADO <span className={`inline-block w-4 h-4 border rounded ${form.conclusion === "Aprobado" ? "bg-foreground" : ""}`} />
            </span>
            <span className="flex items-center gap-2 text-sm">
              RECHAZADO <span className={`inline-block w-4 h-4 border rounded ${form.conclusion === "Rechazado" ? "bg-foreground" : ""}`} />
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <SectionHeader number="IV" title="DICTAMEN DE BENEFICIO-RIESGO — Editando" />
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-semibold">¿Existen riesgos residuales NO ACEPTABLES?</span>
          <span>{hasNoAceptables ? "SÍ" : "NO"} (calculado automáticamente)</span>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Justificación Técnica</label>
          <Textarea
            value={form.justificacion}
            onChange={(e) => setForm({ ...form, justificacion: e.target.value })}
            rows={8}
            placeholder="Explicar por qué el beneficio médico supera el riesgo residual identificado, citando evidencia clínica o técnica..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Conclusión</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.conclusion === "Aprobado"} onCheckedChange={() => setForm({ ...form, conclusion: "Aprobado" })} />
              <span className="text-sm font-medium">Aprobado</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.conclusion === "Rechazado"} onCheckedChange={() => setForm({ ...form, conclusion: "Rechazado" })} />
              <span className="text-sm font-medium">Rechazado</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1"><X className="h-3 w-3" /> Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1"><Save className="h-3 w-3" /> {saving ? "Guardando..." : "Guardar"}</Button>
        </div>
      </div>
    </div>
  );
}
