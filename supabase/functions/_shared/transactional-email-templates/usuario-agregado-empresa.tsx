/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, button } from './_tracea-shell.tsx'

interface Props { nombre?: string; organizacion?: string; rol?: string; loginUrl?: string }

const UsuarioAgregadoEmpresaEmail = ({ nombre, organizacion, rol, loginUrl }: Props) => {
  const url = loginUrl || 'https://tracea.com.mx/login'
  return (
    <TraceaShell preview={`Te agregaron a ${organizacion ?? 'una empresa'} en TRACEA`}>
      <Heading style={h1}>Te agregaron a {organizacion ?? 'una empresa'} en TRACEA</Heading>
      <Text style={text}>{nombre ? `Hola ${nombre},` : 'Hola,'}</Text>
      <Text style={text}>
        Te agregaron a <strong>{organizacion}</strong> en TRACEA con el rol <strong>{rol}</strong>.
      </Text>
      <Text style={text}>
        Entra con tu misma cuenta y contraseña. Si perteneces a varias empresas, elige con cuál trabajar
        desde el selector del menú lateral.
      </Text>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={url} style={button}>Entrar a TRACEA</Button>
      </Section>
    </TraceaShell>
  )
}

export const template = {
  component: UsuarioAgregadoEmpresaEmail,
  subject: (d: Record<string, any>) => `Te agregaron a ${d?.organizacion ?? 'una empresa'} en TRACEA con el rol ${d?.rol ?? ''}`.trim(),
  displayName: 'Usuario agregado a empresa',
  previewData: { nombre: 'Consultor', organizacion: 'QA NOM-059 Sandbox', rol: 'Operador', loginUrl: 'https://tracea.com.mx/login' },
} satisfies TemplateEntry
