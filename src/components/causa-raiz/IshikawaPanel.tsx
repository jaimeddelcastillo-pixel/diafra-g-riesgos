import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, X, Star, Loader2 } from "lucide-react";
import {
  CATEGORIAS_6M,
  getEjemplos6M,
  type Categoria6M,
} from "@/config/wizard-content";
import { useCausaRaizAI } from "./useCausaRaizAI";
import { IshikawaDiagram } from "./IshikawaDiagram";
import { cn } from "@/lib/utils";

export type CausaItem = {
  texto: string;
  origenIA: boolean;
  principal: boolean;
};

export type IshikawaState = Record<Categoria6M, CausaItem[]>;

export function emptyIshikawa(): IshikawaState {
  return {
    mano_obra: [],
    maquina: [],
    metodo: [],
    material: [],
    medio_ambiente: [],
    medicion: [],
  };
}

interface Props {
  peligro: string;
  proceso: string;
  norma: string;
  causaActual?: string;
  value: IshikawaState;
  onChange: (next: IshikawaState) => void;
  onContinuar: () => void;
}

export function IshikawaPanel({
  peligro,
  proceso,
  norma,
  causaActual,
  value,
  onChange,
  onContinuar,
}: Props) {
  const ejemplos = getEjemplos6M(norma);
  const { loading, proponerIshikawa } = useCausaRaizAI();
  const [inputs, setInputs] = useState<Record<Categoria6M, string>>({
    mano_obra: "",
    maquina: "",
    metodo: "",
    material: "",
    medio_ambiente: "",
    medicion: "",
  });

  const causasSimples: Record<Categoria6M, string[]> = Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, v.map((c) => c.texto)]),
  ) as Record<Categoria6M, string[]>;

  const totalPrincipales = Object.values(value).flat().filter((c) => c.principal).length;
  const totalCausas = Object.values(value).flat().length;

  const agregarCausa = (cat: Categoria6M, texto: string, origenIA = false) => {
    const t = texto.trim();
    if (!t) return;
    onChange({
      ...value,
      [cat]: [...value[cat], { texto: t, origenIA, principal: false }],
    });
  };

  const eliminarCausa = (cat: Categoria6M, idx: number) => {
    onChange({
      ...value,
      [cat]: value[cat].filter((_, i) => i !== idx),
    });
  };

  const togglePrincipal = (cat: Categoria6M, idx: number) => {
    onChange({
      ...value,
      [cat]: value[cat].map((c, i) =>
        i === idx ? { ...c, principal: !c.principal } : c,
      ),
    });
  };

  const handleProponerIA = async () => {
    if (!peligro.trim()) return;
    const res = await proponerIshikawa({
      peligro,
      proceso,
      norma,
      causaActual,
    });
    if (!res) return;
    const next: IshikawaState = { ...value };
    (Object.keys(res) as Categoria6M[]).forEach((cat) => {
      const yaTextos = new Set(next[cat].map((c) => c.texto.toLowerCase()));
      const nuevas = (res[cat] || [])
        .filter((t) => t && !yaTextos.has(t.toLowerCase()))
        .map((texto) => ({ texto, origenIA: true, principal: false }));
      next[cat] = [...next[cat], ...nuevas];
    });
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Análisis Ishikawa (6M)</h3>
          <p className="text-xs text-muted-foreground">
            Identifica causas en cada categoría. Marca las principales con ⭐ para
            continuar a 5 Porqués.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleProponerIA}
          disabled={loading || !peligro.trim()}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Proponer con IA
        </Button>
      </div>

      <Accordion type="multiple" className="w-full">
        {CATEGORIAS_6M.map((meta) => {
          const lista = value[meta.key];
          return (
            <AccordionItem key={meta.key} value={meta.key}>
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex flex-1 items-center justify-between pr-3">
                  <span className="font-semibold">{meta.titulo}</span>
                  {lista.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {lista.length}
                      {lista.some((c) => c.principal) ? " · ⭐" : ""}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                <p className="text-xs text-muted-foreground">{meta.pregunta}</p>
                <div className="flex gap-1.5">
                  <Input
                    value={inputs[meta.key]}
                    onChange={(e) =>
                      setInputs({ ...inputs, [meta.key]: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        agregarCausa(meta.key, inputs[meta.key]);
                        setInputs({ ...inputs, [meta.key]: "" });
                      }
                    }}
                    placeholder="Escribe una causa…"
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      agregarCausa(meta.key, inputs[meta.key]);
                      setInputs({ ...inputs, [meta.key]: "" });
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {/* Sugerencias rápidas */}
                <div className="flex flex-wrap gap-1">
                  {ejemplos[meta.key].map((ej) => (
                    <button
                      key={ej}
                      type="button"
                      onClick={() => agregarCausa(meta.key, ej)}
                      className="text-[10px] rounded-full border border-input bg-muted/40 hover:bg-accent hover:text-accent-foreground px-2 py-0.5"
                    >
                      + {ej}
                    </button>
                  ))}
                </div>
                {/* Chips de causas */}
                {lista.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {lista.map((c, i) => (
                      <div
                        key={i}
                        className={cn(
                          "group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                          c.principal
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input bg-background",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => togglePrincipal(meta.key, i)}
                          title={c.principal ? "Quitar principal" : "Marcar principal"}
                        >
                          <Star
                            className={cn(
                              "h-3 w-3",
                              c.principal
                                ? "fill-primary text-primary"
                                : "text-muted-foreground",
                            )}
                          />
                        </button>
                        <span className="max-w-[180px] truncate" title={c.texto}>
                          {c.texto}
                        </span>
                        {c.origenIA && (
                          <span className="text-[9px] rounded bg-accent/20 text-accent px-1 font-bold">
                            IA
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => eliminarCausa(meta.key, i)}
                          className="opacity-60 hover:opacity-100"
                          aria-label="Eliminar"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {totalCausas > 0 && (
        <div className="rounded-md border bg-background p-2">
          <IshikawaDiagram peligro={peligro} causas={causasSimples} />
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">
          {totalCausas} causa(s) · {totalPrincipales} principal(es)
        </span>
        <Button
          type="button"
          size="sm"
          onClick={onContinuar}
          disabled={totalPrincipales < 1}
        >
          Continuar a 5 Porqués →
        </Button>
      </div>
    </div>
  );
}