import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockFolios, getEstadoStyle } from "@/data/mockData";
import { Plus, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Folios() {
  const navigate = useNavigate();

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
        {mockFolios.map((folio) => (
          <Card key={folio.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/folios/${folio.id}`)}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="font-mono text-sm font-bold text-primary whitespace-nowrap">
                    {folio.codigo}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{folio.procesoEquipo}</p>
                    <p className="text-xs text-muted-foreground">
                      Origen: {folio.origen} · {folio.riesgos.length} riesgos · Inicio: {folio.fechaInicio}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge className={`text-[10px] ${getEstadoStyle(folio.estado)}`}>
                    {folio.estado}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
