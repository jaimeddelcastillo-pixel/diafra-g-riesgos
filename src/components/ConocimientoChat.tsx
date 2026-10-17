import { Children, isValidElement, cloneElement, type ReactNode, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import type { ContextoConocimiento } from "@/lib/skills-presentacion";
import { Link } from "react-router-dom";
import { fuenteConocimiento } from "../../supabase/functions/_shared/conocimiento-contexto";

function Chip({ codigo, items }: { codigo: string; items: ContextoConocimiento[] }) {
  const { orgId, user } = useAuth();
  const { data: acceso = false } = useQuery({ queryKey: ["chat-acceso-cerebro", orgId, user?.id], enabled: !!user,
    queryFn: async () => { const { data, error } = await supabase.rpc("mi_org_tiene_modulo", { _modulo: "institutional_brain" }); return !error && !!data; } });
  const item = items.find(k => k.codigo === codigo);
  return <HoverCard>
    <HoverCardTrigger asChild>
      <Button variant="secondary" size="sm" className="inline-flex h-auto py-0 px-1 text-xs font-mono align-baseline leading-[inherit]" asChild={!!item && acceso}>
        {item && acceso ? <Link to={`/cerebro/conocimiento#k-${item.id}`}>{codigo}</Link> : <span>{codigo}</span>}
      </Button>
    </HoverCardTrigger>
    <HoverCardContent className="max-w-[min(360px,90vw)] text-xs space-y-2">
      <p>{item?.contenido ?? "No forma parte del contexto enviado en esta respuesta."}</p>
      {item && <p className="text-muted-foreground">Fuente: {fuenteConocimiento(item.fuente)}</p>}
    </HoverCardContent>
  </HoverCard>;
}

function citar(node: ReactNode, items: ContextoConocimiento[]): ReactNode {
  return Children.map(node, (child) => {
    if (typeof child === "string") return child.split(/(\bK-\d{4,}\b)/g).map((p, i) =>
      /^K-\d{4,}$/.test(p) ? <Chip key={i} codigo={p} items={items} /> : p);
    if (isValidElement<{ children?: ReactNode }>(child)) {
      // Markdown descendants have their own wrappers; only transform text once.
      if (child.type === Chip || typeof child.type !== "string" || child.type === "a" || child.type === "pre") return child;
      return cloneElement(child, {}, citar(child.props.children, items));
    }
    return child;
  });
}

export function ConocimientoTexto({ children, items = [] }: { children: ReactNode; items?: ContextoConocimiento[] }) {
  return <>{citar(children, items)}</>;
}

export function ConocimientoMarkdown({ children, items = [] }: { children: string; items?: ContextoConocimiento[] | null }) {
  const wrap = (Tag: "p" | "li" | "td" | "th" | "strong" | "em" | "code") => ({ children: content }: { children?: ReactNode }): ReactElement =>
    <Tag>{citar(content, items ?? [])}</Tag>;
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: wrap("p"), li: wrap("li"), td: wrap("td"), th: wrap("th"), strong: wrap("strong"), em: wrap("em"), code: wrap("code") }}>{children}</ReactMarkdown>;
}