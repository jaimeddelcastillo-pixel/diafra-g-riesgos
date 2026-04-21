// Auto-cierre de tickets resueltos sin actividad por 7+ días
// Ejecutado por pg_cron diariamente
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar tickets Resueltos hace más de 7 días sin actividad
    const sieteDiasAtras = new Date();
    sieteDiasAtras.setDate(sieteDiasAtras.getDate() - 7);

    const { data: tickets, error: selectError } = await supabase
      .from("tickets")
      .select("id, codigo, asunto, created_by_email, created_by_nombre, org_id")
      .eq("estado", "Resuelto")
      .lt("updated_at", sieteDiasAtras.toISOString());

    if (selectError) throw selectError;

    const cerrados: string[] = [];
    const errores: string[] = [];

    for (const ticket of tickets ?? []) {
      const { error: updateError } = await supabase
        .from("tickets")
        .update({ estado: "Cerrado" })
        .eq("id", ticket.id);

      if (updateError) {
        errores.push(`${ticket.codigo}: ${updateError.message}`);
        continue;
      }

      cerrados.push(ticket.codigo);

      // Notificar al cliente vía edge function de notificación de tickets
      try {
        await supabase.functions.invoke("ticket-notify", {
          body: {
            event: "auto_closed",
            ticket_id: ticket.id,
            recipient_email: ticket.created_by_email,
            recipient_name: ticket.created_by_nombre,
            ticket_codigo: ticket.codigo,
            ticket_asunto: ticket.asunto,
          },
        });
      } catch (e) {
        console.error(`Error notificando cierre de ${ticket.codigo}:`, e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        revisados: tickets?.length ?? 0,
        cerrados: cerrados.length,
        codigos_cerrados: cerrados,
        errores,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Error en auto-close-tickets:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});