import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFolios, getEstadoStyle } from "@/hooks/useFolios";
import { Skeleton } from "@/components/ui/skeleton";

export default function Folios() {
  const navigate = useNavigate();
  const { data: folios, isLoading } = useFolios();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Folios</h1>
          <p className="text-sm text-muted-foreground">Archivos Maestros de Gestión de Riesgos — FOR-SGC-11-01</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Folio
        </Button>
      </div>

      <div className="grid gap-4">
        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardContent className="py-4"><Skeleton className="h-10 w-full" /></CardContent></Card>
        ))}
        {folios?.map((folio) => (
          <Card key={folio.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/folios/${folio.id}`)}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="font-mono text-sm font-bold text-primary whitespace-nowrap">{folio.codigo}</div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{folio.proceso_equipo}</p>
                    <p className="text-xs text-muted-foreground">
                      Origen: {folio.origen} · Inicio: {folio.fecha_inicio}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge className={`text-[10px] ${getEstadoStyle(folio.estado)}`}>{folio.estado}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && folios?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No hay folios registrados aún.</p>
        )}
      </div>
    </div>
  );
}
