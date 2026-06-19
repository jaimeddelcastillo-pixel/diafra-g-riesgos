import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { GraduationCap, Download, ShieldCheck, FileText } from "lucide-react";

type DiplomaRow = {
  id: string;
  folio: string;
  curso_titulo: string;
  curso_norma: string | null;
  fecha_emision: string;
  calificacion: number;
  hash_verificacion: string;
  pdf_path: string;
};

export default function MisDiplomas() {
  const [loading, setLoading] = useState(true);
  const [diplomas, setDiplomas] = useState<DiplomaRow[]>([]);
  const [descargando, setDescargando] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("curso_diplomas")
        .select("id, folio, curso_titulo, curso_norma, fecha_emision, calificacion, hash_verificacion, pdf_path")
        .eq("user_id", user.id)
        .order("fecha_emision", { ascending: false });
      if (error) {
        toast.error("No se pudieron cargar tus diplomas");
      } else {
        setDiplomas((data ?? []) as DiplomaRow[]);
      }
      setLoading(false);
    })();
  }, []);

  const descargar = async (d: DiplomaRow) => {
    setDescargando(d.id);
    try {
      const { data, error } = await supabase.storage
        .from("diplomas")
        .createSignedUrl(d.pdf_path, 60, { download: `${d.folio}.pdf` });
      if (error || !data?.signedUrl) throw error ?? new Error("No se pudo generar la descarga");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al generar la descarga");
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-[#0B2545]" />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0B2545" }}>Mis diplomas</h1>
          <p className="text-sm text-muted-foreground">
            Diplomas de aprovechamiento emitidos por TRACEA Academy. Descárgalos cuando los necesites.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : diplomas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-3">
            <FileText className="h-10 w-10 mx-auto opacity-50" />
            <p>Aún no tienes diplomas emitidos.</p>
            <Button asChild variant="outline">
              <Link to="/capacitacion">Ir a Capacitación</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {diplomas.map((d) => (
            <Card key={d.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{d.curso_titulo}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono">{d.folio}</Badge>
                      {d.curso_norma && <Badge variant="secondary">{d.curso_norma}</Badge>}
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    {Number(d.calificacion).toFixed(0)} / 100
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  Emitido el{" "}
                  {new Date(d.fecha_emision).toLocaleDateString("es-MX", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/diploma/verificar/${d.hash_verificacion}`} target="_blank">
                      <ShieldCheck className="h-4 w-4 mr-1" /> Verificar
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => descargar(d)}
                    disabled={descargando === d.id}
                    style={{ backgroundColor: "#0B2545" }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    {descargando === d.id ? "Generando…" : "Descargar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}