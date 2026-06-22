import { LegalLayout } from "@/components/LegalLayout";

export default function Confianza() {
  return (
    <LegalLayout
      titulo="Centro de Confianza"
      subtitulo="Esta página es mantenida por el equipo TRACEA para responder dudas comunes sobre seguridad, privacidad y cumplimiento de la plataforma. No constituye una certificación ni una verificación independiente."
    >
      <h2>I. Acerca de esta página</h2>
      <p>
        TRACEA es una suite de gestión de calidad para industrias reguladas por COFEPRIS
        (dispositivos médicos, alimentos y medicamentos). Este Centro de Confianza describe los
        controles habilitados en la plataforma a la fecha de publicación. Es contenido editable
        por el responsable de TRACEA y debe leerse junto con los{" "}
        <a href="/terminos">Términos y Condiciones</a> y el{" "}
        <a href="/privacidad">Aviso de Privacidad</a>.
      </p>

      <h2>II. Acceso y autenticación</h2>
      <ul>
        <li>Autenticación por correo y contraseña gestionada por la plataforma backend.</li>
        <li>
          Restablecimiento de contraseña por correo verificado; las sesiones se renuevan con
          tokens rotatorios.
        </li>
        <li>
          Modelo de roles por organización (Administrador, Responsable Sanitario, Comité Técnico,
          Operador/Editor, Lectura). Las acciones críticas requieren el rol correspondiente.
        </li>
        <li>
          Firma electrónica con re-autenticación por contraseña antes de aplicar la firma a un
          folio.
        </li>
      </ul>

      <h2>III. Infraestructura y hospedaje</h2>
      <ul>
        <li>Aplicación web desplegada en CDN global y backend administrado (Supabase).</li>
        <li>Cifrado en tránsito (HTTPS/TLS) en todos los dominios públicos de TRACEA.</li>
        <li>Cifrado en reposo de la base de datos y de los buckets de almacenamiento privado.</li>
        <li>
          Respaldos automáticos administrados por el proveedor de base de datos. El detalle de
          retención puede solicitarse a soporte.
        </li>
      </ul>

      <h2>IV. Datos que recabamos y cómo se usan</h2>
      <p>
        El alcance, finalidad, y derechos ARCO se describen en el{" "}
        <a href="/privacidad">Aviso de Privacidad</a>. TRACEA no recaba datos personales
        sensibles. Los registros, análisis y documentos que la organización cliente carga en la
        plataforma son propiedad de dicha organización.
      </p>

      <h2>V. Aislamiento entre organizaciones</h2>
      <ul>
        <li>
          Cada folio, riesgo, documento, ticket y diploma está asociado a una organización; las
          políticas de la base de datos restringen el acceso a miembros de esa organización con
          el rol adecuado.
        </li>
        <li>
          Los canales en tiempo real están limitados al identificador de la organización del
          usuario autenticado.
        </li>
        <li>
          Los diplomas emitidos pueden verificarse públicamente únicamente proporcionando el
          identificador (hash) impreso en el documento; no es posible enumerar diplomas ni
          consultar datos del titular sin ese identificador.
        </li>
      </ul>

      <h2>VI. Subprocesadores e integraciones</h2>
      <ul>
        <li>Supabase — base de datos, autenticación, almacenamiento y funciones serverless.</li>
        <li>Resend — envío de correos transaccionales y notificaciones.</li>
        <li>Stripe — procesamiento de pagos (TRACEA no almacena datos de tarjetas).</li>
        <li>
          Proveedores de modelos de IA utilizados para asistencia conversacional y extracción de
          datos en módulos opcionales.
        </li>
      </ul>

      <h2>VII. Retención y eliminación</h2>
      <ul>
        <li>
          Los documentos enviados a la papelera se purgan automáticamente después de 30 días.
        </li>
        <li>
          Los folios cancelados conservan su histórico para fines de trazabilidad regulatoria
          (ISO 14971, NOM-241).
        </li>
        <li>
          La eliminación de cuenta y la portabilidad de datos pueden solicitarse conforme al
          Aviso de Privacidad.
        </li>
      </ul>

      <h2>VIII. Trazabilidad y Audit Trail</h2>
      <p>
        Cada cambio en datos críticos (folios, riesgos, firmas, roles, documentos) se registra
        de forma inmutable con usuario, fecha, hora, IP, valor anterior y valor nuevo, en
        cumplimiento con ISO 14971 y NOM-241-SSA1-2025.
      </p>

      <h2>IX. Reporte de vulnerabilidades</h2>
      <p>
        Si detectas una posible vulnerabilidad, por favor escríbenos a{" "}
        <a href="mailto:soporte@tracea.com.mx">soporte@tracea.com.mx</a> con el asunto
        "Security report". Agradecemos la divulgación responsable y nos comprometemos a
        responder en un plazo razonable.
      </p>

      <h2>X. Cumplimiento</h2>
      <p>
        TRACEA está diseñada para apoyar a sus clientes en el cumplimiento de NOM-241-SSA1-2025,
        NOM-059-SSA1-2015, FEUM Suplemento DM 5.0 e ISO 14971. La responsabilidad última de
        cumplimiento regulatorio corresponde a la organización titular del registro sanitario.
        Esta página no constituye una certificación independiente.
      </p>

      <p className="text-xs text-muted-foreground pt-6 border-t mt-8">
        Última actualización: {new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}.
        Para preguntas sobre este Centro de Confianza, escribe a soporte@tracea.com.mx.
      </p>
    </LegalLayout>
  );
}