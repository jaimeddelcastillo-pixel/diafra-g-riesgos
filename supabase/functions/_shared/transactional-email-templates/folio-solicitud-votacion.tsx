/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, infoBox, dataRow } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  folio_codigo?: string
  proceso?: string
  organizacion?: string
  norma_nombre?: string
  norma_largo?: string
  metodologia?: string
  documento?: string
  proceso_label?: string
  total_riesgos?: number | string
  recordatorio?: boolean
  link?: string
}

const FolioSolicitudVotacionEmail = ({
  nombre, folio_codigo, proceso, organizacion,
  norma_nombre, norma_largo, metodologia, documento, proceso_label,
  total_riesgos, recordatorio, link,
}: Props) => {
  const safeLink = link || 'https://tracea.com.mx/folios'
  const saludo = nombre ? `Estimado(a) ${nombre},` : 'Estimado(a) miembro del comité,'
  const orgLabel = (organizacion || 'TRACEA').toUpperCase()
  const docLabel = documento || 'Análisis de Gestión de Riesgos'
  const procLabel = proceso_label || 'Proceso / Equipo'
  const norma = norma_nombre || 'NOM-241'
  const metod = metodologia || 'AMEF'
  const refsLargo = norma_largo || 'NOM-241-SSA1-2025'
  return (
    <TraceaShell preview={`Se solicita tu revisión y voto — ${folio_codigo || 'folio TRACEA'}`}>
      <Heading style={h1}>
        {recordatorio ? 'Recordatorio: tu voto sigue pendiente' : 'Se solicita tu revisión y voto'} — {orgLabel}
      </Heading>
      <Text style={text}>{saludo}</Text>
      <Text style={text}>
        {recordatorio
          ? 'Aún no se registra tu voto en el siguiente '
          : 'Se te convoca como miembro del comité técnico a revisar y votar el siguiente '}
        <strong>{docLabel}</strong> ({norma} · {metod}):
      </Text>
      <Section style={infoBox}>
        <Text style={dataRow}><strong>Folio:</strong> {folio_codigo || '—'}</Text>
        <Text style={dataRow}><strong>{procLabel}:</strong> {proceso || '—'}</Text>
        <Text style={dataRow}><strong>Norma:</strong> {refsLargo} ({metod})</Text>
        {total_riesgos !== undefined && total_riesgos !== null && (
          <Text style={dataRow}><strong>Riesgos analizados:</strong> {total_riesgos}</Text>
        )}
      </Section>
      <Text style={text}>
        Tu voto puede ser <strong>Apruebo</strong>, <strong>Apruebo con observaciones</strong> o{' '}
        <strong>Rechazo</strong>. Esta etapa es de revisión: la firma electrónica se solicitará
        después, en un correo aparte.
      </Text>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLink} style={button}>Revisar y votar</Button>
      </Section>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLink}</Text>
    </TraceaShell>
  )
}

export const template = {
  component: FolioSolicitudVotacionEmail,
  subject: (data: Record<string, any>) => {
    const org = data?.organizacion ? `[${String(data.organizacion).toUpperCase()}] ` : ''
    const codigo = data?.folio_codigo || 'folio'
    const pre = data?.recordatorio ? 'Recordatorio de votación' : 'Solicitud de votación'
    return `${org}${pre} — ${codigo}`
  },
  displayName: 'Solicitud de votación del comité',
  previewData: {
    nombre: 'Ing. Ana Ruiz',
    folio_codigo: 'GR-2026-001',
    proceso: 'Línea de envasado A1',
    organizacion: 'DIAFRA',
    norma_nombre: 'NOM-241',
    norma_largo: 'NOM-241-SSA1-2025',
    metodologia: 'AMEF',
    documento: 'Archivo de Gestión de Riesgos',
    proceso_label: 'Proceso / Equipo',
    total_riesgos: 38,
    recordatorio: false,
    link: 'https://tracea.com.mx/folios/abc-123',
  },
} satisfies TemplateEntry
