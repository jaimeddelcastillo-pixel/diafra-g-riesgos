import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { BarChart3, Download, Users, Award, GraduationCap, AlertCircle } from "lucide-react";

type Curso = { id: string; titulo: string; norma: string };

type Fila = {
  user_id: string;
  nombre: string;
  email: string;
  rol: string;
  intentos: number;
  mejor_calificacion: number | null;
  aprobado: boolean;
  fecha_aprobacion: string | null;
  diploma_folio: string | null;
  diploma_hash: string | null;
};

const FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "aprobados", label: "Aprobados" },
  { value: "en_curso", label: "En curso" },
  { value: "sin_iniciar", label: "Sin iniciar" },
];

export default function Cumplimiento() {
  const { hasRole, isSuperAdmin, orgId } = useAuth();
  const autorizado = hasRole("admin") || hasRole("responsable_sanitario") || isSuperAdmin();

  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cursoId, setCursoId] = useState<string>("");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>("todos");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("cursos")
        .select("id, titulo, norma")
        .eq("activo", true)
        .order("titulo");
      const cs = (data ?? []) as Curso[];
      setCursos(cs);
      if (cs.length) {
        const nom241 = cs.find((c) => c.norma === "NOM-241");
        setCursoId(nom241?.id ?? cs[0].id);
      } else {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!cursoId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any).rpc("cumplimiento_curso", {
        p_curso_id: cursoId,
        p_org_id: orgId,
      });
      if (error) {
        toast.error(error.message ?? "No se pudo cargar el cumplimiento");
        setFilas([]);
      } else {
        setFilas((data ?? []) as Fila[]);
      }
      setLoading(false);
    })();
  }, [cursoId, orgId]);

  const kpis = useMemo(() => {
    const total = filas.length;
    const aprobados = filas.filter((f) => f.aprobado).length;
    const enCurso = filas.filter((f) => !f.aprobado && f.intentos > 0).length;
    const sinIniciar = filas.filter((f) => f.intentos === 0).length;
    const pct = total > 0 ? (aprobados / total) * 100 : 0;
    return { total, aprobados, enCurso, sinIniciar, pct };
  }, [filas]);

  const filtradas = useMemo(() => {
    return filas.filter((f) => {
      if (filtro === "aprobados" && !f.aprobado) return false;
      if (filtro === "en_curso" && (f.aprobado || f.intentos === 0)) return false;
      if (filtro === "sin_iniciar" && f.intentos !== 0) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        if (!f.nombre.toLowerCase().includes(s) && !f.email?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [filas, filtro, q]);

  const exportarCSV = () => {
    const curso = cursos.find((c) => c.id === cursoId);
    const headers = [
      "Nombre", "Email", "Rol", "Estado", "Mejor calificacion", "Intentos", "Fecha aprobacion", "Folio diploma",
    ];
    const lines = filtradas.map((f) => [
      f.nombre,
      f.email ?? "",
      f.rol,
      f.aprobado ? "Aprobado" : f.intentos > 0 ? "En curso" : "Sin iniciar",
      f.mejor_calificacion != null ? Number(f.mejor_calificacion).toFixed(0) : "",
      String(f.intentos),
      f.fecha_aprobacion ? new Date(f.fecha_aprobacion).toLocaleDateString("es-MX") : "",
      f.diploma_folio ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cumplimiento_${curso?.norma ?? "curso"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!autorizado) {
    return (
      <div className="container max-w-3xl py-10">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
            No tienes permiso para ver el cumplimiento de la organización.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-[#0B2545]" />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#0B2545" }}>
              Cumplimiento de capacitación
            </h1>
            <p className="text-sm text-muted-foreground">
              Quién de tu organización ya completó la evaluación final y con qué calificación.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={cursoId} onValueChange={setCursoId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Selecciona un curso" />
            </SelectTrigger>
            <SelectContent>
              {cursos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.titulo} · {c.norma}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportarCSV} disabled={filtradas.length === 0}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> Miembros
            </div>
            <p className="text-3xl font-bold mt-1">{kpis.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Award className="h-4 w-4 text-emerald-500" /> Aprobados
            </div>
            <p className="text-3xl font-bold mt-1 text-emerald-600">{kpis.aprobados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCap className="h-4 w-4 text-amber-500" /> En curso
            </div>
            <p className="text-3xl font-bold mt-1 text-amber-600">{kpis.enCurso}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" /> Cumplimiento
            </div>
            <p className="text-3xl font-bold mt-1">{kpis.pct.toFixed(0)}%</p>
            <Progress value={kpis.pct} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Buscar por nombre o email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-[260px]"
        />
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTROS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-2">
          {filtradas.length} de {filas.length}
        </span>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalle por usuario</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay usuarios que coincidan con el filtro.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Calificación</TableHead>
                    <TableHead className="text-center">Intentos</TableHead>
                    <TableHead>Fecha aprobación</TableHead>
                    <TableHead>Diploma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((f) => {
                    const estado = f.aprobado ? "Aprobado" : f.intentos > 0 ? "En curso" : "Sin iniciar";
                    const calif = f.mejor_calificacion != null ? Number(f.mejor_calificacion) : null;
                    return (
                      <TableRow key={f.user_id}>
                        <TableCell>
                          <div className="font-medium">{f.nombre}</div>
                          <div className="text-xs text-muted-foreground">{f.email}</div>
                        </TableCell>
                        <TableCell className="text-xs">{f.rol}</TableCell>
                        <TableCell>
                          {estado === "Aprobado" ? (
                            <Badge className="bg-emerald-500 hover:bg-emerald-500">Aprobado</Badge>
                          ) : estado === "En curso" ? (
                            <Badge variant="secondary">En curso</Badge>
                          ) : (
                            <Badge variant="outline">Sin iniciar</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {calif != null ? (
                            <span className={calif >= 80 ? "text-emerald-600 font-semibold" : calif >= 60 ? "text-amber-600" : "text-destructive"}>
                              {calif.toFixed(0)}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center text-xs">{f.intentos} / 3</TableCell>
                        <TableCell className="text-xs">
                          {f.fecha_aprobacion
                            ? new Date(f.fecha_aprobacion).toLocaleDateString("es-MX")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {f.diploma_folio ? (
                            <Link
                              to={`/diploma/verificar/${f.diploma_hash}`}
                              target="_blank"
                              className="text-xs font-mono underline text-primary"
                            >
                              {f.diploma_folio}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}