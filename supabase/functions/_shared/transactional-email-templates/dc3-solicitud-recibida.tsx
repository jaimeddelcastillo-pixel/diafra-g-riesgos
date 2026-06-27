/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  TraceaShell, h1, text, smallText, button, hrStyle, infoBox, successBox, dataRow,
} from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  curso_titulo?: string
  fuente?: 'incluido' | 'comprado'
  plataforma_url?: string
}

const Email = ({ nombre, curso_titulo, fuente, plataforma_url }: Props) => {
  const saludo = nombre ? `Estimado(a) ${nombre},` : 'Hola,'
  const link = plataforma_url || 'https://tracea.com.mx/mis-diplomas'
  const fuenteTxt =
    fuente === 'comprado'
      ? 'tu DC-3 adicional adquirido'
      : 'el DC-3 incluido con tu curso'
  return (
    <TraceaShell preview="Solicitud de DC-3 recibida — TRACEA Academy">
      <Heading style={h1}>Solicitud de DC-3 recibida</Heading>
      <Text style={text}>{saludo}</Text>
      <Section style={successBox}>
        <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#1b5e20' }}>
          ✅ Hemos recibido tu solicitud de constancia DC-3 oficial STPS.
        </Text>
      </Section>
      <Text style={text}>
        TRACEA Academy emitirá ante el SIRCE de la Secretaría del Trabajo y Previsión Social
        tu constancia DC-3 correspondiente a {curso_titulo || 'tu curso aprobado'}. Aplicamos {fuenteTxt}.
      </Text>
      <Section style={infoBox}>
        <Text style={dataRow}><strong>Curso:</strong> {curso_titulo || '—'}</Text>
        <Text style={dataRow}><strong>Tiempo estimado:</strong> 2-3 días hábiles</Text>
        <Text style={dataRow}><strong>Entrega:</strong> Por correo electrónico a esta misma dirección</Text>
      </Section>
      <Text style={text}>
        Tu diploma TRACEA Academy ya está disponible y permanece en tu cuenta. La DC-3 se
        suma como constancia oficial ante autoridades laborales.
      </Text>
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button href={link} style={button}>Ver mis diplomas</Button>
      </Section>
      <Hr style={hrStyle} />
      <Text style={smallText}>
        ¿Tienes dudas? Responde este correo o escríbenos a soporte@tracea.com.mx.
      </Text>
    </TraceaShell>
  )
}

export const template = {
  component: Email,
  subject: 'Solicitud de DC-3 recibida — TRACEA Academy',
  displayName: 'DC-3 — Solicitud recibida (alumno)',
  previewData: {
    nombre: 'María López',
    curso_titulo: 'Gestión de Riesgos NOM-241-SSA1-2025',
    fuente: 'incluido',
    plataforma_url: 'https://tracea.com.mx/mis-diplomas',
  },
} satisfies TemplateEntry