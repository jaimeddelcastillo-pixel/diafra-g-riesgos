
# Plan: Alinear plataforma con el guion del Módulo 4

Objetivo: que el guion narrado del Módulo 4 sea verdad en la plataforma. Cuatro frentes independientes entregados juntos.

---

## 1. Separar Dictamen Aprobado del Cierre del Expediente

Sustento: ISO 14971 §8 distingue la **revisión de la gestión de riesgos** (que produce el dictamen aprobado) del **archivo de gestión de riesgos** (expediente cerrado y bloqueado). Son dos momentos auditables distintos — colapsarlos elimina trazabilidad que COFEPRIS puede solicitar.

Cambios:

1. **Firma del Dictamen → estado Aprobado** (comportamiento actual intacto). En `folio-workflow` acción `dictamen` con `conclusion === "Aprobado"`, el folio queda en `Aprobado` y el audit trail registra `"Dictamen aprobado por Responsable Sanitario"` con timestamp, hash SHA-256, IP y `user_id` del RS.
2. **Nuevo botón "Cerrar expediente"** en `FolioDetail.tsx`, visible **solo cuando** `estado === "Aprobado"` y el usuario es elaborador (rol Calidad / `created_by`), Responsable Sanitario o Admin. Llama a nueva acción `cerrar` en `folio-workflow` que pasa el folio a `Cerrado` y registra `"Expediente cerrado"` con timestamp, `user_id` e IP.
3. **Estado `Cerrado`**: inalterable, solo lectura, reapertura solo mediante nueva versión con justificación (acción `reabrir` existente).
4. **`getEstadoStyle` y chips** en `useFolios.tsx`, `FolioDetail` y listas: los cuatro estados visibles (Borrador, En Firma, Aprobado, Cerrado) deben tener color/ícono distintos — especialmente Aprobado vs Cerrado.

## 2. Reset de firmas del comité al rechazar

Hoy el reset solo ocurre al "Reabrir". En `folio-workflow` acción `dictamen` con `conclusion !== "Aprobado"`, después de `archivar_version_folio` ejecutar el mismo bloque de reset sobre `folio_comite` (`firmado=false`, `fecha_firma=null`, `ip_firma=""`, `user_agent=""`, `texto_compromiso=""`, `hash_documento=""`) y limpiar `comite_votos` de la ronda.

## 3. Alertas automáticas de revisión periódica (12 meses)

Nueva edge function `check-folios-revision` ejecutada diariamente vía `pg_cron`:
- Busca folios `Cerrado` con >12 meses desde última aprobación (NOM-241).
- Envía correo al RS (plantilla `folio-revision-pendiente`) y registra evento en `audit_trail` para no repetir en <30 días.
- Plantilla React Email TRACEA navy + teal con datos del folio y link directo.
- Cron registrado vía la herramienta interna.

## 4. Examen final del estudiante + diploma automático

### 4.1 Datos
Nuevas tablas (con RLS + GRANT):
- `curso_examen_intentos` — respuestas (jsonb), correctas, total, calificación, bloque_resumen, aprobado, started_at, finished_at, num_intento.
- `curso_diplomas` — folio `DIP-YYYY-NNN`, user_id, curso_id, intento_id, fecha_emision, calificacion, hash_verificacion, pdf_path.

Reglas: máx **3 intentos**, **≥ 80%** (16/20), **5 preguntas aleatorias por bloque** (marco_regulatorio, metodologia, casos_practicos, flujo_aprobacion). Si reprueba, indica bloques con más fallas y módulos a repasar. RLS: alumno ve solo lo suyo; admin de la org ve todos los suyos.

### 4.2 UI
- Nueva ruta `/capacitacion/:cursoId/examen`: instrucciones → pregunta por pregunta con contador "correctas hasta ahora" → resultados con desglose por bloque → si aprueba, "Ver diploma" + correo; si reprueba, módulos a repasar + "Reintentar" mientras queden intentos.
- Botón "Tomar evaluación final" en `Capacitacion.tsx` cuando el alumno completó los 4 módulos.

### 4.3 Diploma PDF
Estilo "industrial médico" — paleta `#0B2545 / #13A8A8 / #F5F7FA / #0F3C5F`, sans serif, marco con líneas técnicas.

Contenido:
- Logo TRACEA + título "Diploma de aprovechamiento".
- Nombre del alumno, curso, norma, fecha, calificación.
- Duración total y lista breve de módulos aprobados.
- Folio único `DIP-YYYY-NNN` + QR a `https://www.tracea.com.mx/diploma/verificar/:hash`.
- Firma del instructor (imagen) — **pendiente del usuario**: PNG transparente del Ing. Jaime David Del Castillo Couret (~200×80px) o autorización de facsímil escrito.
- **Pie legal (texto exacto):**

  > Documento de aprovechamiento académico emitido por TRACEA Academy en cumplimiento del programa de capacitación en Gestión de Riesgos conforme a NOM-241-SSA1-2025 y FEUM Suplemento para Dispositivos Médicos 5.0. Instructor: Ing. Jaime David Del Castillo Couret. Verificación en línea: tracea.com.mx/diploma/verificar/:hash

- **Sin mención del DC-3** en el PDF ni en el correo. El diploma es el único documento que se emite automáticamente al aprobar el examen.

Ruta pública `/diploma/verificar/:hash` que muestra válido/no válido, nombre, curso, fecha, calificación.

### 4.4 Generación y envío
- Edge function `emitir-diploma` invocada al aprobar el examen: genera PDF (jsPDF, patrón de `generateFolioPDF.ts`), sube al bucket privado nuevo `diplomas` (signed URLs), registra `curso_diplomas` y dispara correo `diploma-emitido` con PDF adjunto. El correo **no menciona el DC-3**; informa únicamente del diploma emitido y enlaza a la verificación pública.
- UI de resultados: botón "Descargar diploma" con signed URL inmediata.

---

## Archivos y áreas tocadas

```text
supabase/functions/folio-workflow/index.ts        (nueva acción "cerrar" + reset firmas en rechazo)
supabase/functions/check-folios-revision/         (nuevo cron 12m)
supabase/functions/emitir-diploma/                (nuevo)
supabase/functions/_shared/transactional-email-templates/
  folio-revision-pendiente.tsx                    (nuevo)
  diploma-emitido.tsx                             (nuevo, sin mención DC-3)
  registry.ts                                     (registrar)
supabase/migrations/...                           (curso_examen_intentos, curso_diplomas, bucket diplomas, cron 12m, evento "cerrado" en audit)
src/pages/Capacitacion.tsx                        (botón evaluación final)
src/pages/ExamenFinal.tsx                         (nueva)
src/pages/DiplomaVerificar.tsx                    (nueva ruta pública)
src/pages/FolioDetail.tsx                         (botón "Cerrar expediente")
src/lib/generateDiplomaPDF.ts                     (nuevo, con pie legal exacto)
src/hooks/useFolios.tsx                           (estilos diferenciados Aprobado vs Cerrado)
```

## Pendiente del usuario

1. Firma PNG transparente del Ing. Jaime David Del Castillo Couret (~200×80px) — o confirmar facsímil escrito.
