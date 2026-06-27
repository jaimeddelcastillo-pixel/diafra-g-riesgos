/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  TraceaShell, h1, text, button, infoBox, dataRow, warnBox,
} from './_tracea-shell.tsx'

interface Props {
  alumno_nombre?: string
  email_destino?: string
  org_nombre?: string
  plan_org?: string
  curso_titulo?: string
  curso_norma?: string
  calificacion?: number | string
  fuente?: 'incluido' | 'comprado'
  admin_url?: string
}

const Email = ({
  alumno_nombre, email_destino, org_nombre, plan_org,
  curso_titulo, curso_norma, calificacion, fuente, admin_url,
}: Props) => (
  <TraceaShell preview={`Nueva solicitud DC-3 — ${alumno_nombre || ''}`}>
    <Heading style={h1}>Nueva solicitud DC-3 pendiente</Heading>
    <Section style={warnBox}>
      <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#7a3e00' }}>
        ⚠ Acción requerida — emitir constancia DC-3 ante SIRCE (2-3 días hábiles).
      </Text>
    </Section>
    <Section style={infoBox}>
      <Text style={dataRow}><strong>Alumno:</strong> {alumno_nombre || '—'}</Text>
      <Text style={dataRow}><strong>Email destino:</strong> {email_destino || '—'}</Text>
      <Text style={dataRow}><strong>Empresa:</strong> {org_nombre || '—'} ({plan_org || '—'})</Text>
      <Text style={dataRow}><strong>Curso:</strong> {curso_titulo || '—'} ({curso_norma || '—'})</Text>
      <Text style={dataRow}><strong>Calificación:</strong> {calificacion ?? '—'} / 100</Text>
      <Text style={dataRow}><strong>Fuente:</strong> {fuente === 'comprado' ? 'DC-3 adicional comprado' : 'DC-3 incluido con el curso'}</Text>
    </Section>
    <Section style={{ textAlign: 'center', margin: '24px 0' }}>
      <Button href={admin_url || 'https://tracea.com.mx/admin/dc3'} style={button}>
        Abrir panel DC-3
      </Button>
    </Section>
  </TraceaShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `📋 DC-3 pendiente — ${d?.alumno_nombre || 'Alumno'} / ${d?.org_nombre || ''}`,
  displayName: 'DC-3 — Solicitud interna (TRACEA)',
  previewData: {
    alumno_nombre: 'María López',
    email_destino: 'maria@empresa.mx',
    org_nombre: 'Laboratorio Demo',
    plan_org: 'starter',
    curso_titulo: 'Gestión de Riesgos NOM-241-SSA1-2025',
    curso_norma: 'NOM-241',
    calificacion: 90,
    fuente: 'incluido',
    admin_url: 'https://tracea.com.mx/admin/dc3',
  },
} satisfies TemplateEntry