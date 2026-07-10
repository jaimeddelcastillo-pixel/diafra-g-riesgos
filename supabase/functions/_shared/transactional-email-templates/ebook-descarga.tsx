/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, infoBox, dataRow } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  email?: string
  titulo_ebook?: string
  url_descarga?: string
  password_temporal?: string
}

const orangeButton: React.CSSProperties = {
  backgroundColor: '#E8671A',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700,
  textDecoration: 'none',
  padding: '14px 28px',
  borderRadius: '6px',
  display: 'inline-block',
}

const EbookDescargaEmail = ({ nombre, email, titulo_ebook, url_descarga, password_temporal }: Props) => {
  const safeEbookUrl = url_descarga || 'https://tracea.com.mx'
  const loginUrl = 'https://tracea.com.mx/login'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const titulo = titulo_ebook || 'Tu guía TRACEA'
  return (
    <TraceaShell preview="Tu guía + acceso a TRACEA están listos">
      <Heading style={h1}>Tu guía + acceso a TRACEA</Heading>
      <Text style={text}>{saludo}</Text>
      <Text style={text}>Aquí está tu guía:</Text>
      <Section style={infoBox}>
        <Text style={{ ...dataRow, fontWeight: 600 }}>{titulo}</Text>
      </Section>
      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={safeEbookUrl} style={button}>Descargar la guía</Button>
      </Section>
      <Hr style={hrStyle} />
      <Text style={text}>
        <strong>Tu cuenta gratuita de 14 días en TRACEA ya está lista.</strong>
      </Text>
      <Section style={infoBox}>
        {email && <Text style={dataRow}><strong>Email:</strong> {email}</Text>}
        {password_temporal && (
          <Text style={dataRow}><strong>Contraseña temporal:</strong> <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 14 }}>{password_temporal}</code></Text>
        )}
      </Section>
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button href={loginUrl} style={orangeButton}>Entrar a TRACEA ahora</Button>
      </Section>
      <Text style={smallText}>
        Al entrar por primera vez te pedimos completar tu perfil — toma menos de 2 minutos.
      </Text>
      <Hr style={hrStyle} />
      <Text style={text}>El expediente que puedes defender ante COFEPRIS empieza hoy.</Text>
      <Text style={{ ...text, marginBottom: 0 }}><strong>Ing. Jaime Del Castillo</strong></Text>
      <Text style={{ ...smallText, marginTop: 0 }}>Fundador, TRACEA · <a href="https://tracea.com.mx" style={{ color: '#185FA5' }}>tracea.com.mx</a></Text>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón de acceso no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{loginUrl}</Text>
    </TraceaShell>
  )
}

export const template = {
  component: EbookDescargaEmail,
  subject: 'Tu guía + acceso a TRACEA están listos — Ing. Jaime Del Castillo',
  displayName: 'Descarga de guía + acceso trial',
  previewData: {
    nombre: 'María Pérez',
    email: 'maria@ejemplo.mx',
    titulo_ebook: 'Los 5 errores que generan observaciones en auditorías COFEPRIS — Dispositivos Médicos',
    url_descarga: 'https://drive.google.com/file/d/EJEMPLO/view',
    password_temporal: 'Tr4c3a-Xy9K',
  },
} satisfies TemplateEntry