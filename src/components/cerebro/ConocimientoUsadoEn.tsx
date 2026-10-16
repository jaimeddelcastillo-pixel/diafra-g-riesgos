import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export function ConocimientoUsadoEn({ id }: { id: string }) {
  const { data = [] } = useQuery({ queryKey: ["conocimiento-usado-en", id], queryFn: async () => {
    const { data, error } = await supabase.rpc("conocimiento_usado_en", { _id: id });
    if (error) throw error;
    return data ?? [];
  } });
  return <section className="text-xs space-y-1">
    <h3 className="font-semibold">Usado en</h3>
    {!data.length && <p className="text-muted-foreground">Sin usos registrados.</p>}
    {data.map(row => <div key={`${row.riesgo_id}-${row.fecha}`}>
      <Link className="text-primary underline" to={`/folios/${row.folio_id}`}>{row.folio} · {row.riesgo}</Link>
      <span className="text-muted-foreground"> · {new Date(row.fecha).toLocaleDateString("es-MX")} · {row.nota}</span>
    </div>)}
  </section>;
}