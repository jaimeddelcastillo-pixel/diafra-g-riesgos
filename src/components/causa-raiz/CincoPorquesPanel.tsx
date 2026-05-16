import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useCausaRaizAI, type EvaluacionPorque } from "./useCausaRaizAI";
import { cn } from "@/lib/utils";

export type PorqueNivel = {
  respuesta: string;
  evaluacion: EvaluacionPorque | null;
};

export type PorquesState = {
  causaInicial: string;
  niveles: PorqueNivel[]; // longitud 3..5
};

export function emptyPorques(causaInicial = ""): PorquesState {
  return {
    causaInicial,
    niveles: [
      { respuesta: "", evaluacion: null },
      { respuesta: "", evaluacion: null },
      { respuesta: "", evaluacion: null },
    ],
  };
}

interface Props {
  norma: string;
  value: PorquesState;
  onChange: (next: PorquesState) => void;
  onAplicar: () => void;
}

export function CincoPorquesPanel({ norma, value, onChange, onAplicar }: Props) {
  const { loading, evaluarPorque } = useCausaRaizAI();
  const [evaluandoIdx, setEvaluandoIdx] = useState<number | null>(null);

  const setRespuesta = (i: number, r: string) => {
    onChange({
      ...value,
      niveles: value.niveles.map((n, idx) =>
        idx === i ? { ...n, respuesta: r, evaluacion: null } : n,
      ),
    });
  };

  const agregarNivel = () => {
    if (value.niveles.length >= 5) return;
    onChange({
      ...value,
      niveles: [...value.niveles, { respuesta: "", evaluacion: null }],
    });
  };

  const quitarNivel = () => {
    if (value.niveles.length <= 3) return;
    onChange({ ...value, niveles: value.niveles.slice(0, -1) });
  };

  const evaluarHasta = async (i: number) => {
    setEvaluandoIdx(i);
    const porques = value.niveles.slice(0, i + 1).map((n) => n.respuesta);
    const res = await evaluarPorque({
      norma,
      causaInicial: value.causaInicial,
      porques,
    });
    setEvaluandoIdx(null);
    if (!res) return;
    onChange({
      ...value,
      niveles: value.niveles.map((n, idx) =>
        idx === i ? { ...n, evaluacion: res } : n,
      ),
    });
  };

  const respuestasOk = value.niveles.filter((n) => n.respuesta.trim()).length;
  const causaRaizTxt =
    [...value.niveles].reverse().find((n) => n.respuesta.trim())?.respuesta || "";
  const puedeAplicar = value.causaInicial.trim().length > 0 && respuestasOk >= 3;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Cadena de 5 Porqués</h3>
        <p className="text-xs text-muted-foreground">
          Profundiza hasta llegar a una causa sistémica. Mínimo 3, máximo 5.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold">Causa inicial</label>
        <Input
          value={value.causaInicial}
          onChange={(e) => onChange({ ...value, causaInicial: e.target.value })}
          placeholder="Causa que vas a analizar (puedes traerla del Ishikawa)"
        />
      </div>

      <div className="relative pl-6 space-y-3">
        {/* línea conectora */}
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
        {value.niveles.map((nivel, i) => {
          const previa =
            i === 0
              ? value.causaInicial
              : value.niveles[i - 1].respuesta || "respuesta anterior";
          const evalActual = nivel.evaluacion;
          return (
            <div key={i} className="relative">
              <span
                className={cn(
                  "absolute -left-6 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground",
                  nivel.respuesta.trim() ? "bg-primary" : "bg-muted-foreground/60",
                )}
              >
                {i + 1}
              </span>
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  ¿Por qué <span className="italic">{previa || "…"}</span>?
                </label>
                <Textarea
                  rows={2}
                  value={nivel.respuesta}
                  onChange={(e) => setRespuesta(i, e.target.value)}
                  placeholder="Respuesta…"
                />
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => evaluarHasta(i)}
                    disabled={
                      !nivel.respuesta.trim() || !value.causaInicial.trim() || loading
                    }
                    className="h-7 gap-1 text-[11px]"
                  >
                    {evaluandoIdx === i ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    ¿Es suficientemente profundo?
                  </Button>
                  {evalActual && (
                    <Badge
                      variant={evalActual.esCausaRaiz ? "default" : "secondary"}
                      className="gap-1 text-[10px]"
                    >
                      {evalActual.esCausaRaiz ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> Causa raíz
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3" /> Profundizar
                        </>
                      )}
                    </Badge>
                  )}
                </div>
                {evalActual && (
                  <p className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
                    {evalActual.justificacion}
                    {evalActual.sugerencia && (
                      <>
                        <br />
                        <span className="font-medium text-foreground">
                          Sugerencia:
                        </span>{" "}
                        {evalActual.sugerencia}
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={agregarNivel}
          disabled={value.niveles.length >= 5}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar porqué
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={quitarNivel}
          disabled={value.niveles.length <= 3}
          className="gap-1"
        >
          <Trash2 className="h-3.5 w-3.5" /> Quitar último
        </Button>
      </div>

      {puedeAplicar && (
        <div className="rounded-md border bg-primary/5 p-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            Resumen
          </p>
          <p className="text-xs leading-relaxed">
            <span className="font-semibold">{value.causaInicial}</span>
            {value.niveles
              .filter((n) => n.respuesta.trim())
              .map((n, i) => (
                <span key={i}>
                  {" → "}
                  <span className={i === respuestasOk - 1 ? "font-bold text-primary" : ""}>
                    {n.respuesta}
                  </span>
                </span>
              ))}
          </p>
          <p className="text-[11px] text-muted-foreground">
            <strong>Causa raíz identificada:</strong> {causaRaizTxt}
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={onAplicar}
          disabled={!puedeAplicar}
          className="gap-1.5"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Aplicar al ID
        </Button>
      </div>
    </div>
  );
}