import { LegalLayout } from "@/components/LegalLayout";

export default function Terminos() {
  return (
    <LegalLayout
      titulo="Términos y Condiciones de Uso"
      subtitulo="Versión 1.0 — Vigente a partir del 1 de mayo de 2026"
    >
      <p className="text-sm bg-muted/50 border-l-4 border-primary p-4 rounded">
        <strong>Aviso importante:</strong> Al registrarse, acceder o utilizar la plataforma TRACEA,
        el Usuario y la Organización aceptan en su totalidad los presentes Términos y Condiciones.
        Si no está de acuerdo con alguna de las condiciones aquí establecidas, le solicitamos no
        utilizar la plataforma.
      </p>

      <h2>1. Definiciones</h2>
      <p>Para efectos de los presentes Términos y Condiciones, se entiende por:</p>
      <ul>
        <li><strong>TRACEA:</strong> Plataforma SaaS de gestión de calidad operada por Jaime David Del Castillo Couret, RFC CACJ730326698, con domicilio en El Rosario N° 51, Col. Club de Golf La Hacienda, Atizapán de Zaragoza, C.P. 52959, Estado de México, México.</li>
        <li><strong>Usuario:</strong> Persona física que accede a la plataforma con credenciales propias.</li>
        <li><strong>Organización:</strong> Persona moral o física con actividad empresarial que contrata los servicios de TRACEA.</li>
        <li><strong>Administrador:</strong> Usuario con privilegios de gestión dentro de su Organización.</li>
        <li><strong>Plan:</strong> Modalidad de servicio contratada (Curso, Starter, Professional, Enterprise).</li>
        <li><strong>Módulo:</strong> Componente funcional independiente de la plataforma (Gestión de Riesgos, Análisis de Tendencias, Calificación de Personal, Evaluación de Proveedores, entre otros).</li>
        <li><strong>Folio:</strong> Registro de análisis creado dentro de la plataforma.</li>
        <li><strong>Contenido:</strong> Datos, documentos, análisis y cualquier información registrada por la Organización en la plataforma.</li>
      </ul>

      <h2>2. Descripción del Servicio</h2>
      <p>
        TRACEA es una plataforma web modular de gestión de calidad diseñada para industrias
        reguladas por COFEPRIS en México, conforme a:
      </p>
      <ul>
        <li>NOM-241-SSA1-2025 (Buenas Prácticas de Fabricación — Dispositivos Médicos)</li>
        <li>NOM-251-SSA1-2009 (Buenas Prácticas de Higiene — Alimentos)</li>
        <li>NOM-059-SSA1-2015 (Buenas Prácticas de Fabricación — Medicamentos)</li>
        <li>ISO 14971:2019 (Gestión de Riesgos — Dispositivos Médicos)</li>
        <li>ISO 13485:2016 (Sistema de Gestión de Calidad — Dispositivos Médicos)</li>
        <li>FEUM Suplemento para Dispositivos Médicos 5.0</li>
      </ul>
      <p>Los servicios disponibles según el plan contratado incluyen:</p>
      <ul>
        <li>Gestión de Archivos Maestros de Riesgos (AMEF) con firma electrónica</li>
        <li>Checklist de cumplimiento normativo integrado</li>
        <li>Análisis de tendencias con extracción de datos por imagen e IA</li>
        <li>Asistente de Inteligencia Artificial para análisis regulatorio</li>
        <li>Centro de Recursos con documentación técnica de referencia</li>
        <li>Curso de capacitación con constancia DC-3</li>
        <li>Protocolos de Validación DQ/IQ/OQ/PQ</li>
      </ul>

      <h2>3. Registro y Cuenta</h2>
      <ol>
        <li>El registro requiere proporcionar información verídica y actualizada de la Organización.</li>
        <li>El Administrador es responsable de gestionar el acceso de los Usuarios de su Organización.</li>
        <li>Las credenciales de acceso son personales e intransferibles. La Organización es responsable de cualquier actividad realizada con sus credenciales.</li>
        <li>TRACEA se reserva el derecho de suspender cuentas que proporcionen información falsa o incumplan los presentes Términos.</li>
      </ol>

      <h2>4. Planes y Pagos</h2>
      <h3>4.1 Precios vigentes</h3>
      <ul>
        <li>Curso de Gestión de Riesgos NOM-241: $450 USD pago único (hasta 3 usuarios, 30 días de acceso)</li>
        <li>Plan Starter: $85 USD/mes (hasta 3 usuarios)</li>
        <li>Plan Professional: $225 USD/mes (hasta 10 usuarios)</li>
        <li>Plan Enterprise: $475 USD/mes (usuarios ilimitados)</li>
        <li>Protocolos DQ/IQ/OQ/PQ: $450 USD pago único (complemento)</li>
        <li>DC-3 adicionales: $35 USD por usuario (a cotizar con soporte@tracea.com.mx)</li>
        <li>Módulos adicionales de la Suite: precios disponibles en tracea.com.mx/precios</li>
      </ul>
      <h3>4.2 Condiciones de pago</h3>
      <ol>
        <li>Los pagos se procesan a través de Stripe, plataforma de pagos certificada PCI-DSS.</li>
        <li>Las suscripciones se renuevan automáticamente al inicio de cada período mensual.</li>
        <li>TRACEA emite comprobante de pago por cada transacción.</li>
        <li>Los precios están expresados en dólares americanos (USD). La conversión a MXN depende del tipo de cambio vigente al momento del pago.</li>
        <li>TRACEA se reserva el derecho de modificar precios con un aviso previo de 30 días.</li>
      </ol>

      <h2>5. Cancelación y Reembolsos</h2>
      <ol>
        <li>El Usuario puede cancelar su suscripción en cualquier momento desde la sección de Configuración.</li>
        <li>La cancelación aplica al final del período facturado en curso — no se realizan reembolsos proporcionales por días no utilizados.</li>
        <li>Los pagos únicos (Curso, Protocolos) no son reembolsables una vez que el acceso ha sido activado.</li>
        <li>Tras la cancelación, los datos se conservan en modo lectura por 30 días para su exportación.</li>
        <li>Transcurridos 30 días desde la cancelación, los datos serán eliminados permanentemente de los servidores de TRACEA.</li>
      </ol>

      <h2>6. Propiedad del Contenido</h2>
      <p><strong>6.1</strong> La Organización es propietaria de todo el Contenido que registre en la plataforma. TRACEA no reclama propiedad sobre los datos, análisis o documentos de la Organización.</p>
      <p><strong>6.2</strong> La Organización otorga a TRACEA una licencia limitada para procesar y almacenar el Contenido exclusivamente para prestar el servicio contratado.</p>
      <p><strong>6.3</strong> TRACEA no utilizará el Contenido de ninguna Organización para entrenar modelos de inteligencia artificial ni para ningún fin distinto a la prestación del servicio.</p>

      <h2>7. Seguridad y Privacidad de Datos</h2>
      <ol>
        <li>TRACEA implementa aislamiento de datos por organización mediante Row Level Security (RLS) a nivel de base de datos.</li>
        <li>Los documentos almacenados incluyen hash SHA-256 para verificación de integridad.</li>
        <li>Las URLs de descarga de documentos privados son temporales y expiran en 60 minutos.</li>
        <li>TRACEA realiza respaldos automáticos diarios de la base de datos.</li>
        <li>El tratamiento de datos personales se rige por el Aviso de Privacidad de TRACEA, disponible en tracea.com.mx/privacidad.</li>
      </ol>

      <h2>8. Limitación de Responsabilidad</h2>
      <p><strong>8.1</strong> TRACEA es una herramienta de apoyo para la gestión de calidad y riesgos. La responsabilidad técnica, legal y regulatoria de los análisis, dictámenes y documentos generados recae exclusivamente en la Organización y su Responsable Sanitario o equivalente.</p>
      <p><strong>8.2</strong> TRACEA no garantiza que el uso de la plataforma asegure el cumplimiento regulatorio ante COFEPRIS. El cumplimiento depende de la correcta aplicación de la metodología por parte del equipo de la Organización.</p>
      <p><strong>8.3</strong> En ningún caso la responsabilidad de TRACEA excederá el monto pagado por la Organización en los últimos 3 meses de servicio.</p>

      <h2>9. Disponibilidad del Servicio</h2>
      <p>
        TRACEA se compromete a mantener la plataforma disponible con un objetivo de 99.9% de uptime
        mensual. Las labores de mantenimiento programado se notificarán con al menos 24 horas de
        anticipación. TRACEA no es responsable por interrupciones causadas por fuerza mayor o
        fallos de infraestructura de terceros.
      </p>

      <h2>10. Modificaciones a los Términos</h2>
      <p>
        TRACEA se reserva el derecho de modificar los presentes Términos y Condiciones. Los cambios
        se notificarán por correo electrónico con al menos 30 días de anticipación. El uso continuado
        de la plataforma después de la fecha de vigencia de los cambios constituye aceptación de los
        nuevos Términos.
      </p>

      <h2>11. Ley Aplicable</h2>
      <p>
        Los presentes Términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier
        controversia se someterá a la jurisdicción de los tribunales de la Ciudad de México.
      </p>

      <h2>12. Contacto</h2>
      <ul>
        <li><strong>Responsable:</strong> Jaime David Del Castillo Couret</li>
        <li><strong>RFC:</strong> CACJ730326698</li>
        <li><strong>Correo:</strong> soporte@tracea.com.mx</li>
        <li><strong>Web:</strong> tracea.com.mx</li>
        <li><strong>Domicilio:</strong> El Rosario N° 51, Col. Club de Golf La Hacienda, Atizapán de Zaragoza, C.P. 52959, Estado de México, México</li>
      </ul>

      <p className="text-xs text-muted-foreground border-t pt-4 mt-8">
        © 2026 TRACEA. Todos los derechos reservados.
      </p>
    </LegalLayout>
  );
}