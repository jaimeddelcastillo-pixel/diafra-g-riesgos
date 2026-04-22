import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const severidadData = [
  { valor: "10", nivel: "Muy Alta / Inevitable", descripcion: "Muerte:\nFalla que puede resultar en muerte o lesión irreversible crítica.", complemento: "Clausura total de planta o retiro de mercado (Recall) Clase I." },
  { valor: "9", nivel: "Muy Alta", descripcion: "Lesión Permanente:\nDaño irreversible o deterioro grave de la salud.", complemento: "Suspensión de líneas críticas o Recall Clase II." },
  { valor: "8", nivel: "Alta", descripcion: "Lesión Grave:\nRequiere intervención médica profesional o quirúrgica para corregir el daño.", complemento: "Multas regulatorias mayores o pérdida de cliente clave." },
  { valor: "7", nivel: "Moderadamente Alta", descripcion: "Lesión Temporal:\nRequiere atención médica menor no quirúrgica.", complemento: "Retención de lotes completa, desviación crítica." },
  { valor: "6-5", nivel: "Moderada", descripcion: "Molestia Menor:\nEl paciente experimenta incomodidad sin lesión (ej. irritación leve).", complemento: "Desperdicio de material alto, reproceso costoso." },
  { valor: "4-3", nivel: "Baja", descripcion: "Insignificante:\nEl paciente lo nota, pero no afecta la seguridad ni eficacia.", complemento: "Reproceso menor en línea, desviación menor." },
  { valor: "2-1", nivel: "Remota", descripcion: "Ninguno:\nSin efecto perceptible.", complemento: "Sin impacto operativo." },
];

const ocurrenciaData = [
  { valor: "10", nivel: "Muy Alta / Inevitable", descripcion: "La falla ocurre en casi todos los lotes (> 50%)." },
  { valor: "9", nivel: "Muy Alta", descripcion: "1 de cada 3 lotes o eventos." },
  { valor: "8", nivel: "Alta", descripcion: "Recurrente (1 vez a la semana)." },
  { valor: "7", nivel: "Moderadamente Alta", descripcion: "Frecuente (1 vez al mes)." },
  { valor: "6-5", nivel: "Moderada", descripcion: "Ocasional (1 vez cada 6 meses)." },
  { valor: "4-3", nivel: "Baja", descripcion: "Aislada (1 vez al año)." },
  { valor: "2-1", nivel: "Remota", descripcion: "Históricamente no se ha presentado." },
];

const deteccionData = [
  { valor: "10", nivel: "Muy Alta / Inevitable", descripcion: "No hay control conocido o la falla no es detectable hasta el uso." },
  { valor: "9", nivel: "Muy Alta", descripcion: "Controles erráticos o basados puramente en inspección visual aleatoria difícil." },
  { valor: "8-7", nivel: "Alta", descripcion: "Inspección visual al 100% manual (sujeta a error humano)." },
  { valor: "6-5", nivel: "Moderada", descripcion: "Control Estadístico de Proceso (SPC) o inspección por muestreo robusto." },
  { valor: "4-3", nivel: "Baja", descripcion: "Detección automatizada que segrega el producto defectuoso (Poka-yoke falible)." },
  { valor: "2-1", nivel: "Remota", descripcion: "Prevención automática por diseño (imposible fabricar la pieza mal) o detección automatizada infalible." },
];

function DetailTable({ data, title }: { data: { valor: string; nivel: string; descripcion: string; complemento?: string }[]; title: string }) {
  return (
    <table className="w-full text-sm border">
      <thead>
        <tr className="bg-muted border-b">
          <th className="text-left p-3 font-semibold text-muted-foreground w-[160px]">Nivel</th>
          <th className="text-left p-3 font-semibold text-muted-foreground">{title}</th>
          <th className="text-center p-3 font-semibold text-muted-foreground w-[80px]">Valor</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.valor} className="border-b last:border-0 hover:bg-muted/30">
            <td className="p-3 font-medium text-xs">{item.nivel}</td>
            <td className="p-3">
              <p className="whitespace-pre-line text-xs">{item.descripcion}</p>
              {item.complemento && (
                <p className="text-[10px] text-muted-foreground italic mt-1">{item.complemento}</p>
              )}
            </td>
            <td className="p-3 text-center font-mono font-bold text-base">{item.valor}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Catalogos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catálogos</h1>
        <p className="text-sm text-muted-foreground">Escalas de evaluación</p>
      </div>

      <Tabs defaultValue="severidad">
        <TabsList>
          <TabsTrigger value="severidad">Severidad (S)</TabsTrigger>
          <TabsTrigger value="ocurrencia">Ocurrencia (O)</TabsTrigger>
          <TabsTrigger value="deteccion">Detectabilidad (D)</TabsTrigger>
        </TabsList>
        <TabsContent value="severidad">
          <Card><CardContent className="pt-6"><DetailTable data={severidadData} title="Severidad de la Falla (S)" /></CardContent></Card>
        </TabsContent>
        <TabsContent value="ocurrencia">
          <Card><CardContent className="pt-6"><DetailTable data={ocurrenciaData} title="Ocurrencia (O)" /></CardContent></Card>
        </TabsContent>
        <TabsContent value="deteccion">
          <Card><CardContent className="pt-6"><DetailTable data={deteccionData} title="Detectabilidad (D)" /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
