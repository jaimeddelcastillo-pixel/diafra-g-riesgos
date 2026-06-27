/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  TraceaShell, h1, text, smallText, button, hrStyle, successBox, infoBox, dataRow,
} from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  curso_titulo?: string
  dc3_url?: string
  notas?: string
}

const Email = ({ nombre, curso_titulo, dc3_url, notas }: Props) => {
  const saludo = nombre ? `Estimado(a) ${nombre},` : 'Hola,'
  return (
    <TraceaShell preview="Tu DC-3 oficial STPS ya está disponible">
      <Heading style={h1}>Tu DC-3 oficial está listo</Heading>
      <Text style={text}>{saludo}</Text>
      <Section style={successBox}>
        <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#1b5e20' }}>
          ✅ Tu constancia DC-3 oficial STPS ha sido emitida ante SIRCE.
        </Text>
      </Section>
      <Section style={infoBox}>
        <Text style={dataRow}><strong>Curso:</strong> {curso_titulo || '—'}</Text>
      </Section>
      {dc3_url && (
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={dc3_url} style={button}>Descargar mi DC-3</Button>
        </Section>
      )}
      {notas && (
        <Text style={smallText}><strong>Notas:</strong> {notas}</Text>
      )}
      <Hr style={hrStyle} />
      <Text style={smallText}>
        Conserva esta constancia para acreditar tu capacitación ante la STPS.
      </Text>
    </TraceaShell>
  )
}

export const template = {
  component: Email,
  subject: '✅ Tu DC-3 oficial STPS está listo',
  displayName: 'DC-3 — Constancia enviada (alumno)',
  previewData: {
    nombre: 'María López',
    curso_titulo: 'Gestión de Riesgos NOM-241-SSA1-2025',
    dc3_url: 'https://tracea.com.mx/dc3/ejemplo.pdf',
  },
} satisfies TemplateEntry