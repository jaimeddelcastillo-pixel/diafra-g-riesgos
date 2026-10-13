import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LeccionTipo = "video" | "descarga" | "practica" | "evaluacion";

export type LeccionDB = {
  id: string;
  leccion_id: string;
  titulo: string;
  tipo: LeccionTipo;
  url_video: string | null;
  archivo_storage: string | null;
  proximamente: boolean;
  orden: number;
  activo: boolean;
};

export type ModuloDB = {
  id: string;
  titulo: string;
  descripcion: string;
  orden: number;
  activo: boolean;
  lecciones: LeccionDB[];
};

export type CursoDB = {
  id: string;
  norma: "NOM-241" | "NOM-059";
  titulo: string;
  descripcion: string;
  activo: boolean;
  modulos: ModuloDB[];
};

export function useCurso(norma: "NOM-241" | "NOM-059" | null, moduloClave = "riesgos") {
  const [curso, setCurso] = useState<CursoDB | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!norma) {
      setCurso(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: c } = await (supabase as any)
        .from("cursos")
        .select("id, norma, titulo, descripcion, activo")
        .eq("norma", norma)
        .eq("modulo_clave", moduloClave)
        .eq("activo", true)
        .maybeSingle();
      if (!c || cancelled) {
        if (!cancelled) {
          setCurso(null);
          setLoading(false);
        }
        return;
      }
      const { data: mods } = await (supabase as any)
        .from("curso_modulos")
        .select("id, titulo, descripcion, orden, activo")
        .eq("curso_id", c.id)
        .eq("activo", true)
        .order("orden", { ascending: true });
      const moduloIds = (mods ?? []).map((m: any) => m.id);
      const { data: lecs } = moduloIds.length
        ? await (supabase as any)
            .from("curso_lecciones")
            .select(
              "id, modulo_id, leccion_id, titulo, tipo, url_video, archivo_storage, proximamente, orden, activo",
            )
            .in("modulo_id", moduloIds)
            .eq("activo", true)
            .order("orden", { ascending: true })
        : { data: [] };
      if (cancelled) return;
      const byModulo = new Map<string, LeccionDB[]>();
      (lecs ?? []).forEach((l: any) => {
        const arr = byModulo.get(l.modulo_id) ?? [];
        arr.push(l as LeccionDB);
        byModulo.set(l.modulo_id, arr);
      });
      setCurso({
        id: c.id,
        norma: c.norma,
        titulo: c.titulo,
        descripcion: c.descripcion,
        activo: c.activo,
        modulos: (mods ?? []).map((m: any) => ({
          id: m.id,
          titulo: m.titulo,
          descripcion: m.descripcion ?? "",
          orden: m.orden,
          activo: m.activo,
          lecciones: byModulo.get(m.id) ?? [],
        })),
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [norma, moduloClave]);

  return { curso, loading };
}