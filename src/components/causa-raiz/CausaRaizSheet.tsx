import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Fish, ListChecks } from "lucide-react";
import {
  IshikawaPanel,
  emptyIshikawa,
  type IshikawaState,
} from "./IshikawaPanel";
import {
  CincoPorquesPanel,
  emptyPorques,
  type PorquesState,
} from "./CincoPorquesPanel";
import { getNormaLabel, type Categoria6M } from "@/config/wizard-content";

export type CausaRaizPayload = {
  causaRaiz: string;
  causasSecundarias: string[];
  resumen6M: Record<Categoria6M, string[]>;
  cadenaPorques: string[];
  origen: "ishikawa" | "5porques" | "ambos";
  /** C4b: skills y modelo de las sugerencias IA usadas en esta sesión. */
  iaOrigen?: OrigenIA[];
};

interface Props {
  open: boolean;
  onClose: () => void;
  peligro: string;
  proceso: string;
  norma: string;
  causaActual?: string;
  onApply: (p: CausaRaizPayload) => void;
}

export function CausaRaizSheet({
  open,
  onClose,
  peligro,
  proceso,
  norma,
  causaActual,
  onApply,
}: Props) {
  const [tab, setTab] = useState<"ishikawa" | "porques">("ishikawa");
  const [ish, setIsh] = useState<IshikawaState>(emptyIshikawa);
  const [pq, setPq] = useState<PorquesState>(() => emptyPorques(""));

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setIsh(emptyIshikawa());
      setPq(emptyPorques(""));
      setTab("ishikawa");
      reiniciarOrigenesIA();
    }
  }, [open]);

  const causaPrincipal = useMemo(() => {
    const todas = Object.values(ish).flat();
    const principal = todas.find((c) => c.principal);
    return principal?.texto || "";
  }, [ish]);

  const handleAplicar = () => {
    const todas = Object.values(ish).flat();
    const principales = todas.filter((c) => c.principal).map((c) => c.texto);
    const secundarias = todas.filter((c) => !c.principal).map((c) => c.texto);
    const cadena = pq.niveles
      .filter((n) => n.respuesta.trim())
      .map((n) => n.respuesta.trim());
    const ultimaCadena = cadena[cadena.length - 1];
    const causaRaiz =
      ultimaCadena || principales[0] || pq.causaInicial.trim() || "";
    const usaIsh = principales.length > 0;
    const usaPq = cadena.length >= 3;
    const resumen: Record<Categoria6M, string[]> = Object.fromEntries(
      Object.entries(ish).map(([k, v]) => [k, v.map((c) => c.texto)]),
    ) as Record<Categoria6M, string[]>;
    onApply({
      causaRaiz,
      causasSecundarias: secundarias,
      resumen6M: resumen,
      cadenaPorques: cadena,
      origen: usaIsh && usaPq ? "ambos" : usaPq ? "5porques" : "ishikawa",
      iaOrigen: origenesIA(),
    });
    onClose();
  };

  const irAPorques = () => {
    setPq((prev) => ({
      ...prev,
      causaInicial: prev.causaInicial || causaPrincipal,
    }));
    setTab("porques");
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0"
      >
        <div className="p-6 pb-3 border-b sticky top-0 bg-background z-10">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Análisis de Causa Raíz
              <Badge variant="outline" className="text-[10px]">
                {getNormaLabel(norma)}
              </Badge>
            </SheetTitle>
            <SheetDescription className="text-xs">
              Proceso: <strong>{proceso || "—"}</strong> · Peligro:{" "}
              <strong>{peligro || "—"}</strong>
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="p-6 pt-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="ishikawa" className="gap-1.5 text-xs">
                <Fish className="h-3.5 w-3.5" /> Ishikawa (6M)
              </TabsTrigger>
              <TabsTrigger value="porques" className="gap-1.5 text-xs">
                <ListChecks className="h-3.5 w-3.5" /> 5 Porqués
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ishikawa" className="pt-4">
              <IshikawaPanel
                peligro={peligro}
                proceso={proceso}
                norma={norma}
                causaActual={causaActual}
                value={ish}
                onChange={setIsh}
                onContinuar={irAPorques}
              />
            </TabsContent>

            <TabsContent value="porques" className="pt-4">
              <CincoPorquesPanel
                norma={norma}
                value={pq}
                onChange={setPq}
                onAplicar={handleAplicar}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Formatea el payload para escribir en los campos del riesgo.
 */
export function formatCausaPotencial(
  existente: string,
  p: CausaRaizPayload,
): string {
  const partes: string[] = [];
  if (existente.trim()) partes.push(existente.trim());
  const origenTxt =
    p.origen === "ambos" ? "Ishikawa + 5 Porqués" : p.origen === "5porques" ? "5 Porqués" : "Ishikawa";
  partes.push(`[CAUSA RAÍZ — ${origenTxt}] ${p.causaRaiz}`);
  if (p.causasSecundarias.length > 0) {
    partes.push(
      "Causas secundarias:\n" +
        p.causasSecundarias.map((c, i) => `${i + 1}. ${c}`).join("\n"),
    );
  }
  return partes.join("\n\n");
}

export function formatJustificacion6M(
  existente: string,
  p: CausaRaizPayload,
): string {
  const categorias: { key: Categoria6M; label: string }[] = [
    { key: "mano_obra", label: "Mano de obra" },
    { key: "maquina", label: "Máquina" },
    { key: "metodo", label: "Método" },
    { key: "material", label: "Material" },
    { key: "medio_ambiente", label: "Medio ambiente" },
    { key: "medicion", label: "Medición" },
  ];
  const lineas: string[] = [];
  categorias.forEach(({ key, label }) => {
    const arr = p.resumen6M[key] || [];
    if (arr.length > 0) {
      lineas.push(`• ${label}: ${arr.join("; ")}`);
    }
  });
  if (p.cadenaPorques.length > 0) {
    lineas.push("");
    lineas.push(
      "Cadena 5 Porqués: " +
        [p.causaRaiz ? "→ raíz: " + p.causaRaiz : "", ...p.cadenaPorques]
          .filter(Boolean)
          .join(" | "),
    );
  }
  const bloque = `[Análisis 6M / Causa raíz]\n${lineas.join("\n")}`;
  return existente.trim() ? `${existente.trim()}\n\n${bloque}` : bloque;
}