import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renderizado Markdown de solo presentación para el transcript del consultor.
 * Sin HTML crudo (no rehype-raw), sin enlaces clickeables.
 */
export function TranscriptMarkdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground break-words [overflow-wrap:anywhere] [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_ul]:pl-5 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children }) => <span>{children}</span>,
          img: () => null,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-sidebar-primary/60 pl-3 not-italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-normal before:content-none after:content-none">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 whitespace-pre-wrap break-words rounded bg-muted p-3 text-xs">{children}</pre>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}