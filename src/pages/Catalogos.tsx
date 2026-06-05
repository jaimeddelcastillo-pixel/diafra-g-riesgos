import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  NORMAS_CONFIG,
  getNormaConfig,
  type NormaKey,
  type CatalogoItem,
  CATALOGO_SEVERIDAD_SGC,
} from "@/config/normas";

type CatalogoKind = "severidad" | "ocurrencia" | "deteccion";

function CatalogoTable({
  data,
  title,
  showComplement = false,
}: {
  data: CatalogoItem[];
  title: string;
  showComplement?: boolean;
}) {
  return (
    <table className="w-full text-sm border">
      <thead>
        <tr className="bg-muted border-b">
          <th className="text-center p-3 font-semibold text-muted-foreground w-[80px]">Valor</th>
          <th className="text-left p-3 font-semibold text-muted-foreground w-[200px]">Nivel</th>
          <th className="text-left p-3 font-semibold text-muted-foreground">{title}</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.valor} className="border-b last:border-0 hover:bg-muted/30">
            <td className="p-3 text-center font-mono font-bold text-base">{item.valor}</td>
            <td className="p-3 font-medium text-xs">{item.etiqueta}</td>
            <td className="p-3 text-xs whitespace-pre-line">{item.descripcion}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Catalogos() {
  const { org } = useAuth();

  // Si la org es MULTI, dejar que el usuario elija qué catálogo ver.
  // Si no, fijar a la norma de la org.
  const orgNorma = (org?.norma_aplicable ?? "NOM-241") as NormaKey;
  const isMulti = orgNorma === "MULTI";

  const [normaSeleccionada, setNormaSeleccionada] = useState<NormaKey>(
    isMulti ? "NOM-241" : orgNorma,
  );

  const config = useMemo(() => getNormaConfig(normaSeleccionada), [normaSeleccionada]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Catálogos</h1>
        <p className="text-sm text-muted-foreground">
          Escalas de evaluación 1–10
        </p>
      </div>

      {isMulti && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-3">Selecciona la norma a consultar:</p>
            <Tabs
              value={normaSeleccionada}
              onValueChange={(v) => setNormaSeleccionada(v as NormaKey)}
            >
              <TabsList>
                <TabsTrigger value="NOM-241">
                  {NORMAS_CONFIG["NOM-241"].nombre}
                </TabsTrigger>
                <TabsTrigger value="NOM-059">
                  {NORMAS_CONFIG["NOM-059"].nombre}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="severidad" key={normaSeleccionada}>
        <TabsList>
          <TabsTrigger value="severidad">Severidad (S)</TabsTrigger>
          <TabsTrigger value="ocurrencia">Ocurrencia (O)</TabsTrigger>
          {config.usarDetectabilidad && (
            <TabsTrigger value="deteccion">Detectabilidad (D)</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="severidad">
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="estandar">
                <TabsList>
                  <TabsTrigger value="estandar">Estándar (producto/proceso)</TabsTrigger>
                  <TabsTrigger value="sgc">SGC/Regulatoria (documental)</TabsTrigger>
                </TabsList>
                <TabsContent value="estandar" className="pt-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Aplica a riesgos cuyo impacto recae sobre el <strong>producto, el proceso o el paciente</strong>.
                  </p>
                  <CatalogoTable
                    data={config.catalogoSeveridad}
                    title={`Severidad (S) — ${config.nombre}`}
                  />
                </TabsContent>
                <TabsContent value="sgc" className="pt-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Aplica a riesgos <strong>documentales o regulatorios</strong> — impacto ante COFEPRIS, observaciones, no conformidades, recall.
                  </p>
                  <CatalogoTable
                    data={CATALOGO_SEVERIDAD_SGC}
                    title="Severidad (S) — Escala SGC/Regulatoria"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ocurrencia">
          <Card>
            <CardContent className="pt-6">
              <CatalogoTable
                data={config.catalogoOcurrencia}
                title={`Ocurrencia (O) — ${config.nombre}`}
              />
            </CardContent>
          </Card>
        </TabsContent>
        {config.usarDetectabilidad && (
          <TabsContent value="deteccion">
            <Card>
              <CardContent className="pt-6">
                <CatalogoTable
                  data={config.catalogoDetectabilidad}
                  title={`Detectabilidad (D) — ${config.nombre}`}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Card>
        <CardContent className="pt-6 text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Umbrales NPR:</strong> Menor &lt; {config.umbralNPRMedio} · Mayor{" "}
            {config.umbralNPRMedio}–{config.umbralNPRAlto} · Crítico &gt;{" "}
            {config.umbralNPRAlto} (o S ≥ {config.umbralSeveridadCritica})
          </p>
          <p>
            <strong>Normas de referencia:</strong> {config.normasReferencia.join(" · ")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
