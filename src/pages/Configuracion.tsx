import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Bell } from "lucide-react";

const mockUsers = [
  { nombre: "Dr. García López", correo: "garcia@diafra.mx", rol: "Admin" },
  { nombre: "Ing. Martínez R.", correo: "martinez@diafra.mx", rol: "Editor" },
  { nombre: "Dra. Hernández P.", correo: "hernandez@diafra.mx", rol: "Comité_Técnico" },
  { nombre: "Lic. Rodríguez S.", correo: "rodriguez@diafra.mx", rol: "Lectura" },
];

const rolStyles: Record<string, string> = {
  Admin: "bg-destructive/10 text-destructive",
  Editor: "bg-primary/10 text-primary",
  Comité_Técnico: "bg-accent/10 text-accent",
  Lectura: "bg-muted text-muted-foreground",
};

export default function Configuracion() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Gestión de usuarios, roles y notificaciones</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Usuarios del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left pb-2 font-medium text-muted-foreground">Nombre</th>
                <th className="text-left pb-2 font-medium text-muted-foreground">Correo</th>
                <th className="text-left pb-2 font-medium text-muted-foreground">Rol</th>
              </tr>
            </thead>
            <tbody>
              {mockUsers.map((u) => (
                <tr key={u.correo} className="border-b last:border-0">
                  <td className="py-2 font-medium">{u.nombre}</td>
                  <td className="py-2 text-muted-foreground">{u.correo}</td>
                  <td className="py-2">
                    <Badge className={`text-[10px] ${rolStyles[u.rol]}`}>{u.rol}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Alertas Configuradas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Las alertas de correo automático se activarán cuando se conecte el backend (Lovable Cloud).</p>
        </CardContent>
      </Card>
    </div>
  );
}
