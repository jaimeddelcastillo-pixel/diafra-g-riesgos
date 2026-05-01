/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, inlineLink } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  organizacion?: string
  rol?: string
  setupUrl?: string
  loginUrl?: string
}

const BienvenidaUsuarioEmail = ({ nombre, organizacion, rol, setupUrl, loginUrl }: Props) => {
  const safeSetupUrl = setupUrl || 'https://tracea.com.mx/login'
  const safeLoginUrl = loginUrl || 'https://tracea.com.mx/login'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const orgLabel = organizacion ? ` en ${organizacion}` : ''
  const rolLabel = rol ? ` con el rol de ${rol}` : ''
  return (
    <TraceaShell preview="Tu cuenta TRACEA está lista — define tu contraseña">
      <Heading style={h1}>Bienvenido(a) a TRACEA</Heading>
      <Text style={text}>{saludo}</Text>
      <Text style={text}>
        Se ha creado tu cuenta de acceso a la plataforma <strong>TRACEA</strong>{orgLabel}{rolLabel}.
      </Text>
      <Text style={text}>
        Para activar tu cuenta y acceder, define tu contraseña personal con el siguiente botón.
        El enlace es válido por 24 horas.
      </Text>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeSetupUrl} style={button}>Establecer mi contraseña</Button>
      </Section>
      <Text style={smallText}>Si el botón no funciona, copia y pega esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeSetupUrl}</Text>
      <Hr style={hrStyle} />
      <Text style={text}><strong>Próximos pasos:</strong></Text>
      <Text style={text}>1. Define una contraseña segura (mínimo 8 caracteres).</Text>
      <Text style={text}>2. Inicia sesión en <a href={safeLoginUrl} style={inlineLink}>{safeLoginUrl}</a></Text>
      <Text style={text}>3. Sube tu firma electrónica desde Configuración para poder firmar folios.</Text>
    </TraceaShell>
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