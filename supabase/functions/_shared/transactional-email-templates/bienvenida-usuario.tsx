/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'TRACEA'

interface BienvenidaProps {
  nombre?: string
  organizacion?: string
  rol?: string
  setupUrl?: string
  loginUrl?: string
}

const BienvenidaUsuarioEmail = ({
  nombre,
  organizacion,
  rol,
  setupUrl,
  loginUrl,
}: BienvenidaProps) => {
  const safeSetupUrl = setupUrl || 'https://tracea.com.mx/login'
  const safeLoginUrl = loginUrl || 'https://tracea.com.mx/login'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const orgLabel = organizacion ? ` en ${organizacion}` : ''
  const rolLabel = rol ? ` con el rol de ${rol}` : ''

  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>Tu cuenta TRACEA está lista — define tu contraseña</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Heading style={brand}>TRACEA</Heading>
            <Text style={brandTagline}>Gestión de Riesgos · ISO 14971 · NOM-241</Text>
          </Section>

          <Section style={card}>
            <Heading style={h1}>Bienvenido(a) a TRACEA</Heading>
            <Text style={text}>{saludo}</Text>
            <Text style={text}>
              Se ha creado tu cuenta de acceso a la plataforma <strong>{SITE_NAME}</strong>
              {orgLabel}{rolLabel}.
            </Text>
            <Text style={text}>
              Para activar tu cuenta y acceder, define tu contraseña personal con el
              siguiente botón. El enlace es válido por 24 horas.
            </Text>

            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <Button href={safeSetupUrl} style={button}>
                Establecer mi contraseña
              </Button>
            </Section>

            <Text style={smallText}>
              Si el botón no funciona, copia y pega esta dirección en tu navegador:
            </Text>
            <Text style={linkFallback}>{safeSetupUrl}</Text>

            <Hr style={hr} />

            <Text style={text}>
              <strong>Próximos pasos:</strong>
            </Text>
            <Text style={listItem}>1. Define una contraseña segura (mínimo 8 caracteres).</Text>
            <Text style={listItem}>2. Inicia sesión en{' '}
              <a href={safeLoginUrl} style={inlineLink}>{safeLoginUrl}</a>
            </Text>
            <Text style={listItem}>3. Sube tu firma electrónica desde Configuración para poder firmar folios.</Text>

            <Hr style={hr} />

            <Text style={footer}>
              Si no esperabas este correo, ignóralo. Tu cuenta no se activará hasta que
              definas una contraseña.
            </Text>
            <Text style={footer}>
              — Equipo {SITE_NAME}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BienvenidaUsuarioEmail,
  subject: (data: Record<string, any>) =>
    data?.organizacion
      ? `Bienvenido a TRACEA — activa tu cuenta de ${data.organizacion}`
      : 'Bienvenido a TRACEA — activa tu cuenta',
  displayName: 'Bienvenida de usuario',
  previewData: {
    nombre: 'Operaciones DIAFRA',
    organizacion: 'DIAFRA',
    rol: 'Administrador',
    setupUrl: 'https://tracea.com.mx/reset-password#access_token=demo',
    loginUrl: 'https://tracea.com.mx/login',
  },
} satisfies TemplateEntry

// === Styles (TRACEA brand: Navy #042C53 / Cobalt #185FA5) ===
const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '24px 16px',
}
const brandBar: React.CSSProperties = {
  backgroundColor: '#042C53',
  padding: '24px',
  borderRadius: '8px 8px 0 0',
  textAlign: 'center',
}
const brand: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 700,
  letterSpacing: '2px',
  margin: 0,
}
const brandTagline: React.CSSProperties = {
  color: '#8587E8',
  fontSize: '12px',
  margin: '6px 0 0',
  letterSpacing: '0.5px',
}
const card: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e6ebf1',
  borderTop: 'none',
  borderRadius: '0 0 8px 8px',
  padding: '32px 28px',
}
const h1: React.CSSProperties = {
  color: '#042C53',
  fontSize: '22px',
  fontWeight: 700,
  margin: '0 0 20px',
}
const text: React.CSSProperties = {
  color: '#1f2937',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 14px',
}
const listItem: React.CSSProperties = {
  color: '#1f2937',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 8px',
  paddingLeft: '8px',
}
const button: React.CSSProperties = {
  backgroundColor: '#185FA5',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
  padding: '14px 28px',
  borderRadius: '6px',
  display: 'inline-block',
}
const smallText: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 6px',
}
const linkFallback: React.CSSProperties = {
  color: '#185FA5',
  fontSize: '12px',
  wordBreak: 'break-all',
  margin: '0 0 16px',
}
const inlineLink: React.CSSProperties = {
  color: '#185FA5',
  textDecoration: 'underline',
}
const hr: React.CSSProperties = {
  borderColor: '#e6ebf1',
  margin: '24px 0',
}
const footer: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 6px',
}