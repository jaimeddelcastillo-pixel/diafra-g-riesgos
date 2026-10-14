import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.3.1'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Conserva los registros históricos: suppressed_emails + email_send_log,
// con los mismos textos que usaba el flujo anterior (solo informativo).
type Motivo = 'bounce' | 'complaint' | 'unsubscribe'
const ESTADO: Record<Motivo, string> = { bounce: 'bounced', complaint: 'complained', unsubscribe: 'suppressed' }
const MENSAJE: Record<Motivo, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

async function registrar(motivo: Motivo, event: { event_id: string; data: { recipient: string } }) {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const email = event.data.recipient.toLowerCase()

  const { error: supErr } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason: motivo, metadata: null }, { onConflict: 'email' })
  if (supErr) {
    console.error('suppressed_emails upsert failed', { code: supErr.code, message: supErr.message, event_id: event.event_id })
    throw new Error('suppressed_emails upsert failed')
  }

  const { error: logErr } = await supabase.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: email,
    status: ESTADO[motivo],
    error_message: MENSAJE[motivo],
    metadata: null,
  })
  if (logErr) {
    console.error('email_send_log insert failed', { code: logErr.code, message: logErr.message, event_id: event.event_id })
    throw new Error('email_send_log insert failed')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await registrar('bounce', event)
    },
    'email.complaint': async (event) => {
      await registrar('complaint', event)
    },
    'email.unsubscribed': async (event) => {
      await registrar('unsubscribe', event)
    },
  },
})

Deno.serve((req) => handler(req))
