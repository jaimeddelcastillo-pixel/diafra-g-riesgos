// Placeholder – pega aquí el contenido de folio-workflow/index.ts
Deno.serve(async (_req) => {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" },
  });
});
