import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const severidadData = [
  { valor: 1, descripcion: "Sin efecto" }, { valor: 2, descripcion: "Efecto muy leve" }, { valor: 3, descripcion: "Efecto leve" },
  { valor: 4, descripcion: "Efecto menor" }, { valor: 5, descripcion: "Efecto moderado" }, { valor: 6, descripcion: "Efecto significativo" },
  { valor: 7, descripcion: "Efecto mayor" }, { valor: 8, descripcion: "Efecto grave" }, { valor: 9, descripcion: "Efecto muy grave (riesgo de lesión)" },
  { valor: 10, descripcion: "Efecto peligroso (riesgo de muerte)" },
];

const ocurrenciaData = [
  { valor: 1, descripcion: "Remota: <1 en 1,000,000" }, { valor: 2, descripcion: "Muy baja: 1 en 500,000" },
  { valor: 3, descripcion: "Baja: 1 en 100,000" }, { valor: 4, descripcion: "Moderada baja: 1 en 10,000" },
  { valor: 5, descripcion: "Moderada: 1 en 2,000" }, { valor: 6, descripcion: "Moderada alta: 1 en 500" },
  { valor: 7, descripcion: "Alta: 1 en 100" }, { valor: 8, descripcion: "Muy alta: 1 en 50" },
  { valor: 9, descripcion: "Extremadamente alta: 1 en 20" }, { valor: 10, descripcion: "Casi segura: >1 en 10" },
];

function ScaleTable({ data }: { data: { valor: number; descripcion: string }[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="text-left pb-2 font-medium text-muted-foreground w-20">Valor</th>
          <th className="text-left pb-2 font-medium text-muted-foreground">Descripción</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.valor} className="border-b last:border-0">
            <td className="py-2 font-bold font-mono">{item.valor}</td>
            <td className="py-2">{item.descripcion}</td>
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
        <p className="text-sm text-muted-foreground">Escalas de evaluación según ISO 14971 / NOM-241</p>
      </div>

      <Tabs defaultValue="severidad">
        <TabsList>
          <TabsTrigger value="severidad">Severidad</TabsTrigger>
          <TabsTrigger value="ocurrencia">Ocurrencia</TabsTrigger>
          <TabsTrigger value="deteccion">Detección</TabsTrigger>
        </TabsList>
        <TabsContent value="severidad">
          <Card><CardContent className="pt-6"><ScaleTable data={severidadData} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="ocurrencia">
          <Card><CardContent className="pt-6"><ScaleTable data={ocurrenciaData} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="deteccion">
          <Card><CardContent className="pt-6"><ScaleTable data={severidadData.map((s) => ({ valor: s.valor, descripcion: s.descripcion.replace("efecto", "capacidad de detección") }))} /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
