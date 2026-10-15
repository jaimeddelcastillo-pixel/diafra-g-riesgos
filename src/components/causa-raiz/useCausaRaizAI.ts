import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Categoria6M } from "@/config/wizard-content";

export type IshikawaIA = Record<Categoria6M, string[]>;
export type EvaluacionPorque = {
  esCausaRaiz: boolean;
  justificacion: string;
  sugerencia: string | null;
};

/** C4b: trazabilidad de las sugerencias IA de la sesión de causa raíz abierta. */
export type OrigenIA = { funcion: string; modo: string; skills_usadas: unknown[]; modelo: string; en: string };
let origenesSesion: OrigenIA[] = [];
export function reiniciarOrigenesIA() { origenesSesion = []; }
export function origenesIA(): OrigenIA[] { return [...origenesSesion]; }
function separarOrigen<T>(data: any, modo: string): T {
  const { _ia, ...resto } = data ?? {};
  if (_ia) origenesSesion.push({ funcion: "causa-raiz-ai", modo, skills_usadas: _ia.skills_usadas ?? [], modelo: _ia.modelo, en: new Date().toISOString() });
  return resto as T;
}

export function useCausaRaizAI() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const proponerIshikawa = async (args: {
    peligro: string;
    proceso: string;
    norma: string;
    causaActual?: string;
  }): Promise<IshikawaIA | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("causa-raiz-ai", {
        body: {
          mode: "ishikawa",
          peligro: args.peligro,
          proceso: args.proceso,
          norma: args.norma,
          causa_actual: args.causaActual,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return separarOrigen<IshikawaIA>(data, "ishikawa");
    } catch (e) {
      toast({
        title: "No se pudo consultar la IA",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const evaluarPorque = async (args: {
    norma: string;
    causaInicial: string;
    porques: string[];
  }): Promise<EvaluacionPorque | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("causa-raiz-ai", {
        body: {
          mode: "evaluar_porque",
          norma: args.norma,
          causa_inicial: args.causaInicial,
          porques: args.porques,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return separarOrigen<EvaluacionPorque>(data, "evaluar_porque");
    } catch (e) {
      toast({
        title: "No se pudo evaluar con IA",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { loading, proponerIshikawa, evaluarPorque };
}