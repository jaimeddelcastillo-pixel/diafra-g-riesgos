/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, warnBox, infoBox, dataRow,
} from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  folio_codigo?: string
  proceso?: string
  organizacion?: string
  meses?: number
  norma_nombre?: string
  link?: string
}

const FolioRevisionPendienteEmail = ({
  nombre, folio_codigo, proceso, organizacion, meses, norma_nombre, link,
}: Props) => {
  const safeLink = link || 'https://tracea.com.mx/folios'
  const saludo = nombre ? `Estimado(a) ${nombre},` : 'Estimado(a) Responsable Sanitario,'
  const orgLabel = (organizacion || 'TRACEA').toUpperCase()
  return (
    <TraceaShell preview={`Revisión periódica pendiente — ${folio_codigo || ''}`}>
      <Heading style={h1}>Revisión periódica del archivo de gestión de riesgos — {orgLabel}</Heading>
      <Text style={text}>{saludo}</Text>
      <Section style={warnBox}>
        <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#7a3d00' }}>
          ⚠ Han pasado {meses ?? 12} meses desde la última aprobación de este folio.
        </Text>
      </Section>
      <Text style={text}>
        Conforme a {norma_nombre || 'NOM-241'} e ISO 14971 §10, el archivo de gestión de riesgos
        debe revisarse periódicamente al menos cada 12 meses. Se requiere que valides si el
        contenido sigue vigente o si debe reabrirse para actualización.
      </Text>
      <Section style={infoBox}>
        <Text style={dataRow}><strong>Folio:</strong> {folio_codigo || '—'}</Text>
        <Text style={dataRow}><strong>Proceso / Equipo:</strong> {proceso || '—'}</Text>
      </Section>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLink} style={button}>Revisar expediente</Button>
      </Section>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLink}</Text>
    </TraceaShell>
  )
}

export const template = {
  component: FolioRevisionPendienteEmail,
  subject: (data: Record<string, any>) => {
    const org = data?.organizacion ? `[${String(data.organizacion).toUpperCase()}] ` : ''
    const codigo = data?.folio_codigo || 'folio'
    return `${org}⚠ Revisión periódica pendiente — ${codigo}`
  },
  displayName: 'Recordatorio revisión 12 meses',
  previewData: {
    nombre: 'Q.F.B. María López',
    folio_codigo: 'GR-SGC-2024-001',
    proceso: 'Empaque primario',
    organizacion: 'DIAFRA',
    meses: 13,
    norma_nombre: 'NOM-241',
    link: 'https://tracea.com.mx/folios/abc',
  },
} satisfies TemplateEntry