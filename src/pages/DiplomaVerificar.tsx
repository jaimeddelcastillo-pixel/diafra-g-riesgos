import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, GraduationCap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Diploma = {
  folio: string;
  alumno_nombre: string;
  curso_titulo: string;
  curso_norma: string;
  fecha_emision: string;
  calificacion: number;
};

export default function DiplomaVerificar() {
  const { hash } = useParams<{ hash: string }>();
  const [loading, setLoading] = useState(true);
  const [dip, setDip] = useState<Diploma | null>(null);

  useEffect(() => {
    if (!hash) return;
    (async () => {
      const { data } = await supabase.rpc("verificar_diploma", { p_hash: hash });
      const row = Array.isArray(data) ? data[0] : null;
      setDip((row as any) ?? null);
      setLoading(false);
    })();
  }, [hash]);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-4">
        <div className="text-center">
          <GraduationCap className="h-12 w-12 mx-auto text-[#0B2545]" />
          <h1 className="text-2xl font-bold mt-2" style={{ color: "#0B2545" }}>
            Verificación de diploma — TRACEA Academy
          </h1>
        </div>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : dip ? (
          <Card>
            <CardHeader className="text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <CardTitle className="mt-2">Diploma válido</CardTitle>
              <Badge variant="outline" className="mx-auto mt-2 font-mono">{dip.folio}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Otorgado a</span>
                <span className="col-span-2 font-semibold">{dip.alumno_nombre}</span>
                <span className="text-muted-foreground">Curso</span>
                <span className="col-span-2">{dip.curso_titulo}</span>
                <span className="text-muted-foreground">Norma</span>
                <span className="col-span-2">{dip.curso_norma}</span>
                <span className="text-muted-foreground">Calificación</span>
                <span className="col-span-2">{Number(dip.calificacion).toFixed(0)} / 100</span>
                <span className="text-muted-foreground">Fecha de emisión</span>
                <span className="col-span-2">
                  {new Date(dip.fecha_emision).toLocaleDateString("es-MX", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-3 border-t mt-3">
                Documento de aprovechamiento académico emitido por TRACEA Academy en cumplimiento del programa de
                capacitación en Gestión de Riesgos conforme a NOM-241-SSA1-2025 y FEUM Suplemento para Dispositivos
                Médicos 5.0. Instructor: Ing. Jaime David Del Castillo Couret.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <CardTitle className="mt-2">Diploma no encontrado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                El identificador proporcionado no corresponde a ningún diploma emitido por TRACEA Academy.
              </p>
            </CardContent>
          </Card>
        )}
        <div className="text-center">
          <Link to="/" className="text-xs text-muted-foreground underline">tracea.com.mx</Link>
        </div>
      </div>
    </div>
  );
}