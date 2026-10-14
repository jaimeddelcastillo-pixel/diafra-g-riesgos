import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail } from './send-email.ts'
import { TEMPLATES } from './registry.ts'

// Envía una plantilla registrada y deja el registro en email_send_log
// ('sent' | 'suppressed' | 'failed'), igual que el flujo anterior.
// Nunca lanza: devuelve { data, error } como el antiguo functions.invoke,
// para que cada función conserve su manejo de errores.
export interface EnviarOpciones {
  templateName: string
  recipientEmail?: string | null
  idempotencyKey?: string
  templateData?: Record<string, any>
  replyTo?: string
}

export async function enviarYRegistrar(
  opts: EnviarOpciones
): Promise<{ data: { success: boolean; reason?: string } | null; error: Error | null }> {
  const template = TEMPLATES[opts.templateName]
  const recipient = (template?.to || opts.recipientEmail || '') as string
  const log = async (status: 'sent' | 'suppressed' | 'failed', error_message?: string) => {
    try {
      const url = Deno.env.get('SUPABASE_URL')
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!url || !key || !recipient) return
      const admin = createClient(url, key)
      const { error } = await admin.from('email_send_log').insert({
        message_id: null,
        template_name: opts.templateName,
        recipient_email: recipient,
        status,
        error_message: error_message ?? null,
      })
      if (error) console.error('email_send_log insert failed', { code: error.code, message: error.message })
    } catch (e) {
      console.error('email_send_log insert threw', e instanceof Error ? e.message : String(e))
    }
  }

  try {
    const r = await sendTemplateEmail(opts.templateName, recipient, {
      templateData: opts.templateData ?? {},
      idempotencyKey: opts.idempotencyKey,
      replyTo: opts.replyTo,
    })
    if (r.sent) {
      await log('sent')
      return { data: { success: true }, error: null }
    }
    await log('suppressed')
    return { data: { success: false, reason: 'email_suppressed' }, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await log('failed', msg.slice(0, 1000))
    return { data: null, error: e instanceof Error ? e : new Error(msg) }
  }
}
