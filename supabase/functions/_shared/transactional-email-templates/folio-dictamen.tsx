/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, successBox, errorBox, infoBox, dataRow } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  folio_codigo?: string
  proceso?: string
  organizacion?: string
  aprobador?: string
  conclusion?: string // "Aprobado" | "No Aprobado" | "Rechazado"
  motivo?: string
  version?: string
  norma_nombre?: string
  metodologia?: string
  link?: string
}

const FolioDictamenEmail = ({
  nombre, folio_codigo, proceso, organizacion, aprobador, conclusion, motivo, version,
  norma_nombre, metodologia, link,
}: Props) => {
  const safeLink = link || 'https://tracea.com.mx/folios'
  const saludo = nombre ? `Estimado(a) ${nombre},` : 'Hola,'
  const aprob = aprobador || 'Responsable Sanitario'
  const orgLabel = (organizacion || 'TRACEA').toUpperCase()
  const aprobado = (conclusion || '').toLowerCase() === 'aprobado'
  return (
    <TraceaShell
      preview={
        aprobado
          ? `Folio APROBADO — ${folio_codigo || 'TRACEA'}`
          : `Folio requiere corrección — ${folio_codigo || 'TRACEA'}`
      }
    >
      <Heading style={h1}>Dictamen del {aprob} — {orgLabel}</Heading>
      <Text style={text}>{saludo}</Text>
      {aprobado ? (
        <Section style={successBox}>
          <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#1b5e20' }}>
            ✅ Folio APROBADO por el {aprob}.
          </Text>
        </Section>
      ) : (
        <Section style={errorBox}>
          <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#b71c1c' }}>
            ⚠ Folio RECHAZADO — Requiere corrección.
          </Text>
        </Section>
      )}
      <Section style={infoBox}>
        <Text style={dataRow}><strong>Folio:</strong> {folio_codigo || '—'}</Text>
        <Text style={dataRow}><strong>Proceso / Equipo:</strong> {proceso || '—'}</Text>
        {norma_nombre && (
          <Text style={dataRow}>
            <strong>Norma:</strong> {norma_nombre}{metodologia ? ` (${metodologia})` : ''}
          </Text>
        )}
        {version && <Text style={dataRow}><strong>Versión:</strong> {version}</Text>}
        <Text style={dataRow}><strong>Dictamen:</strong> {conclusion || '—'}</Text>
        {motivo && <Text style={dataRow}><strong>Observaciones:</strong> {motivo}</Text>}
      </Section>
      {!aprobado && (
        <Text style={smallText}>
          Se ha archivado la versión {version || 'actual'} del documento.
          Se ha creado una nueva revisión para corrección.
        </Text>
      )}
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLink} style={button}>Ver folio</Button>
      </Section>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLink}</Text>
    </TraceaShell>
  )
}

export const template = {
  component: FolioDictamenEmail,
  subject: (data: Record<string, any>) => {
    const org = data?.organizacion ? `[${String(data.organizacion).toUpperCase()}] ` : ''
    const codigo = data?.folio_codigo || 'folio'
    const aprobado = String(data?.conclusion || '').toLowerCase() === 'aprobado'
    return aprobado
      ? `${org}✅ Folio APROBADO — ${codigo}`
      : `${org}⚠ Folio requiere corrección — ${codigo}`
  },
  displayName: 'Dictamen del folio',
  previewData: {
    nombre: 'Ing. Carlos Ramírez',
    folio_codigo: 'GR-2026-001',
    proceso: 'Línea de envasado A1',
    organizacion: 'DIAFRA',
    aprobador: 'Responsable Sanitario',
    conclusion: 'Aprobado',
    motivo: '',
    version: '1.0',
    norma_nombre: 'NOM-241',
    metodologia: 'AMEF',
    link: 'https://tracea.com.mx/folios/abc-123',
  },
} satisfies TemplateEntry