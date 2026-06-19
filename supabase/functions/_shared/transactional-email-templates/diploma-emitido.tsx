/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, successBox, infoBox, dataRow,
} from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  curso_titulo?: string
  norma?: string
  folio_diploma?: string
  calificacion?: number | string
  fecha?: string
  verificacion_url?: string
  plataforma_url?: string
}

const DiplomaEmitidoEmail = ({
  nombre, curso_titulo, norma, folio_diploma, calificacion, fecha, verificacion_url, plataforma_url,
}: Props) => {
  const saludo = nombre ? `Estimado(a) ${nombre},` : 'Hola,'
  const verLink = verificacion_url || 'https://tracea.com.mx'
  const misDiplomasLink = plataforma_url || 'https://tracea.com.mx/mis-diplomas'
  return (
    <TraceaShell preview={`Diploma emitido — ${folio_diploma || 'TRACEA Academy'}`}>
      <Heading style={h1}>¡Felicidades! Diploma emitido</Heading>
      <Text style={text}>{saludo}</Text>
      <Section style={successBox}>
        <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#1b5e20' }}>
          ✅ Aprobaste la evaluación final del curso.
        </Text>
      </Section>
      <Text style={text}>
        TRACEA Academy te emite el diploma de aprovechamiento del programa de capacitación en
        Gestión de Riesgos conforme a {norma || 'NOM-241-SSA1-2025'}. Tu diploma queda disponible
        permanentemente en la plataforma; puedes descargarlo cuando lo necesites desde la sección
        "Mis diplomas".
      </Text>
      <Section style={infoBox}>
        <Text style={dataRow}><strong>Curso:</strong> {curso_titulo || '—'}</Text>
        <Text style={dataRow}><strong>Folio del diploma:</strong> {folio_diploma || '—'}</Text>
        <Text style={dataRow}><strong>Calificación:</strong> {calificacion ?? '—'} / 100</Text>
        <Text style={dataRow}><strong>Fecha de emisión:</strong> {fecha || '—'}</Text>
      </Section>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={misDiplomasLink} style={button}>Ver mis diplomas</Button>
      </Section>
      <Text style={smallText}>
        Inicia sesión en TRACEA Academy y descarga tu diploma desde "Mis diplomas".
      </Text>
      <Hr style={hrStyle} />
      <Text style={smallText}>Verificación pública del diploma:</Text>
      <Text style={linkFallback}>{verLink}</Text>
    </TraceaShell>
  )
}

export const template = {
  component: DiplomaEmitidoEmail,
  subject: (data: Record<string, any>) => {
    const codigo = data?.folio_diploma || 'TRACEA Academy'
    return `🎓 Diploma emitido — ${codigo}`
  },
  displayName: 'Diploma de aprovechamiento emitido',
  previewData: {
    nombre: 'Q.F.B. María López',
    curso_titulo: 'Gestión de Riesgos NOM-241-SSA1-2025',
    norma: 'NOM-241-SSA1-2025',
    folio_diploma: 'DIP-2026-001',
    calificacion: 90,
    fecha: '19 de junio de 2026',
    verificacion_url: 'https://tracea.com.mx/diploma/verificar/abc123',
    plataforma_url: 'https://tracea.com.mx/mis-diplomas',
  },
} satisfies TemplateEntry