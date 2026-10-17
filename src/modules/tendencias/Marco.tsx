import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Activity,ClipboardList,Settings,Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
export default function Marco({titulo,children}:{titulo:string;children:ReactNode}){
 return <div className="max-w-7xl space-y-6"><header className="space-y-3"><div className="flex flex-wrap items-center gap-3"><Activity className="h-6 w-6 text-primary"/><h1 className="text-2xl font-bold">{titulo}</h1><Badge variant="outline">beta</Badge></div><nav className="flex flex-wrap gap-2" aria-label="Tendencias"><Button variant="outline" size="sm" asChild><Link to="/tendencias"><Activity className="mr-2 h-4 w-4"/>Tablero</Link></Button><Button variant="outline" size="sm" asChild><Link to="/tendencias/captura"><ClipboardList className="mr-2 h-4 w-4"/>Captura</Link></Button><Button variant="outline" size="sm" asChild><Link to="/tendencias/catalogos"><Database className="mr-2 h-4 w-4"/>Catálogos</Link></Button><Button variant="outline" size="sm" asChild><Link to="/tendencias/configuracion"><Settings className="mr-2 h-4 w-4"/>Configuración</Link></Button></nav></header>{children}</div>;
}
