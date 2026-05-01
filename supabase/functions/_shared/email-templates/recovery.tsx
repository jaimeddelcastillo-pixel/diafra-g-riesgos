/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle } from './_tracea-shell.tsx'

interface Props {
  siteName?: string
  confirmationUrl?: string
}

export const RecoveryEmail: React.FC<Props> = ({ confirmationUrl = '#' }) => (
  <TraceaShell preview="Restablece tu contraseña de TRACEA">
    <Heading style={h1}>Restablece tu contraseña</Heading>
    <Text style={text}>
      Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>TRACEA</strong>.
    </Text>
    <Text style={text}>
      Haz clic en el siguiente botón para crear una nueva contraseña. Por seguridad, este enlace
      sólo es válido durante <strong>1 hora</strong>.
    </Text>

    <Section style={{ textAlign: 'center', margin: '32px 0' }}>
      <Button href={confirmationUrl} style={button}>Restablecer contraseña</Button>
    </Section>

    <Text style={smallText}>Si el botón no funciona, copia y pega este enlace en tu navegador:</Text>
    <Text style={linkFallback}>{confirmationUrl}</Text>

    <Hr style={hrStyle} />
    <Text style={smallText}>
      Si no solicitaste este cambio, ignora este correo y tu contraseña actual seguirá vigente.
      Por tu seguridad, te recomendamos revisar tu sesión activa en TRACEA.
    </Text>
  </TraceaShell>
)

export default RecoveryEmail