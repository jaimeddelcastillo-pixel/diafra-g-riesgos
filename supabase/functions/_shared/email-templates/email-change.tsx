/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle } from './_tracea-shell.tsx'

interface Props {
  siteName?: string
  oldEmail?: string
  email?: string
  newEmail?: string
  confirmationUrl?: string
}

export const EmailChangeEmail: React.FC<Props> = ({ confirmationUrl = '#', oldEmail, newEmail }) => (
  <TraceaShell preview="Confirma tu nuevo correo en TRACEA">
    <Heading style={h1}>Confirma tu nuevo correo</Heading>
    <Text style={text}>
      Recibimos una solicitud para cambiar la dirección asociada a tu cuenta en <strong>TRACEA</strong>:
    </Text>
    {oldEmail || newEmail ? (
      <Text style={text}>
        {oldEmail ? <>De <strong>{oldEmail}</strong> </> : null}
        {newEmail ? <>a <strong>{newEmail}</strong>.</> : null}
      </Text>
    ) : null}
    <Text style={text}>
      Confirma el cambio con el botón siguiente. Si no realizas la confirmación, tu correo actual
      seguirá vigente.
    </Text>

    <Section style={{ textAlign: 'center', margin: '32px 0' }}>
      <Button href={confirmationUrl} style={button}>Confirmar cambio</Button>
    </Section>

    <Text style={smallText}>Si el botón no funciona, copia y pega este enlace en tu navegador:</Text>
    <Text style={linkFallback}>{confirmationUrl}</Text>

    <Hr style={hrStyle} />
    <Text style={smallText}>
      Si no solicitaste este cambio, ignora este correo y avisa a soporte@tracea.com.mx.
    </Text>
  </TraceaShell>
)

export default EmailChangeEmail