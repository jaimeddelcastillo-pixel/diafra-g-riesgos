import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Pencil, ListChecks } from "lucide-react";

type CursoRow = {
  id: string;
  norma: string;
  titulo: string;
  descripcion: string;
  activo: boolean;
  orden: number;
};

export default function AdminCursos() {
  const { isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [cursos, setCursos] = useState<CursoRow[]>([]);
  const [load, setLoad] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("cursos")
        .select("id, norma, titulo, descripcion, activo, orden")
        .order("orden", { ascending: true });
      setCursos(data ?? []);
      setLoad(false);
    })();
  }, []);

  if (loading) return null;
  if (!isSuperAdmin()) return <Navigate to="/" replace />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-[hsl(var(--primary))]" />
        <div>
          <h1 className="text-2xl font-bold">Gestión de Cursos</h1>
          <p className="text-sm text-muted-foreground">
            Edita módulos, lecciones, videos y evaluaciones sin tocar código.
          </p>
        </div>
      </div>

      {load ? (
        <div className="text-sm text-muted-foreground">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cursos.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{c.titulo}</CardTitle>
                    <CardDescription>{c.descripcion}</CardDescription>
                  </div>
                  <Badge variant="outline">{c.norma}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge
                  variant="outline"
                  className={
                    c.activo
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {c.activo ? "Activo" : "Inactivo"}
                </Badge>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => navigate(`/admin/cursos/${c.id}`)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar curso
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/cursos/${c.id}/evaluacion`)}
                  >
                    <ListChecks className="h-4 w-4 mr-2" />
                    Editar evaluación
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