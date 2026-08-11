# Ajustes del modal de entrevista + Importación de Listado Maestro

## Grupo A — Ajustes semánticos y ayuda contextual (bajo riesgo, solo UI)

Todo ocurre en `src/components/cerebro/NuevaEntrevistaDialog.tsx`. No cambian nombres técnicos, RPC, ni tablas.

- **A1.** Pestaña "Ad hoc" → "Nueva entrevista" (valor interno `adhoc` sin cambios). Microdescripción bajo cada pestaña con los textos indicados.
- **A2.** "Procesos efectivos de esta sesión" → "Procesos a cubrir en esta entrevista", con el texto de ayuda debajo del campo.
- **A3/A4.** Diccionarios `CAPAS`/`NIVELES` ganan un campo `ayuda`; el texto correspondiente se muestra como línea auxiliar visible bajo cada selector (no tooltip). Bajo Nivel de autoridad se añade la nota fija: no representa jerarquía organizacional, sino el peso de la persona respecto del conocimiento tratado en esa entrevista.
- **A5. Autocompletado.**
  - Miembro interno: `profiles` solo tiene `nombre`, `email`, `cargo` — se autocompleta **Puesto** desde `cargo`. No existe campo de área en `profiles`, así que Área queda manual (alternativa opcional: derivarla de la asignación cuando exista).
  - Desde asignación: precargar entrevistado, puesto, capa, nivel de autoridad, área (vía `area_id` → `brain_areas.nombre`), procesos sugeridos y mostrar `razon_asignacion` como bloque de contexto de solo lectura. Todos los campos siguen editables antes de iniciar.
  - Para procesos precargados desde la asignación se usan `dominios_conocimiento` / procesos ya relacionados, marcando los checkboxes correspondientes.

## Grupo B — Importación de Listado Maestro: análisis (18 puntos)

**1. Componentes reutilizables.** Ya existen: `xlsx` (SheetJS), `mammoth` (.docx), `pdfjs-dist` (PDF con texto) y el helper `src/lib/extract-file-text.ts` (límites, detección de tipo, mensajes de error, detección de PDF escaneado). **No** existen PapaParse ni react-dropzone, ni componente de preview tabular reutilizable. Hay patrones de upload a Storage en `SeccionEvidencias.tsx`, `OrgLogoCard.tsx`, `AdminRecursos.tsx` (input file simple + `storage.from().upload`).

**2. Semántica.** UI usa "Listado Maestro de Documentos" como título, con subtexto: "También llamado Lista Maestra, Índice Maestro o Control Maestro de Documentos". No se valida ni impone un nombre.

**3. Wireflow.** Upload → parseo y detección de encabezados → mapeo de columnas editable → vista previa clasificada → confirmación → importación. Cada paso es un step del asistente; nada se persiste en `brain_documents` hasta la confirmación final.

**4. Formatos MVP.** Nivel 1: `.xlsx` (SheetJS ya presente), `.csv` (parser propio ~40 líneas con soporte de comillas y `;`/`,` — evita agregar PapaParse), `.txt`/`.md` (nativo, tablas markdown o separadas por tabulación). Nivel 2: `.docx` — `mammoth` extrae texto plano pero **no** conserva estructura de tabla; se soporta en modo "mejor esfuerzo" (tabulaciones/líneas) y se advierte en UI. Nivel 3: `.pdf` con texto vía pdfjs (extracción por posición de columna, mejor esfuerzo). PDF escaneado → mensaje exacto solicitado; sin OCR.

**5. Parsing y detección de encabezados.** Se leen las primeras 20 filas; se elige como fila de encabezado la primera con ≥3 celdas no vacías, mayoría de texto y baja repetición, priorizando la que contenga tokens conocidos (código, documento, revisión…). Las filas anteriores se descartan como membrete. Se ignoran filas totalmente vacías y filas repetidas de encabezado.

**6. Modelo de datos mínimo.**
- Nueva tabla `brain_import_batches`: `org_id`, `tipo` ('listado_maestro'), `nombre_archivo`, `storage_path`, `formato`, `total_filas`, `filas_importadas`, `mapeo` jsonb, `estado`, `imported_by`, timestamps. RLS por `get_user_org_id()`/`is_super_admin()` + GRANTs.
- Columnas nuevas en `brain_documents`: `import_batch_id` (FK), `import_row_reference` (int), `import_status` ('nuevo' | 'actualizado' | 'revisar'), `origen` ('manual' | 'listado_maestro'). Todas nullable → cero impacto en registros existentes.
- Nueva tabla `brain_import_propuestas` para áreas y procesos candidatos (`batch_id`, `tipo` 'area'|'proceso', `nombre`, `evidencia`, `estado` 'propuesta'|'aceptada'|'descartada').

**7. Provenance.** El archivo original se sube a un bucket privado nuevo `brain-imports` en `{org_id}/{batch_id}/{filename}` y su ruta queda en `brain_import_batches.storage_path`. Cada documento importado guarda `import_batch_id`, `import_row_reference`, y el batch guarda usuario y fecha. El batch queda visible y consultable desde /cerebro/documentos.

**8. Duplicados.** Antes de persistir se comparan contra `brain_documents` de la org: (a) código exacto + revisión igual → **Posible duplicado**; (b) código exacto + revisión distinta → **Posible actualización**; (c) sin código pero título normalizado coincidente (minúsculas, sin acentos ni puntuación) → **Requiere revisión**; (d) sin coincidencia → **Nuevo**. Nunca se sobrescribe: las actualizaciones crean registro nuevo enlazado o se omiten según decisión del usuario fila por fila.

**9. Mapeo de columnas.** Combinación: diccionario de sinónimos por campo destino (código/clave/no. documento; nombre/título/documento/procedimiento; revisión/versión/edición; fecha/vigencia; área/departamento; responsable; estado; tipo) + normalización y similitud por tokens; se propone el mapeo con nivel de confianza y el usuario lo corrige en una tabla editable (cada columna del archivo → campo TRACEA o "ignorar"). Solo "nombre" es obligatorio para importar.

**10. Áreas.** Los valores distintos de la columna Área se proponen en `brain_import_propuestas`; el usuario marca cuáles crear como `brain_areas`. Nunca automático. Las coincidencias con áreas existentes se enlazan directamente.

**11. Procesos candidatos.** Solo se proponen (nunca se crean) procesos inferidos de títulos de PNO, marcados explícitamente como inferencia. Área ≠ Proceso: no se genera relación automática. **No** se crean `brain_knowledge_items`: el Listado Maestro entra como fuente documental, no como conocimiento validado.

**12. Permisos.** Solo `admin` y `responsable_sanitario` (más `super_admin`). Enforcement server-side en la edge function `brain-import-listado` verificando el JWT y `has_role`, además de RLS en las tablas nuevas. La UI oculta el botón, pero la autoridad es del servidor.

**13. Límites MVP.** Archivo ≤ 10 MB; ≤ 2 000 filas de datos por importación; ≤ 40 columnas. Al superarse, se rechaza antes de parsear con mensaje que sugiere dividir el listado por área o rango.

**14. Errores.** Archivo no parseable → mensaje por formato; sin encabezados detectables → se muestra la grilla cruda y se pide elegir la fila de encabezado manualmente; cero filas válidas tras el mapeo → aviso con motivo por fila; error parcial → inserción por lotes de 100 dentro de la función, el batch queda `parcial` con `filas_importadas` real y listado de fallos; el parseo pesado corre en el cliente y solo se envía JSON normalizado, evitando timeouts.

**15. Archivos y componentes.**
- Modificar: `src/components/cerebro/NuevaEntrevistaDialog.tsx` (Grupo A), `src/pages/cerebro/CerebroDocumentos.tsx` (botón Importar + historial de importaciones), `src/hooks/useBrain.ts` (hooks de batches/propuestas).
- Nuevos: `src/lib/listado-maestro/parse.ts` (parsers por formato + detección de encabezado), `src/lib/listado-maestro/mapeo.ts` (sinónimos y clasificación), `src/components/cerebro/ImportarListadoDialog.tsx` (asistente de 4 pasos), `src/components/cerebro/MapeoColumnasTable.tsx`, `src/components/cerebro/PreviewImportacion.tsx`.
- Edge function nueva: `brain-import-listado` (valida rol, crea batch, inserta documentos y propuestas, devuelve resumen).
- Migraciones: bucket `brain-imports` + tablas/columnas del punto 6.

**16. Dependencias nuevas.** Ninguna. SheetJS, mammoth y pdfjs ya están; CSV se resuelve con parser propio; el upload usa `<input type="file">` con zona de arrastre nativa.

**17. Riesgos de regresión.** No se toca `brain-interview` ni sus tablas. Sobre `brain_documents` solo se añaden columnas nullable; las lecturas actuales siguen igual. Contra importaciones accidentales: confirmación explícita con conteo, restricción de rol, límites de tamaño, y batch reversible (acción "deshacer importación" que borra los documentos con ese `import_batch_id` mientras no hayan sido referenciados por conocimiento).

**18. Commits propuestos.**
1. A1–A4: textos y ayuda contextual del modal (independiente).
2. A5: autocompletado desde perfil y asignación.
3. Migración B: tablas, columnas y bucket.
4. Librería de parsing y mapeo + pruebas unitarias.
5. Asistente de importación (UI, sin persistir).
6. Edge function `brain-import-listado` + conexión de la UI.
7. Historial de importaciones, propuestas de áreas/procesos y deshacer.

Dependencias: 1 y 2 son independientes; 4 depende de 3 solo para tipos; 5 depende de 4; 6 depende de 3 y 5; 7 depende de 6.
