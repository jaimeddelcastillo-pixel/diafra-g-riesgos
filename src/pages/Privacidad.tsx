import { LegalLayout } from "@/components/LegalLayout";

export default function Privacidad() {
  return (
    <LegalLayout
      titulo="Aviso de Privacidad"
      subtitulo="Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) — Versión 1.0, vigente a partir del 1 de mayo de 2026"
    >
      <h2>I. Identidad y Domicilio del Responsable</h2>
      <p>
        [NOMBRE LEGAL DE LA EMPRESA], RFC: [RFC], con domicilio en [DOMICILIO COMPLETO], México,
        es el Responsable del tratamiento de sus datos personales conforme a la Ley Federal de
        Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento.
      </p>
      <p>
        El Responsable opera la plataforma TRACEA, accesible en tracea.com.mx y usetracea.com,
        una Suite de gestión de calidad para industrias reguladas por COFEPRIS (dispositivos
        médicos, alimentos y medicamentos).
      </p>

      <h2>II. Datos Personales que Recabamos</h2>
      <p>TRACEA recaba las siguientes categorías de datos personales:</p>
      <h3>A) Datos de identificación y contacto</h3>
      <ul>
        <li>Nombre completo</li>
        <li>Correo electrónico</li>
        <li>Cargo o puesto dentro de la organización</li>
        <li>Nombre y RFC de la organización</li>
        <li>Teléfono (opcional, cuando se proporciona para soporte)</li>
      </ul>
      <h3>B) Datos de uso de la plataforma</h3>
      <ul>
        <li>Registros de acceso (fecha, hora, dirección IP)</li>
        <li>Actividad dentro de la plataforma (folios creados, documentos firmados, módulos utilizados)</li>
        <li>Hash de documentos firmados electrónicamente (sin contenido del documento)</li>
        <li>Imágenes o documentos subidos para extracción de datos con IA (procesados y eliminados tras la extracción)</li>
      </ul>
      <h3>C) Datos de pago</h3>
      <ul>
        <li>Los datos de tarjeta son procesados directamente por Stripe. TRACEA no almacena datos de tarjetas de crédito o débito.</li>
        <li>TRACEA conserva únicamente el identificador de cliente en Stripe y el historial de transacciones.</li>
      </ul>
      <p className="text-sm bg-muted/50 border-l-4 border-primary p-4 rounded">
        <strong>IMPORTANTE:</strong> TRACEA NO recaba datos personales sensibles (salud,
        biometría, creencias religiosas, etc.). Los análisis, registros y documentos que la
        Organización registra en la plataforma son propiedad de la Organización, no datos
        personales tratados por TRACEA.
      </p>

      <h2>III. Finalidades del Tratamiento</h2>
      <p>Sus datos personales son utilizados para las siguientes finalidades:</p>
      <h3>Finalidades primarias (necesarias para el servicio)</h3>
      <ol>
        <li>Creación y gestión de su cuenta de usuario en la plataforma TRACEA.</li>
        <li>Prestación del servicio de gestión de calidad contratado (gestión de riesgos, análisis de tendencias, capacitación y demás módulos).</li>
        <li>Procesamiento de pagos y emisión de comprobantes fiscales.</li>
        <li>Comunicación relacionada con el servicio (notificaciones, alertas, soporte técnico).</li>
        <li>Registro de firma electrónica con valor probatorio conforme a la legislación aplicable.</li>
        <li>Emisión de constancias DC-3 de capacitación (cuando aplique).</li>
        <li>Extracción de datos de imágenes y documentos para el módulo de Análisis de Tendencias (procesamiento temporal, sin almacenamiento de la imagen original).</li>
      </ol>
      <h3>Finalidades secundarias (puede oponerse)</h3>
      <ol start={8}>
        <li>Envío de información sobre actualizaciones, nuevos módulos y mejoras de la Suite TRACEA.</li>
        <li>Envío de contenido educativo relacionado con gestión de calidad y normativa COFEPRIS (NOM-241, NOM-251, NOM-059).</li>
        <li>Realización de encuestas de satisfacción del servicio.</li>
      </ol>
      <p>
        Para oponerse a las finalidades secundarias, envíe un correo a{" "}
        <a href="mailto:soporte@tracea.com.mx">soporte@tracea.com.mx</a> con el asunto{" "}
        <em>"Oposición finalidades secundarias"</em>.
      </p>

      <h2>IV. Transferencias de Datos</h2>
      <p>TRACEA no realiza transferencias de datos personales a terceros, salvo en los siguientes casos:</p>
      <ul>
        <li><strong>Stripe, Inc.:</strong> Para el procesamiento seguro de pagos. Stripe cuenta con certificación PCI-DSS Nivel 1.</li>
        <li><strong>Supabase, Inc.:</strong> Como proveedor de infraestructura de base de datos y almacenamiento. Los datos se alojan en servidores en Estados Unidos con las salvaguardas adecuadas.</li>
        <li><strong>Anthropic, PBC:</strong> Para el procesamiento de imágenes y documentos en el módulo de Análisis de Tendencias mediante Claude API. Las imágenes se procesan en tiempo real y no se almacenan por Anthropic para entrenamiento conforme a su política de datos de API.</li>
        <li><strong>Autoridades competentes:</strong> Cuando sea requerido por mandato judicial o autoridad administrativa conforme a la ley mexicana.</li>
      </ul>
      <p>Todos los proveedores están sujetos a obligaciones de confidencialidad y cuentan con políticas de privacidad propias.</p>

      <h2>V. Derechos ARCO</h2>
      <p>
        Usted tiene derecho a Acceder, Rectificar, Cancelar y Oponerse (derechos ARCO) al
        tratamiento de sus datos personales, así como a revocar el consentimiento otorgado y
        ejercer el derecho a la portabilidad de sus datos.
      </p>
      <p>Para ejercer sus derechos ARCO envíe su solicitud a:</p>
      <ul>
        <li><strong>Correo electrónico:</strong> soporte@tracea.com.mx</li>
        <li><strong>Asunto:</strong> Ejercicio de Derechos ARCO</li>
        <li><strong>Incluya:</strong> nombre completo, correo registrado, derecho que desea ejercer y descripción de su solicitud</li>
      </ul>
      <p>TRACEA responderá su solicitud en un plazo máximo de 20 días hábiles a partir de su recepción.</p>

      <h2>VI. Seguridad de los Datos</h2>
      <p>TRACEA implementa las siguientes medidas de seguridad para proteger sus datos personales:</p>
      <ul>
        <li>Cifrado en tránsito mediante HTTPS/TLS en todas las comunicaciones</li>
        <li>Aislamiento de datos por organización mediante Row Level Security (RLS) a nivel de base de datos</li>
        <li>Autenticación segura con contraseñas encriptadas</li>
        <li>Respaldos automáticos diarios con retención de 30 días</li>
        <li>Control de acceso basado en roles dentro de cada organización</li>
        <li>Registro de auditoría de todas las operaciones críticas</li>
        <li>Hash SHA-256 en documentos para verificación de inalterabilidad</li>
        <li>URLs temporales de descarga con expiración de 60 minutos</li>
      </ul>

      <h2>VII. Retención de Datos</h2>
      <p>
        Los datos personales se conservan durante el tiempo en que el Usuario mantenga una cuenta
        activa en TRACEA y por un período adicional de:
      </p>
      <ul>
        <li><strong>30 días después de la cancelación:</strong> datos disponibles para exportación por el Usuario</li>
        <li><strong>3 años adicionales:</strong> registros de firma electrónica y auditoría (por obligación legal)</li>
        <li><strong>Transcurridos los plazos anteriores:</strong> eliminación permanente y segura</li>
      </ul>

      <h2>VIII. Cookies y Tecnologías de Rastreo</h2>
      <p>
        TRACEA utiliza cookies estrictamente necesarias para el funcionamiento de la plataforma
        (sesión de usuario, preferencias). No se utilizan cookies de rastreo publicitario ni se
        comparten datos con plataformas de publicidad.
      </p>

      <h2>IX. Modificaciones al Aviso de Privacidad</h2>
      <p>
        TRACEA se reserva el derecho de modificar el presente Aviso. Cualquier cambio será
        notificado por correo electrónico al menos 15 días antes de su entrada en vigor. El Aviso
        vigente siempre estará disponible en tracea.com.mx/privacidad.
      </p>

      <h2>X. Autoridad de Protección de Datos</h2>
      <p>
        Si considera que sus derechos han sido vulnerados puede presentar una queja ante el
        Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos
        Personales (INAI):{" "}
        <a href="https://www.inai.org.mx" target="_blank" rel="noopener noreferrer">
          www.inai.org.mx
        </a>
      </p>

      <h2>XI. Contacto</h2>
      <ul>
        <li><strong>Correo:</strong> soporte@tracea.com.mx</li>
        <li><strong>Web:</strong> tracea.com.mx/privacidad</li>
        <li><strong>Domicilio:</strong> [DOMICILIO LEGAL DE TRACEA]</li>
      </ul>

      <p className="text-xs text-muted-foreground border-t pt-4 mt-8">
        © 2026 TRACEA. Todos los derechos reservados.
      </p>
    </LegalLayout>
  );
}