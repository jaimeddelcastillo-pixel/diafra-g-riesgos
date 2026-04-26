/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'TRACEA'

interface ReactivacionCuentaProps {
  nombre?: string
  organizacion?: string
  diasInactividad?: number
  mensajePersonalizado?: string
  loginUrl?: string
  soporteEmail?: string
}

const ReactivacionCuentaEmail = ({
  nombre,
  organizacion,
  diasInactividad,
  mensajePersonalizado,
  loginUrl,
  soporteEmail,
}: ReactivacionCuentaProps) => {
  const safeLoginUrl = loginUrl || 'https://tracea.com.mx/login'
  const safeSoporte = soporteEmail || 'soporte@tracea.com.mx'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const orgLabel = organizacion ? ` de ${organizacion}` : ''
  const diasLabel = diasInactividad && diasInactividad > 0
    ? `Hemos notado que no has registrado actividad en ${SITE_NAME} en los últimos ${diasInactividad} días.`
    : `Hemos notado que tu cuenta${orgLabel} no ha registrado actividad reciente en ${SITE_NAME}.`
  const cuerpo = mensajePersonalizado?.trim()
    ? mensajePersonalizado.trim()
    : 'Queremos asegurarnos de que sigas aprovechando todas las herramientas de gestión de riesgos: matriz AMEF, control NPR, dictámenes y trazabilidad ISO 14971 / NOM-241.'

  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>Te extrañamos en TRACEA — reactiva tu cuenta</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Heading style={brand}>TRACEA</Heading>
            <Text style={brandTagline}>Gestión de Riesgos · ISO 14971 · NOM-241</Text>
          </Section>

          <Section style={card}>
            <Heading style={h1}>Te extrañamos</Heading>
            <Text style={text}>{saludo}</Text>
            <Text style={text}>{diasLabel}</Text>
            <Text style={text}>{cuerpo}</Text>

            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <Button href={safeLoginUrl} style={button}>
                Volver a TRACEA
              </Button>
            </Section>

            <Text style={smallText}>
              Si el botón no funciona, copia y pega esta dirección en tu navegador:
            </Text>
            <Text style={linkFallback}>{safeLoginUrl}</Text>

            <Hr style={hr} />

            <Text style={text}>
              ¿Necesitas ayuda para retomar el uso de la plataforma o tienes alguna sugerencia?
              Escríbenos a{' '}
              <a href={`mailto:${safeSoporte}`} style={inlineLink}>{safeSoporte}</a> y
              uno de nuestros asesores te acompañará personalmente.
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
  component: ReactivacionCuentaEmail,
  subject: (data: Record<string, any>) =>
    data?.organizacion
      ? `Te extrañamos en TRACEA — ${data.organizacion}`
      : 'Te extrañamos en TRACEA — reactiva tu cuenta',
  displayName: 'Reactivación de cuenta',
  previewData: {
    nombre: 'Carlos Méndez',
    organizacion: 'DIAFRA',
    diasInactividad: 35,
    mensajePersonalizado: '',
    loginUrl: 'https://tracea.com.mx/login',
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