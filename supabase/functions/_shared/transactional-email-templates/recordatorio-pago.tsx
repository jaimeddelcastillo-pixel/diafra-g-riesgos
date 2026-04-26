/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'TRACEA'

interface RecordatorioPagoProps {
  nombre?: string
  organizacion?: string
  motivo?: string
  pagoUrl?: string
  soporteEmail?: string
}

const RecordatorioPagoEmail = ({
  nombre,
  organizacion,
  motivo,
  pagoUrl,
  soporteEmail,
}: RecordatorioPagoProps) => {
  const safePagoUrl = pagoUrl || 'https://tracea.com.mx/pago-pendiente'
  const safeSoporte = soporteEmail || 'soporte@tracea.com.mx'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const orgLabel = organizacion ? ` de ${organizacion}` : ''
  const motivoLabel = motivo?.trim() ? motivo.trim() : 'Tu cuenta tiene un pago pendiente y no podrás acceder a la plataforma hasta completarlo.'

  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>Recordatorio de pago — completa tu suscripción TRACEA</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Heading style={brand}>TRACEA</Heading>
            <Text style={brandTagline}>Gestión de Riesgos · ISO 14971 · NOM-241</Text>
          </Section>

          <Section style={card}>
            <Heading style={h1}>Recordatorio de pago</Heading>
            <Text style={text}>{saludo}</Text>
            <Text style={text}>
              Te escribimos respecto a tu cuenta{orgLabel} en <strong>{SITE_NAME}</strong>.
            </Text>
            <Text style={text}>{motivoLabel}</Text>

            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <Button href={safePagoUrl} style={button}>
                Completar mi pago
              </Button>
            </Section>

            <Text style={smallText}>
              Si el botón no funciona, copia y pega esta dirección en tu navegador:
            </Text>
            <Text style={linkFallback}>{safePagoUrl}</Text>

            <Hr style={hr} />

            <Text style={text}>
              ¿Tienes alguna duda o necesitas ayuda con el pago? Escríbenos a{' '}
              <a href={`mailto:${safeSoporte}`} style={inlineLink}>{safeSoporte}</a> y
              uno de nuestros asesores te atenderá personalmente.
            </Text>

            <Hr style={hr} />

            <Text style={footer}>— Equipo {SITE_NAME}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: RecordatorioPagoEmail,
  subject: (data: Record<string, any>) =>
    data?.organizacion
      ? `Recordatorio de pago — ${data.organizacion}`
      : 'Recordatorio de pago — completa tu suscripción TRACEA',
  displayName: 'Recordatorio de pago',
  previewData: {
    nombre: 'Carlos Méndez',
    organizacion: 'DIAFRA',
    motivo: 'Tu cuenta está pendiente de activación. Completa el pago para acceder a TRACEA.',
    pagoUrl: 'https://tracea.com.mx/pago-pendiente',
    soporteEmail: 'soporte@tracea.com.mx',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0, padding: 0,
}
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const brandBar: React.CSSProperties = { backgroundColor: '#042C53', padding: '24px', borderRadius: '8px 8px 0 0', textAlign: 'center' }
const brand: React.CSSProperties = { color: '#ffffff', fontSize: '28px', fontWeight: 700, letterSpacing: '2px', margin: 0 }
const brandTagline: React.CSSProperties = { color: '#8587E8', fontSize: '12px', margin: '6px 0 0', letterSpacing: '0.5px' }
const card: React.CSSProperties = { backgroundColor: '#ffffff', border: '1px solid #e6ebf1', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '32px 28px' }
const h1: React.CSSProperties = { color: '#042C53', fontSize: '22px', fontWeight: 700, margin: '0 0 20px' }
const text: React.CSSProperties = { color: '#1f2937', fontSize: '15px', lineHeight: '1.6', margin: '0 0 14px' }
const button: React.CSSProperties = { backgroundColor: '#185FA5', color: '#ffffff', fontSize: '15px', fontWeight: 600, textDecoration: 'none', padding: '14px 28px', borderRadius: '6px', display: 'inline-block' }
const smallText: React.CSSProperties = { color: '#6b7280', fontSize: '12px', lineHeight: '1.5', margin: '0 0 6px' }
const linkFallback: React.CSSProperties = { color: '#185FA5', fontSize: '12px', wordBreak: 'break-all', margin: '0 0 16px' }
const inlineLink: React.CSSProperties = { color: '#185FA5', textDecoration: 'underline' }
const hr: React.CSSProperties = { borderColor: '#e6ebf1', margin: '24px 0' }
const footer: React.CSSProperties = { color: '#6b7280', fontSize: '12px', lineHeight: '1.5', margin: '0 0 6px' }
