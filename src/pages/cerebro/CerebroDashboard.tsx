import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import {
  useBrainKnowledge,
  useBrainGaps,
  useBrainContradictions,
  useBrainSessions,
  calcularCobertura,
} from "@/hooks/useBrain";

export default function CerebroDashboard() {
  const { data: items = [] } = useBrainKnowledge();
  const { data: gaps = [] } = useBrainGaps();
  const { data: contras = [] } = useBrainContradictions();
  const { data: sesiones = [] } = useBrainSessions();

  const validados = items.filter((i: any) => i.estado === "validado").length;
  const capturados = items.length;
  const gapsAbiertos = gaps.filter((g: any) => g.estado === "abierta").length;
  const contrasAbiertas = contras.filter((c: any) => c.estado === "abierta").length;
  const indice = calcularCobertura(validados, capturados, gapsAbiertos);

  const metricas = [
    { label: "Conocimiento capturado", valor: capturados, url: "/cerebro/conocimiento" },
    { label: "Validado", valor: validados, url: "/cerebro/validacion" },
    { label: "Brechas abiertas", valor: gapsAbiertos, url: "/cerebro/brechas" },
    { label: "Contradicciones abiertas", valor: contrasAbiertas, url: "/cerebro/contradicciones" },
  ];

  return (
    <CerebroPage
      titulo="Panorama del conocimiento"
      descripcion="Estado del conocimiento institucional capturado, validado y pendiente."
      acciones={
        <Button asChild>
          <Link to="/cerebro/entrevistas">Iniciar entrevista</Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricas.map((m) => (
          <Link key={m.label} to={m.url}>
            <Card className="h-full hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-3xl font-bold mt-1">{m.valor}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-5 space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-sm">
              Índice de madurez del conocimiento identificado
            </h2>
            <span className="text-2xl font-bold">{indice}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${indice}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            Índice preliminar — mide la madurez del conocimiento identificado hasta ahora. No
            representa el universo total de conocimiento institucional de la empresa.
          </p>
        </CardContent>
      </Card>

      {sesiones.length === 0 && (
        <CerebroVacio
          mensaje="Aún no hay entrevistas registradas. El conocimiento se construye a partir de las conversaciones con las personas de la organización."
          accion={
            <Button asChild variant="outline">
              <Link to="/cerebro/entrevistas">Ver entrevistas</Link>
            </Button>
          }
        />
      )}
    </CerebroPage>
  );
}